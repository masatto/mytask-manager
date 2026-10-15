import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ToastContext, type ToastOptions } from './useToast.ts'
import styles from './Toast.module.css'

const DURATION_MS = 5000

type ToastState = ToastOptions & { id: number }

/** 画面下部に1件だけ表示するトースト。新しいものが来たら置き換える */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((options: ToastOptions) => {
    setToast({ ...options, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = setTimeout(() => setToast(null), DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className={styles.toast}>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  toast.action?.onClick()
                  setToast(null)
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
