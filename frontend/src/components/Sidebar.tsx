import { NavLink } from 'react-router'
import type { TaskCounts } from '../api/types.ts'
import { useTaskCounts } from '../hooks/useTasks.ts'
import { VIEWS, type ViewKey } from '../views.ts'
import styles from './Sidebar.module.css'

function linkClass({ isActive }: { isActive: boolean }) {
  return isActive ? `${styles.link} ${styles.active}` : styles.link
}

/** サイドバーに出す件数。完了済みには出さない（screen-design 2章） */
function countOf(view: ViewKey, counts: TaskCounts | undefined): number | undefined {
  switch (view) {
    case 'today':
      return counts?.today
    case 'upcoming':
      return counts?.upcoming
    case 'no-due':
      return counts?.noDue
    case 'done':
      return undefined
  }
}

export function Sidebar() {
  const { data: counts } = useTaskCounts()

  return (
    <nav className={styles.sidebar} aria-label="メインメニュー">
      <span className={styles.brand}>mytask-manager</span>
      <ul className={styles.list}>
        {VIEWS.map((view) => {
          const count = countOf(view.key, counts)
          const alert = view.key === 'today' && (counts?.overdue ?? 0) > 0
          return (
            <li key={view.key}>
              <NavLink to={view.path} className={linkClass}>
                {view.label}
                {count !== undefined && count > 0 && (
                  <span
                    className={alert ? `${styles.count} ${styles.alert}` : styles.count}
                    aria-label={alert ? `${count}件（期限切れあり）` : `${count}件`}
                  >
                    {count}
                  </span>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
      <hr className={styles.divider} />
      <ul className={styles.list}>
        <li>
          <NavLink to="/rules" className={linkClass}>
            繰り返しルール
          </NavLink>
        </li>
        <li>
          <NavLink to="/settings" className={linkClass}>
            設定
          </NavLink>
        </li>
      </ul>
    </nav>
  )
}
