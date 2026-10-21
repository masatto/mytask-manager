import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { backupKeys, setBackupMirror, type AutoBackupStatus } from '../../api/backup.ts'
import { ApiRequestError } from '../../api/client.ts'
import { formatDateTime } from '../../lib/date.ts'
import { useToast } from '../../toast/useToast.ts'
import styles from './settings.module.css'

type MirrorSettingProps = {
  current: string | null
  error: string | null
  files: AutoBackupStatus['mirrorFiles']
}

/**
 * 自動バックアップのコピー先。OneDrive などの同期フォルダーを指定すると、この PC のディスクが壊れても
 * バックアップが残る。指定するとすぐに今あるバックアップを写す。
 */
export function MirrorSetting({ current, error, files }: MirrorSettingProps) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [value, setValue] = useState(current ?? '')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (dir: string | null) => setBackupMirror(dir),
    onSuccess: (status) => {
      queryClient.setQueryData(backupKeys.auto, status)
      setValue(status.mirrorDirectory ?? '')
      setFieldError(null)
      showToast({ message: status.mirrorDirectory ? 'コピー先を設定しました' : 'コピー先を解除しました' })
    },
    onError: (e) =>
      setFieldError(e instanceof ApiRequestError && e.fieldErrors[0] ? e.fieldErrors[0].message : '設定できませんでした'),
  })

  return (
    <div className={styles.mirror}>
      <label className={styles.mirrorLabel} htmlFor="backup-mirror">
        コピー先（任意）：OneDrive などの同期フォルダーを指定すると、この PC が壊れてもバックアップが残ります
      </label>
      <div className={styles.row}>
        <input
          id="backup-mirror"
          className={styles.textInput}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="例：C:\Users\あなた\OneDrive\Orbit"
          spellCheck={false}
        />
        <button
          type="button"
          className={styles.smallButton}
          onClick={() => save.mutate(value.trim() || null)}
          disabled={save.isPending || value.trim() === (current ?? '')}
        >
          保存
        </button>
        {current && (
          <button type="button" className={styles.smallButton} onClick={() => save.mutate(null)} disabled={save.isPending}>
            解除
          </button>
        )}
      </div>
      {fieldError && <p className={styles.error}>{fieldError}</p>}
      {!fieldError && error && (
        <p className={styles.error} role="alert">
          コピー先に写せませんでした：{error}
        </p>
      )}
      {!fieldError && !error && current && (
        <p className={styles.ok}>
          ✓ コピー済み {files.length}件
          {files[0]?.createdAt && `（最新 ${files[0].name}・${formatDateTime(files[0].createdAt)}）`}
        </p>
      )}
    </div>
  )
}
