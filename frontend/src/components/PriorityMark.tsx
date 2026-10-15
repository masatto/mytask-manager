import { PRIORITY_LABELS, type Priority } from '../api/types.ts'
import styles from './PriorityMark.module.css'

const MARKS: Record<Priority, string> = {
  HIGH: '●',
  MEDIUM: '◐',
  LOW: '○',
}

export function PriorityMark({ priority }: { priority: Priority }) {
  return (
    <span
      className={`${styles.mark} ${styles[priority.toLowerCase()]}`}
      role="img"
      aria-label={`優先度: ${PRIORITY_LABELS[priority]}`}
    >
      {MARKS[priority]}
    </span>
  )
}
