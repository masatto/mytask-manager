import { useMutation, useQueryClient } from '@tanstack/react-query'
import { backupKeys, runBackupNow } from '../../api/backup.ts'
import { useAutoBackupStatus } from '../../hooks/useBackup.ts'
import { formatDateTime } from '../../lib/date.ts'
import { useToast } from '../../toast/useToast.ts'
import { MirrorSetting } from './MirrorSetting.tsx'
import styles from './settings.module.css'

/** 一覧に出す件数（残りは「ほかN件」） */
const VISIBLE_FILES = 5

type AutoBackupSectionProps = {
  /** 「復元」を押したら、検証して確認ダイアログを出す（useBackupImport） */
  onRestore: (name: string) => void
  disabled: boolean
}

/** 自動バックアップ（毎日1回、サーバーが保存先フォルダーに JSON を保存する） */
export function AutoBackupSection({ onRestore, disabled }: AutoBackupSectionProps) {
  const { data, isError } = useAutoBackupStatus()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const runNow = useMutation({
    mutationFn: runBackupNow,
    onSuccess: (status) => {
      queryClient.setQueryData(backupKeys.auto, status)
      showToast({ message: status.mirrorError ? 'バックアップしました（コピー先には写せませんでした）' : 'バックアップしました' })
    },
    onError: () => showToast({ message: 'バックアップできませんでした' }),
  })

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
            アプリの起動時と毎日0時過ぎに1回、手動バックアップと同じ JSON を自動で保存し、直近{data.keep}
            日分を残します（保存場所は上の「② 自動バックアップ」）。「復元」で、その時点の状態に戻せます。
          </p>
          {data.files.length === 0 ? (
            <p className={styles.meta}>まだ保存されていません</p>
          ) : (
            <ul className={styles.fileList} aria-label="保存済みの自動バックアップ">
              {data.files.slice(0, VISIBLE_FILES).map((file) => (
                <li key={file.name}>
                  <span>{file.name}</span>
                  <span className={styles.meta}>
                    {file.createdAt ? formatDateTime(file.createdAt) : ''}・{Math.max(1, Math.round(file.size / 1024))}KB
                  </span>
                  {file.name.startsWith('mytask-manager-') && (
                    <span className={styles.note} title="アプリ名を Orbit に変える前に作られたファイルです。14日たつと自動で消えます">
                      名前変更前
                    </span>
                  )}
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
              {data.files.length > VISIBLE_FILES && (
                <li className={styles.meta}>ほか{data.files.length - VISIBLE_FILES}件</li>
              )}
            </ul>
          )}
          <MirrorSetting current={data.mirrorDirectory} error={data.mirrorError} files={data.mirrorFiles} />
          <div className={styles.row}>
            <button
              type="button"
              className={styles.smallButton}
              onClick={() => runNow.mutate()}
              disabled={runNow.isPending}
            >
              {runNow.isPending ? '保存中…' : '今すぐバックアップ'}
            </button>
            <span className={styles.meta}>今日の分を今の内容で作り直します（コピー先にも写します）</span>
          </div>
        </>
      )}
    </section>
  )
}
