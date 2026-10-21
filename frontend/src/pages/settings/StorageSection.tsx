import type { AutoBackupStatus } from '../../api/backup.ts'
import type { SystemInfo } from '../../api/system.ts'
import { useAutoBackupStatus, useSystemInfo } from '../../hooks/useBackup.ts'
import { useToast } from '../../toast/useToast.ts'
import styles from './settings.module.css'

type StorageRow = {
  label: string
  path: string | null
  /** path がないときに代わりに出す説明 */
  placeholder?: string
  description: string
}

/** Orbit がファイルを置く場所と、それぞれの役割・触ってよいか */
function storageRows(system: SystemInfo, auto: AutoBackupStatus | undefined): StorageRow[] {
  return [
    {
      label: '① データ本体',
      path: system.dataDirectory,
      description:
        'タスクと繰り返しルールの「今のデータ」（mytask.mv.db）と、この画面の設定。アプリが使用中なので触らないでください',
    },
    {
      label: '② 自動バックアップ',
      path: system.backupDirectory,
      description: '毎日1回保存する JSON（直近14日分）。見るのは自由で、消しても①には影響しません',
    },
    {
      label: '③ コピー先',
      path: auto?.mirrorDirectory ?? null,
      placeholder: '未設定（下の「自動バックアップ」で指定できます）',
      description: '②と同じファイルのコピー。この PC が壊れたときの保険です',
    },
    {
      label: '④ ログ',
      path: system.logFile,
      placeholder: '開発用の起動（start-dev.bat）ではファイルに残しません',
      description: 'アプリの動作記録。起動しないときなどに確認します',
    },
    {
      label: '⑤ 手動バックアップ',
      path: null,
      placeholder: 'ブラウザのダウンロード先（ふつうは「ダウンロード」フォルダー）',
      description: '下の「手動バックアップ」で保存したファイル',
    },
  ]
}

/**
 * 保存場所：Orbit がファイルを置く場所と、それぞれの役割・触ってよいかをまとめて示す。
 * 場所ごとの説明を一か所に集め、ほかのカードにはパスを出さない。
 */
export function StorageSection() {
  const system = useSystemInfo()
  const auto = useAutoBackupStatus()
  const { showToast } = useToast()

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path)
      showToast({ message: 'パスをコピーしました' })
    } catch {
      showToast({ message: 'コピーできませんでした' })
    }
  }

  return (
    <section className={styles.card} aria-labelledby="storage-heading">
      <h2 id="storage-heading" className={styles.heading}>
        保存場所
      </h2>
      <p className={styles.description}>Orbit のデータとバックアップは、次の場所に置かれます。</p>
      {system.isError ? (
        <p className={styles.description}>情報を取得できませんでした</p>
      ) : !system.data ? (
        <p className={styles.description}>読み込み中…</p>
      ) : (
        <dl className={styles.storage}>
          {storageRows(system.data, auto.data).map((row) => (
            <div key={row.label} className={styles.storageRow}>
              <dt>{row.label}</dt>
              <dd>
                <div className={styles.storagePath}>
                  {row.path ? (
                    <>
                      <code className={styles.path}>{row.path}</code>
                      <button
                        type="button"
                        className={styles.smallButton}
                        onClick={() => copyPath(row.path!)}
                        aria-label={`${row.label}のパスをコピー`}
                      >
                        パスをコピー
                      </button>
                    </>
                  ) : (
                    <span className={styles.meta}>{row.placeholder}</span>
                  )}
                </div>
                <p className={styles.storageNote}>{row.description}</p>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
