import { useTaskCounts } from '../hooks/useTasks.ts'
import styles from './TodayProgress.module.css'

/**
 * Today の進み具合。今日完了にした数 ／（それ ＋ 今日の残り）。
 * 残りは Today ビューの行数（期限切れを含む）。今日完了にしたものは期限に関係なく数える。
 */
export function TodayProgress() {
  const { data } = useTaskCounts()
  if (!data) {
    return null
  }
  const done = data.doneToday
  const total = done + data.today
  if (total === 0) {
    return null
  }
  const percent = Math.round((done / total) * 100)
  return (
    <span className={styles.progress} role="img" aria-label={`今日の進み具合：${total}件中${done}件完了`}>
      <span className={styles.bar}>
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </span>
      <span className={styles.text}>
        {done}/{total} 完了
      </span>
    </span>
  )
}
