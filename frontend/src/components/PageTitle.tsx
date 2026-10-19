import type { ReactNode } from 'react'
import { AreaBadge } from '../areas/AreaBadge.tsx'
import { useAreas } from '../areas/useAreas.ts'
import styles from './PageTitle.module.css'

type PageTitleProps = {
  /** 英語の見出し（大きく表示） */
  label: string
  /** 日本語の見出し（小さく添える） */
  sub: string
  /** 見出しの右に並べる補足（今日の日付・検索語など） */
  extra?: ReactNode
  /** エリアで絞り込む画面なら、選んでいるエリアを見出しの横に出す */
  showArea?: boolean
}

/** ページの見出し。英語＋日本語の2段 */
export function PageTitle({ label, sub, extra, showArea = true }: PageTitleProps) {
  const { area } = useAreas()
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>
        <span className={styles.label}>{label}</span> <span className={styles.sub}>{sub}</span>
      </h1>
      {showArea && area && (
        <span className={styles.area} aria-label={`エリア：${area.name}`}>
          <AreaBadge area={area} withDot wide />
        </span>
      )}
      {extra && <span className={styles.extra}>{extra}</span>}
    </header>
  )
}
