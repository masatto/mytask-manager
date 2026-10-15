import { ApiRequestError } from '../api/client.ts'
import { useTask } from '../hooks/useTasks.ts'
import { TaskEditForm } from './TaskEditForm.tsx'
import styles from './TaskDetailPanel.module.css'

type TaskDetailPanelProps = {
  taskId: number
  onClose: () => void
  onDeleted: () => void
  onDirtyChange: (dirty: boolean) => void
}

/** タスク詳細パネル（screen-design 4章） */
export function TaskDetailPanel({ taskId, onClose, onDeleted, onDirtyChange }: TaskDetailPanelProps) {
  const { data: task, isPending, isError, error } = useTask(taskId)

  return (
    <aside className={styles.panel} aria-label="タスク詳細">
      {isPending && (
        <>
          <PanelHeader onClose={onClose} />
          <p className={styles.message}>読み込み中…</p>
        </>
      )}
      {isError && (
        <>
          <PanelHeader onClose={onClose} />
          <p className={styles.message}>
            {error instanceof ApiRequestError && error.status === 404
              ? 'タスクが見つかりません'
              : '読み込みに失敗しました'}
          </p>
        </>
      )}
      {task && (
        <TaskEditForm
          key={task.id}
          task={task}
          onClose={onClose}
          onDeleted={onDeleted}
          onDirtyChange={onDirtyChange}
        />
      )}
    </aside>
  )
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.header}>
      <button type="button" className={styles.close} onClick={onClose} aria-label="閉じる">
        ×
      </button>
    </div>
  )
}
