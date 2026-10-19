import type { UseFormRegisterReturn } from 'react-hook-form'
import { AreaDot } from './AreaBadge.tsx'
import { useAreas } from './useAreas.ts'
import styles from './AreaRadioGroup.module.css'

/**
 * エリアの選択（タスク・繰り返しルールの編集パネル）。エリアがなければ何も出さない。
 * 選択肢が多いときは折り返す。
 */
export function AreaRadioGroup({ registration }: { registration: UseFormRegisterReturn }) {
  const { areas } = useAreas()
  return (
    <div className={styles.group} role="radiogroup" aria-label="エリア">
      {areas.map((area) => (
        <label key={area.id} className={styles.option} title={area.name}>
          <input type="radio" value={String(area.id)} {...registration} />
          <AreaDot color={area.color} />
          <span className={styles.name}>{area.name}</span>
        </label>
      ))}
      <label className={styles.option}>
        <input type="radio" value="" {...registration} />
        <span className={styles.name}>未分類</span>
      </label>
    </div>
  )
}
