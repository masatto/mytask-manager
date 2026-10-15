import type { Priority } from '../api/types.ts'
import styles from './PriorityMark.module.css'

/**
 * 一覧での優先度の印。先にやるべきものに気づかせるのが目的なので、「高」だけに赤い印を付ける。
 * 大半を占める「中」と「低」は何も出さない（詳細パネルで確認・変更できる。並び順でも低い方が後ろに回る）。
 * 印がない行もタイトルの位置がそろうよう、場所（幅）は常に取っておく。
 */
export function PriorityMark({ priority }: { priority: Priority }) {
  return (
    <span className={styles.slot}>
      {priority === 'HIGH' && (
        <span className={styles.high} role="img" aria-label="優先度: 高">
          高
        </span>
      )}
    </span>
  )
}
