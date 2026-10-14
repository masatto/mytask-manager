import { NavLink } from 'react-router'
import { VIEWS } from '../views.ts'
import styles from './Sidebar.module.css'

function linkClass({ isActive }: { isActive: boolean }) {
  return isActive ? `${styles.link} ${styles.active}` : styles.link
}

export function Sidebar() {
  return (
    <nav className={styles.sidebar} aria-label="メインメニュー">
      <span className={styles.brand}>mytask-manager</span>
      <ul className={styles.list}>
        {VIEWS.map((view) => (
          <li key={view.key}>
            <NavLink to={view.path} className={linkClass}>
              {view.label}
            </NavLink>
          </li>
        ))}
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
