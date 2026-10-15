import { useNavigate, useSearchParams } from 'react-router'
import { TaskDetailPanel } from '../components/TaskDetailPanel.tsx'
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard.tsx'

/**
 * タスク詳細パネル（S2）の開閉を URL の ?task={id} で管理する。一覧画面と検索画面で共通。
 * 未保存の変更があるときの画面遷移には D4 を出す。
 *
 * panel は呼び出し側で描画すること。
 */
export function useTaskPanel() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const selectedId = Number(searchParams.get('task')) || null
  const { setDirty, dialog } = useUnsavedChangesGuard()

  const open = (id: number) => {
    if (id !== selectedId) {
      setSearchParams((prev) => {
        prev.set('task', String(id))
        return prev
      })
    }
  }
  const close = () =>
    setSearchParams((prev) => {
      prev.delete('task')
      return prev
    })

  const panel = (
    <>
      {selectedId && (
        <TaskDetailPanel
          key={selectedId}
          taskId={selectedId}
          onClose={close}
          onDeleted={close}
          onOpenTask={open}
          onOpenRule={(ruleId) => navigate(`/rules?rule=${ruleId}`)}
          onDirtyChange={setDirty}
        />
      )}
      {dialog}
    </>
  )

  return { selectedId, open, panel }
}
