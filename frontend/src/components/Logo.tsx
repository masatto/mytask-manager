import { useId } from 'react'
import { Link } from 'react-router'
import styles from './Logo.module.css'

/**
 * Orbit のマーク：中心の惑星（＝今日。チェックでタスクを表す）と、その周りを回る軌道と衛星（＝これからのタスク）。
 * public/favicon.svg も同じ形。グラデーションの id は画面内で重ならないよう useId で作る。
 */
export function LogoMark({ size = 30 }: { size?: number }) {
  const id = useId()
  const gradient = `${id}-gradient`
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <ellipse
        cx="16"
        cy="16"
        rx="14.5"
        ry="6.5"
        transform="rotate(-28 16 16)"
        fill="none"
        stroke={`url(#${gradient})`}
        strokeWidth="2.2"
        opacity="0.55"
      />
      <circle cx="16" cy="16" r="9" fill={`url(#${gradient})`} />
      <path
        d="M11.8 16.4l2.9 2.9 5.5-6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="27" cy="7.65" r="2.8" fill="#7c3aed" stroke="#fff" strokeWidth="1.4" />
    </svg>
  )
}

/** サイドバー上部のロゴ。クリックで Today へ */
export function Logo() {
  return (
    <Link to="/today" className={styles.logo} aria-label="Orbit（Today へ）">
      <LogoMark />
      <span className={styles.wordmark} aria-hidden="true">
        Orbit
      </span>
    </Link>
  )
}
