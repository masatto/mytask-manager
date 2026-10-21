import { useTaskCounts } from '../hooks/useTasks.ts'
import { formatEstimate } from '../lib/estimate.ts'
import styles from './TodayProgress.module.css'

/**
 * Today の進み具合。「N件完了・残りM件」とバー（N ／ (N＋M)）。
 * 完了は今日完了にした親タスクの数で、Today の一番下の「今日完了」に並ぶものと同じ。残りは Today ビューの行数（期限切れを含む）。
 * 残りの作業に目安があれば「目安 3h30m」も添えて、今日の予定を詰め込みすぎていないか分かるようにする。
 */
export function TodayProgress() {
  const { data } = useTaskCounts()
  // 古いバックエンド（doneToday を返さない）につながっているときは出さない
  if (!data || typeof data.doneToday !== 'number') {
    return null
  }
  const done = data.doneToday
  const total = done + data.today
  if (total === 0) {
    return null
  }
  const percent = Math.round((done / total) * 100)
  const estimate = data.today > 0 && data.todayEstimateMinutes != null ? formatEstimate(data.todayEstimateMinutes) : ''
  return (
    <span
      className={styles.progress}
      role="img"
      aria-label={`今日の進み具合：${done}件完了、残り${data.today}件${estimate && `、残りの目安${estimate}`}`}
    >
      <span className={styles.bar}>
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </span>
      <span className={styles.text}>
        {done}件完了・残り{data.today}件
        {estimate && <span className={styles.estimate}>・目安 {estimate}</span>}
      </span>
    </span>
  )
}
