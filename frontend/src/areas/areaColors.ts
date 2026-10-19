import type { AreaColor } from '../api/areas.ts'
import styles from './AreaBadge.module.css'

/** エリアの色のクラス。--area-fg（文字・点）と --area-bg（背景）を決める */
export function areaColorClass(color: AreaColor): string {
  return styles[color]
}
