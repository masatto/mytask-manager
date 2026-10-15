import { createContext, useContext } from 'react'

export type ToastOptions = {
  message: string
  action?: { label: string; onClick: () => void }
}

export type ToastContextValue = {
  showToast: (options: ToastOptions) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (!value) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return value
}
