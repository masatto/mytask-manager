import { useEffect } from 'react'

const FORM_FIELD = 'input, textarea, select, [contenteditable="true"]'

/**
 * キーボードショートカット。
 * - N：クイック追加の入力欄へ移動（クイック追加がある画面のみ）
 * - /：検索欄へ移動
 * - Esc：入力欄にいるときは入力欄から抜ける。それ以外は開いているパネルを閉じる
 *
 * 入力中の文字や確認ダイアログの操作を奪わないよう、入力欄にいるときと確認ダイアログが出ているときは
 * Esc で入力欄から抜ける以外は何もしない。対象の要素は data-hotkey 属性で探す。
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || document.querySelector('[role="alertdialog"]')) {
        return
      }
      const target = e.target instanceof HTMLElement ? e.target : null
      if (target?.closest(FORM_FIELD)) {
        if (e.key === 'Escape') {
          target.blur()
        }
        return
      }
      const focus = (name: string) => {
        const el = document.querySelector<HTMLElement>(`[data-hotkey="${name}"]`)
        if (el) {
          e.preventDefault()
          el.focus()
        }
      }
      if (e.key === 'n' || e.key === 'N') {
        focus('quick-add')
      } else if (e.key === '/') {
        focus('search')
      } else if (e.key === 'Escape') {
        document.querySelector<HTMLElement>('[data-hotkey="close-panel"]')?.click()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
