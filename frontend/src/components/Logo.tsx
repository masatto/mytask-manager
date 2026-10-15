import { useId } from 'react'
import { Link } from 'react-router'
import styles from './Logo.module.css'

/**
 * ロゴのマーク：重なったカード（タスク）とチェック。public/favicon.svg も同じ形。
 * グラデーションの id は画面内で重ならないよう useId で作る。
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  const gradientId = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect x="8" y="2" width="22" height="22" rx="6" fill={`url(#${gradientId})`} opacity="0.3" />
      <rect x="2" y="8" width="22" height="22" rx="6" fill={`url(#${gradientId})`} />
      <path d="M7.5 19.5l4 4 8-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** サイドバー上部のロゴ。クリックで「今日」へ */
export function Logo() {
  return (
    <Link to="/today" className={styles.logo} aria-label="mytask-manager（今日へ）">
      <LogoMark size={30} />
      <span className={styles.wordmark} aria-hidden="true">
        <span className={styles.strong}>mytask</span>
        <span className={styles.light}>manager</span>
      </span>
    </Link>
  )
}
