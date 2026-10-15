import type { ReactNode } from 'react'
import styles from './PageTitle.module.css'

type PageTitleProps = {
  /** 英語の見出し（大きく表示） */
  label: string
  /** 日本語の見出し（小さく添える） */
  sub: string
  /** 見出しの右に並べる補足（今日の日付・検索語など） */
  extra?: ReactNode
}

/** ページの見出し。英語＋日本語の2段 */
export function PageTitle({ label, sub, extra }: PageTitleProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>
        <span className={styles.label}>{label}</span> <span className={styles.sub}>{sub}</span>
      </h1>
      {extra && <span className={styles.extra}>{extra}</span>}
    </header>
  )
}
