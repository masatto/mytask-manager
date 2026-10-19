import type { Task } from '../api/types.ts'
import { AreaBadge } from '../areas/AreaBadge.tsx'
import { useAreas } from '../areas/useAreas.ts'
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
  /** サブタスクの行（インデントして表示する） */
  isSubtask?: boolean
  /** 親自身はビューの条件を満たさず、サブタスクの文脈として出している（薄く表示する） */
  contextOnly?: boolean
  progress?: { done: number; total: number }
  /** サブタスクの開閉。指定がなければ開閉ボタンを出さない */
  expanded?: boolean
  onToggleExpand?: () => void
  /** 指定すると、行にマウスを乗せたとき「明日へ」ボタンを出す */
  onPostpone?: (task: Task) => void
}

function dueLabel(task: Task, groupDate: string | null): string {
  if (!task.dueDate) {
    return ''
  }
  const date = task.dueDate === groupDate ? '' : formatDate(task.dueDate)
  return [date, task.dueTime].filter(Boolean).join(' ')
}

export function TaskRow({
  task,
  groupDate,
  showCompletedTime,
  selected,
  checked,
  onToggle,
  onOpen,
  isSubtask = false,
  contextOnly = false,
  progress,
  expanded,
  onToggleExpand,
  onPostpone,
}: TaskRowProps) {
  // 絞り込んでいるときは全部同じエリアなので出さない。サブタスクは親と同じなので出さない
  const { areas, areaId } = useAreas()
  const area = areaId === null && !isSubtask ? areas.find((a) => a.id === task.areaId) : undefined
  const due = showCompletedTime
    ? task.completedAt && !contextOnly
      ? `完了 ${formatTime(task.completedAt)}`
      : ''
    : dueLabel(task, groupDate)

  const rowClass = [
    styles.row,
    isSubtask && styles.subtask,
    contextOnly && styles.context,
    selected && styles.selected,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rowClass}>
      {!isSubtask &&
        (onToggleExpand ? (
          <button
            type="button"
            className={styles.expander}
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={expanded ? 'サブタスクを閉じる' : 'サブタスクを開く'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className={styles.expander} aria-hidden="true" />
        ))}
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        onChange={(e) => onToggle(task, e.target.checked)}
        aria-label={`「${task.title}」を完了にする`}
      />
      <PriorityMark priority={task.priority} />
      {/* 左：タイトルと、そのタスクの状態（進行中・サブタスクの進み具合） */}
      <div className={styles.main}>
        {area && <AreaBadge area={area} />}
        <button
          type="button"
          className={checked ? `${styles.title} ${styles.done}` : styles.title}
          onClick={() => onOpen(task.id)}
        >
          {task.title}
        </button>
        {task.status === 'IN_PROGRESS' && <span className={styles.badge}>進行中</span>}
        {progress && progress.total > 0 && (
          <span
            className={progress.done === progress.total ? `${styles.progress} ${styles.progressDone}` : styles.progress}
            aria-label={`サブタスク ${progress.done}/${progress.total} 完了`}
          >
            ✓ {progress.done}/{progress.total}
          </span>
        )}
      </div>
      {onPostpone && (
        <button
          type="button"
          className={styles.postpone}
          onClick={() => onPostpone(task)}
          aria-label={`「${task.title}」を明日に延期`}
        >
          明日へ
        </button>
      )}
      {/* 右：「いつ」だけ。幅を固定して、全行で縦にそろえる（繰り返しの印の場所も常に取っておく） */}
      <span className={task.overdue ? `${styles.due} ${styles.overdue}` : styles.due}>{due}</span>
      <span className={styles.recurrence} role={task.recurrence ? 'img' : undefined} aria-label={task.recurrence ? '繰り返し' : undefined}>
        {task.recurrence ? '↻' : ''}
      </span>
    </div>
  )
}
