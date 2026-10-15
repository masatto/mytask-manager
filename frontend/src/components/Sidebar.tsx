import { useEffect } from 'react'
import { NavLink } from 'react-router'
import type { TaskCounts } from '../api/types.ts'
import { useTaskCounts } from '../hooks/useTasks.ts'
import { VIEWS, type ViewKey } from '../views.ts'
import { SearchBox } from './SearchBox.tsx'
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

  // ブラウザのタブにも「今日」の件数を出す（ほかのタブで作業中でも気づけるように）
  useEffect(() => {
    document.title = counts && counts.today > 0 ? `(${counts.today}) mytask-manager` : 'mytask-manager'
  }, [counts])

  return (
    <nav className={styles.sidebar} aria-label="メインメニュー">
      <span className={styles.brand}>mytask-manager</span>
      <SearchBox />
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
      <p className={styles.shortcuts} aria-label="キーボードショートカット">
        <kbd>N</kbd> 追加 ・ <kbd>/</kbd> 検索 ・ <kbd>Esc</kbd> 閉じる
      </p>
    </nav>
  )
}
