import { useRef, useState, type ChangeEvent } from 'react'
import { exportBackup } from '../../api/backup.ts'
import { formatDateTime } from '../../lib/date.ts'
import { useToast } from '../../toast/useToast.ts'
import styles from './settings.module.css'

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

type ManualBackupSectionProps = {
  /** ファイルを選んだら、検証して確認ダイアログを出す（useBackupImport） */
  onFileSelected: (file: File) => void
  checking: boolean
  importing: boolean
  importError: string | null
}

/** 手動バックアップ：JSON のエクスポートと、ファイルからの取り込み */
export function ManualBackupSection({ onFileSelected, checking, importing, importError }: ManualBackupSectionProps) {
  const { showToast } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [lastExport, setLastExport] = useState(readLastExport)
  const [exporting, setExporting] = useState(false)

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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // 同じファイルを選び直しても change が起きるように空にしておく
    e.target.value = ''
    if (file) {
      onFileSelected(file)
    }
  }

  return (
    <section className={styles.card} aria-labelledby="backup-heading">
      <h2 id="backup-heading" className={styles.heading}>
        手動バックアップ
      </h2>
      <p className={styles.description}>
        好きなときに、タスクと繰り返しルールを JSON ファイルに保存できます（ブラウザのダウンロード先に保存されます）。
        保存したファイルを取り込むと、その時点の状態に戻せます。
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
  )
}
