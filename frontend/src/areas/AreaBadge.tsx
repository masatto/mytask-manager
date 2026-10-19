import type { Area, AreaColor } from '../api/areas.ts'
import { areaColorClass } from './areaColors.ts'
import styles from './AreaBadge.module.css'

/** 色の点だけ（タブ・選択肢の頭に付ける） */
export function AreaDot({ color }: { color: AreaColor }) {
  return <span className={`${styles.dot} ${areaColorClass(color)}`} aria-hidden="true" />
}

/** 一覧の行の頭や見出しに付ける、エリア名の小さなバッジ。長い名前は省略し、全体はツールチップで見せる */
type AreaBadgeProps = {
  area: Pick<Area, 'name' | 'color'>
  withDot?: boolean
  /** 見出しなど、場所に余裕があるところでは長めに出す */
  wide?: boolean
}

export function AreaBadge({ area, withDot = false, wide = false }: AreaBadgeProps) {
  const className = [styles.badge, wide && styles.wide, areaColorClass(area.color)].filter(Boolean).join(' ')
  return (
    <span className={className} title={area.name}>
      {withDot && <span className={styles.badgeDot} aria-hidden="true" />}
      <span className={styles.name}>{area.name}</span>
    </span>
  )
}
