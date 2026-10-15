import { useState } from 'react'
import type { Task } from '../api/types.ts'
import { useReschedule } from '../hooks/useReschedule.ts'
import { isChecked, useToggleComplete } from '../hooks/useToggleComplete.tsx'
import { addDays, todayKey } from '../lib/date.ts'
import type { TaskGroup } from '../lib/grouping.ts'
import { TaskRow } from './TaskRow.tsx'
import styles from './TaskGroups.module.css'

type TaskGroupsProps = {
  groups: TaskGroup[]
  showCompletedTime: boolean
  selectedId: number | null
  onOpen: (id: number) => void
}

export function TaskGroups({ groups, showCompletedTime, selectedId, onOpen }: TaskGroupsProps) {
  const { toggle, pending, confirmDialog } = useToggleComplete()
  const reschedule = useReschedule()
  const today = todayKey()
  // 期限が今日以前の未完了タスクだけ「明日へ」を出す
  const postponeFor = (task: Task) =>
    task.status !== 'DONE' && task.dueDate !== null && task.dueDate <= today
      ? () => reschedule([task], addDays(today, 1), `「${task.title}」を明日に延期しました`)
      : undefined

  /** 期限切れのグループにある、期限切れの未完了タスク（親・サブタスク） */
  const overdueTasks = (group: TaskGroup) =>
    group.items.flatMap(({ task, subtasks }) => [task, ...subtasks].filter((t) => t.overdue && t.status !== 'DONE'))
  // 初期状態はすべて開いた状態。閉じた親のIDだけを持つ
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set())

  const toggleExpand = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  return (
    <div className={styles.groups}>
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label ?? undefined}>
          {group.label && (
            <h2 className={group.emphasized ? `${styles.heading} ${styles.emphasized}` : styles.heading}>
              {group.label}
              <span className={styles.count}>{group.items.length}</span>
              {group.key === 'overdue' && overdueTasks(group).length > 0 && (
                <button
                  type="button"
                  className={styles.groupAction}
                  onClick={() => {
                    const tasks = overdueTasks(group)
                    reschedule(tasks, today, `期限切れの${tasks.length}件を今日にしました`)
                  }}
                >
                  すべて今日へ
                </button>
              )}
            </h2>
          )}
          <ul className={styles.list}>
            {group.items.map(({ task, subtasks, contextOnly, progress }) => {
              const expanded = !collapsed.has(task.id)
              return (
                <li key={task.id}>
                  <TaskRow
                    task={task}
                    groupDate={group.date}
                    showCompletedTime={showCompletedTime}
                    selected={task.id === selectedId}
                    checked={isChecked(task, pending)}
                    onToggle={toggle}
                    onOpen={onOpen}
                    contextOnly={contextOnly}
                    progress={progress}
                    expanded={subtasks.length > 0 ? expanded : undefined}
                    onToggleExpand={subtasks.length > 0 ? () => toggleExpand(task.id) : undefined}
                    onPostpone={postponeFor(task)}
                  />
                  {subtasks.length > 0 && expanded && (
                    <ul className={styles.list} aria-label={`「${task.title}」のサブタスク`}>
                      {subtasks.map((sub) => (
                        <li key={sub.id}>
                          <TaskRow
                            task={sub}
                            groupDate={group.date}
                            showCompletedTime={showCompletedTime}
                            selected={sub.id === selectedId}
                            checked={isChecked(sub, pending)}
                            onToggle={toggle}
                            onOpen={onOpen}
                            isSubtask
                            onPostpone={postponeFor(sub)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {confirmDialog}
    </div>
  )
}
