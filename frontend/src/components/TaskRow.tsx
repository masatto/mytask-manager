import type { Task } from '../api/types.ts'
import { formatDate, formatTime } from '../lib/date.ts'
import { PriorityMark } from './PriorityMark.tsx'
import styles from './TaskRow.module.css'

type TaskRowProps = {
  task: Task
  /** 所属グループの日付。期限がこの日付なら日付の表示を省略する */
  groupDate: string | null
  /** 完了済みビューでは期限の代わりに完了時刻を出す */
  showCompletedTime: boolean
  selected: boolean
  /** 送信中ならその変更先を反映したチェック状態 */
  checked: boolean
  onToggle: (task: Task, done: boolean) => void
  onOpen: (id: number) => void
}

function dueLabel(task: Task, groupDate: string | null): string {
  if (!task.dueDate) {
    return ''
  }
  const date = task.dueDate === groupDate ? '' : formatDate(task.dueDate)
  return [date, task.dueTime].filter(Boolean).join(' ')
}

export function TaskRow({ task, groupDate, showCompletedTime, selected, checked, onToggle, onOpen }: TaskRowProps) {
  const due = showCompletedTime && task.completedAt ? `完了 ${formatTime(task.completedAt)}` : dueLabel(task, groupDate)

  return (
    <li className={selected ? `${styles.row} ${styles.selected}` : styles.row}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        onChange={(e) => onToggle(task, e.target.checked)}
        aria-label={`「${task.title}」を完了にする`}
      />
      <PriorityMark priority={task.priority} />
      <button
        type="button"
        className={checked ? `${styles.title} ${styles.done}` : styles.title}
        onClick={() => onOpen(task.id)}
      >
        {task.title}
      </button>
      {task.status === 'IN_PROGRESS' && <span className={styles.badge}>進行中</span>}
      {due && <span className={task.overdue ? `${styles.due} ${styles.overdue}` : styles.due}>{due}</span>}
      {task.recurrence && (
        <span className={styles.recurrence} role="img" aria-label="繰り返し">
          ↻
        </span>
      )}
    </li>
  )
}
