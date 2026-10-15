import type { TaskGroup } from '../lib/grouping.ts'
import { useToggleComplete } from '../hooks/useTasks.ts'
import { TaskRow } from './TaskRow.tsx'
import styles from './TaskGroups.module.css'

type TaskGroupsProps = {
  groups: TaskGroup[]
  showCompletedTime: boolean
  selectedId: number | null
  onOpen: (id: number) => void
}

export function TaskGroups({ groups, showCompletedTime, selectedId, onOpen }: TaskGroupsProps) {
  const { toggle, pending } = useToggleComplete()

  return (
    <div className={styles.groups}>
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label ?? undefined}>
          {group.label && (
            <h2 className={group.emphasized ? `${styles.heading} ${styles.emphasized}` : styles.heading}>
              {group.label}
              <span className={styles.count}>{group.items.length}</span>
            </h2>
          )}
          <ul className={styles.list}>
            {group.items.map(({ task }) => (
              <TaskRow
                key={task.id}
                task={task}
                groupDate={group.date}
                showCompletedTime={showCompletedTime}
                selected={task.id === selectedId}
                checked={pending?.task.id === task.id ? pending.status === 'DONE' : task.status === 'DONE'}
                onToggle={toggle}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
