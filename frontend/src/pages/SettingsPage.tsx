import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ChangeEvent } from 'react'
import { ApiRequestError } from '../api/client.ts'
import {
  exportBackup,
  fetchAutoBackupStatus,
  importBackup,
  restoreAutoBackup,
  type ImportSummary,
} from '../api/backup.ts'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { PageTitle } from '../components/PageTitle.tsx'
import { formatDateTime } from '../lib/date.ts'
import { useToast } from '../toast/useToast.ts'
import { PAGE_TITLES } from '../views.ts'
import styles from './SettingsPage.module.css'

/** 最終エクスポート日時はこのブラウザにだけ保存する目安（screen-design 7章） */
const LAST_EXPORT_KEY = 'mytask-manager.lastExportAt'

function readLastExport(): string | null {
  try {
    return localStorage.getItem(LAST_EXPORT_KEY)
  } catch {
    return null
  }
}

function saveLastExport(iso: string) {
  try {
    localStorage.setItem(LAST_EXPORT_KEY, iso)
  } catch {
    // 保存できなくても動作に影響はない
  }
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** D3 で確認待ちの取り込み。source は表示用の名前（ファイル名） */
type PendingImport = { source: string; summary: ImportSummary; apply: () => Promise<void> }

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError && error.code === 'INVALID_BACKUP' ? error.message : fallback
}

/** S5 設定（バックアップ） */
export function SettingsPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [lastExport, setLastExport] = useState(readLastExport)
  const [exporting, setExporting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [importing, setImporting] = useState(false)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const handleExport = async () => {
    setExporting(true)
    try {
      const { blob, filename } = await exportBackup()
      download(blob, filename)
      const now = new Date().toISOString()
      saveLastExport(now)
      setLastExport(now)
      showToast({ message: `${filename} をダウンロードしました` })
    } catch {
      showToast({ message: 'エクスポートに失敗しました' })
    } finally {
      setExporting(false)
    }
  }

  /** ファイルを選んだら、まず検証だけ（dryRun）を行い、件数を出して D3 で確認する */
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // 同じファイルを選び直しても change が起きるように空にしておく
    e.target.value = ''
    if (!file) {
      return
    }
    setImportError(null)
    setChecking(true)
    try {
      const json = await file.text()
      const summary = await importBackup(json, true)
      setPending({ source: file.name, summary, apply: () => importBackup(json, false) })
    } catch (error) {
      setImportError(errorMessage(error, 'ファイルを確認できませんでした'))
    } finally {
      setChecking(false)
    }
  }

  /** 自動バックアップから復元する。流れはファイルの取り込みと同じ（検証 → D3 → 置き換え） */
  const handleRestore = async (name: string) => {
    try {
      const summary = await restoreAutoBackup(name, true)
      setPending({ source: name, summary, apply: () => restoreAutoBackup(name, false) })
    } catch (error) {
      showToast({ message: errorMessage(error, '自動バックアップを確認できませんでした') })
    }
  }

  const handleImport = async (target: PendingImport) => {
    setPending(null)
    setImporting(true)
    try {
      await target.apply()
      // すべてのデータが置き換わるので、キャッシュをすべて取り直す
      await queryClient.invalidateQueries()
      showToast({ message: `${target.source} からインポートしました` })
    } catch (error) {
      setImportError(error instanceof ApiRequestError ? error.message : 'インポートに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  return (
    <section>
      <PageTitle {...PAGE_TITLES.settings} />

      <section className={styles.card} aria-labelledby="backup-heading">
        <h2 id="backup-heading" className={styles.heading}>
          バックアップ
        </h2>
        <p className={styles.description}>
          タスクと繰り返しルールを JSON ファイルに保存したり、保存したファイルから復元したりできます。
        </p>

        <div className={styles.row}>
          <button type="button" className={styles.button} onClick={handleExport} disabled={exporting}>
            {exporting ? 'エクスポート中…' : 'JSONをエクスポート'}
          </button>
          <span className={styles.meta}>
            最終エクスポート：{lastExport ? formatDateTime(lastExport) : 'まだエクスポートしていません'}
          </span>
        </div>

        <div className={styles.row}>
          <button
            type="button"
            className={styles.button}
            onClick={() => fileInput.current?.click()}
            disabled={checking || importing}
          >
            {checking ? '確認中…' : importing ? 'インポート中…' : 'JSONをインポート...'}
          </button>
          <span className={styles.meta}>現在のデータはすべて置き換えられます</span>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className={styles.fileInput}
            onChange={handleFileChange}
            aria-label="インポートするファイル"
          />
        </div>

        {importError && (
          <p className={styles.error} role="alert">
            {importError}
          </p>
        )}
      </section>

      <AutoBackupSection onRestore={handleRestore} disabled={importing} />

      {pending && (
        <ConfirmDialog
          message="現在のデータはすべて置き換えられます。"
          detail={`タスク ${pending.summary.current.tasks}件 → ${pending.summary.incoming.tasks}件 ／ ルール ${pending.summary.current.rules}件 → ${pending.summary.incoming.rules}件`}
          confirmLabel="置き換える"
          danger
          onConfirm={() => handleImport(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </section>
  )
}

/** 自動バックアップ（毎日1回、サーバーが保存先フォルダーに JSON を保存する） */
function AutoBackupSection({ onRestore, disabled }: { onRestore: (name: string) => void; disabled: boolean }) {
  const { data, isError } = useQuery({ queryKey: ['backup', 'auto'], queryFn: fetchAutoBackupStatus })
  const { showToast } = useToast()

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path)
      showToast({ message: '保存先のパスをコピーしました' })
    } catch {
      showToast({ message: 'コピーできませんでした' })
    }
  }

  return (
    <section className={styles.card} aria-labelledby="auto-backup-heading">
      <h2 id="auto-backup-heading" className={styles.heading}>
        自動バックアップ
      </h2>
      {isError ? (
        <p className={styles.description}>状態を取得できませんでした</p>
      ) : !data ? (
        <p className={styles.description}>読み込み中…</p>
      ) : (
        <>
          <p className={styles.description}>
            アプリの起動時と毎日0時過ぎに1回、上のエクスポートと同じ JSON を自動で保存し、直近{data.keep}
            日分を残します。「復元」で、その時点の状態に戻せます。
          </p>
          <div className={styles.row}>
            <code className={styles.path}>{data.directory}</code>
            <button type="button" className={styles.smallButton} onClick={() => copyPath(data.directory)}>
              パスをコピー
            </button>
          </div>
          {data.files.length === 0 ? (
            <p className={styles.meta}>まだ保存されていません</p>
          ) : (
            <ul className={styles.fileList} aria-label="保存済みの自動バックアップ">
              {data.files.slice(0, 5).map((file) => (
                <li key={file.name}>
                  <span>{file.name}</span>
                  <span className={styles.meta}>
                    {file.createdAt ? formatDateTime(file.createdAt) : ''}・{Math.max(1, Math.round(file.size / 1024))}KB
                  </span>
                  <button
                    type="button"
                    className={styles.smallButton}
                    onClick={() => onRestore(file.name)}
                    disabled={disabled}
                    aria-label={`${file.name} から復元`}
                  >
                    復元
                  </button>
                </li>
              ))}
              {data.files.length > 5 && <li className={styles.meta}>ほか{data.files.length - 5}件</li>}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
