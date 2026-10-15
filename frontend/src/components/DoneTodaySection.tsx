import { useState } from 'react'
import { useDoneTodayList } from '../hooks/useTasks.ts'
import { todayKey } from '../lib/date.ts'
import { TaskGroups } from './TaskGroups.tsx'
import styles from './DoneTodaySection.module.css'

type DoneTodaySectionProps = {
  selectedId: number | null
  onOpen: (id: number) => void
}

/**
 * Today の一番下の「今日完了」。今日完了にしたタスクを、完了日時の新しい順に並べる（初めは閉じておく）。
 * 件数は見出しの「N件完了」と同じ基準。チェックを外すと未完了に戻り、上の一覧に戻る。
 */
export function DoneTodaySection({ selectedId, onOpen }: DoneTodaySectionProps) {
  const { data } = useDoneTodayList()
  const [open, setOpen] = useState(false)

  if (!data || data.items.length === 0) {
    return null
  }
  return (
    <section className={styles.section} aria-label="今日完了">
      <h2 className={styles.heading}>
        <button type="button" className={styles.toggle} onClick={() => setOpen(!open)} aria-expanded={open}>
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
          今日完了
          <span className={styles.count}>{data.items.length}</span>
        </button>
      </h2>
      {open && (
        <TaskGroups
          groups={[{ key: 'done-today', label: null, emphasized: false, date: todayKey(), items: data.items }]}
          showCompletedTime
          selectedId={selectedId}
          onOpen={onOpen}
        />
      )}
    </section>
  )
}
