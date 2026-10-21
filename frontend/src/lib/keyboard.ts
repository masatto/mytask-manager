import type { KeyboardEvent } from 'react'

/**
 * Enter で確定する入力欄の onKeyDown を作る。日本語入力の変換確定の Enter では action を呼ばない
 * （変換を確定しただけで保存・追加されてしまわないように）。
 */
export function onEnter(action: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      action()
    }
  }
}
