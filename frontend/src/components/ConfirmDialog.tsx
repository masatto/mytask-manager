import { useEffect, useRef } from 'react'
import styles from './ConfirmDialog.module.css'

type ConfirmDialogProps = {
  message: string
  /** 補足（件数など）。本文の下に別の行で出す */
  detail?: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 確認ダイアログ（screen-design 6章の D1〜D4） */
export function ConfirmDialog({
  message,
  detail,
  confirmLabel,
  cancelLabel = 'キャンセル',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // 誤操作を防ぐため、初期フォーカスはキャンセル側に置く
    cancelRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label={message}
        aria-describedby={detail ? 'confirm-dialog-detail' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={styles.message}>{message}</p>
        {detail && (
          <p id="confirm-dialog-detail" className={styles.detail}>
            {detail}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" ref={cancelRef} className={styles.cancel} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? `${styles.confirm} ${styles.danger}` : styles.confirm}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
