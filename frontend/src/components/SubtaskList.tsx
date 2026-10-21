import type { Task } from '../api/types.ts'
import { formatDate } from '../lib/date.ts'
import { formatEstimate } from '../lib/estimate.ts'
import { PriorityMark } from './PriorityMark.tsx'
import { QuickAdd } from './QuickAdd.tsx'
import styles from './TaskEditForm.module.css'

type SubtaskListProps = {
  parentId: number
  subtasks: Task[]
  /** 送信中ならその変更先を反映したチェック状態（useToggleComplete の isChecked） */
  isChecked: (task: Task) => boolean
  onToggle: (task: Task, done: boolean) => void
  onOpen: (id: number) => void
}

/** 詳細パネルのサブタスク：進み具合・一覧・追加欄 */
export function SubtaskList({ parentId, subtasks, isChecked, onToggle, onOpen }: SubtaskListProps) {
  const done = subtasks.filter((s) => s.status === 'DONE').length
  return (
    <section className={styles.subtasks} aria-label="サブタスク">
      <h3 className={styles.subtasksHeading}>
        サブタスク
        {subtasks.length > 0 && (
          <span className={styles.subtasksCount}>
            {done}/{subtasks.length}
          </span>
        )}
      </h3>
      <ul className={styles.subtaskList}>
        {subtasks.map((sub) => (
          <SubtaskItem key={sub.id} task={sub} checked={isChecked(sub)} onToggle={onToggle} onOpen={onOpen} />
        ))}
      </ul>
      <QuickAdd dueDate={null} parentId={parentId} placeholder="サブタスクを追加（例：明日 指摘1の修正）" compact />
    </section>
  )
}

type SubtaskItemProps = {
  task: Task
  checked: boolean
  onToggle: (task: Task, done: boolean) => void
  onOpen: (id: number) => void
}

function SubtaskItem({ task, checked, onToggle, onOpen }: SubtaskItemProps) {
  const due = task.dueDate ? [formatDate(task.dueDate), task.dueTime].filter(Boolean).join(' ') : ''
  return (
    <li className={styles.subtaskItem}>
      <input
        type="checkbox"
        className={styles.subtaskCheckbox}
        checked={checked}
        onChange={(e) => onToggle(task, e.target.checked)}
        aria-label={`「${task.title}」を完了にする`}
      />
      <button
        type="button"
        className={checked ? `${styles.subtaskTitle} ${styles.subtaskDone}` : styles.subtaskTitle}
        onClick={() => onOpen(task.id)}
      >
        {task.title}
      </button>
      <PriorityMark priority={task.priority} />
      {task.estimateMinutes != null && (
        <span className={styles.subtaskEstimate} aria-label={`目安 ${formatEstimate(task.estimateMinutes)}`}>
          {formatEstimate(task.estimateMinutes)}
        </span>
      )}
      {due && <span className={task.overdue ? `${styles.subtaskDue} ${styles.overdue}` : styles.subtaskDue}>{due}</span>}
    </li>
  )
}
