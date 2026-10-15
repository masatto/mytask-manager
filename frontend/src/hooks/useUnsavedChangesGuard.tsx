import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'

/**
 * パネルに未保存の変更があるときの画面遷移を止め、D4「変更を破棄しますか？」を出す（screen-design 6章）。
 * パネルの開閉・切り替え、サイドバーのリンク、ブラウザの戻る/進むのすべてが対象。
 * タブを閉じる・再読み込みするときは、ブラウザ標準の確認を出す。
 *
 * dialog は呼び出し側で描画すること。
 */
export function useUnsavedChangesGuard() {
  // 遷移の瞬間に最新の値を読めるよう、state ではなく ref で持つ（保存直後に閉じる場合などに古い値を見ないため）
  const dirtyRef = useRef(false)

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current &&
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  )

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
  }, [])

  const dialog = blocker.state === 'blocked' && (
    <ConfirmDialog
      message="変更を破棄しますか？"
      confirmLabel="破棄"
      cancelLabel="編集に戻る"
      danger
      onConfirm={() => {
        dirtyRef.current = false
        blocker.proceed()
      }}
      onCancel={() => blocker.reset()}
    />
  )

  return { setDirty, dialog }
}
