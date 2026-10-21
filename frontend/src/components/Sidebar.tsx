import { useEffect } from 'react'
import { NavLink } from 'react-router'
import type { TaskCounts } from '../api/types.ts'
import { AreaTabs } from '../areas/AreaTabs.tsx'
import { useTaskCounts } from '../hooks/useTasks.ts'
import { PAGE_TITLES, VIEWS, type ViewKey } from '../views.ts'
import { Logo } from './Logo.tsx'
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
    document.title = counts && counts.today > 0 ? `(${counts.today}) Orbit` : 'Orbit'
  }, [counts])

  return (
    <nav className={styles.sidebar} aria-label="メインメニュー">
      <Logo />
      <AreaTabs />
      <SearchBox />
      <ul className={styles.list}>
        {VIEWS.map((view) => {
          const count = countOf(view.key, counts)
          const alert = view.key === 'today' && (counts?.overdue ?? 0) > 0
          return (
            <li key={view.key}>
              <NavLink to={view.path} className={linkClass}>
                <NavLabel label={view.label} sub={view.sub} />
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
            <NavLabel {...PAGE_TITLES.rules} />
          </NavLink>
        </li>
        <li>
          <NavLink to="/progress" className={linkClass}>
            <NavLabel {...PAGE_TITLES.progress} />
          </NavLink>
        </li>
        <li>
          <NavLink to="/plan" className={linkClass}>
            <NavLabel {...PAGE_TITLES.plan} />
          </NavLink>
        </li>
        <li>
          <NavLink to="/settings" className={linkClass}>
            <NavLabel {...PAGE_TITLES.settings} />
          </NavLink>
        </li>
      </ul>
      <p className={styles.shortcuts} aria-label="キーボードショートカット">
        <kbd>N</kbd> 追加 ・ <kbd>/</kbd> 検索 ・ <kbd>Esc</kbd> 閉じる
      </p>
    </nav>
  )
}

/** メニューの項目名。英語を大きく、日本語を小さく2段で出す */
function NavLabel({ label, sub }: { label: string; sub: string }) {
  return (
    <span className={styles.labels}>
      <span className={styles.labelEn}>{label}</span> <span className={styles.labelJa}>{sub}</span>
    </span>
  )
}
