import { AreaDot } from './AreaBadge.tsx'
import { useAreas } from './useAreas.ts'
import styles from './AreaTabs.module.css'

/**
 * サイドバー上部のエリアの切り替え（screen-design 8章）。「すべて」と各エリアを2列の格子に並べる
 * （エリアが増えても横にはみ出さず、どのタブも同じ幅）。長い名前は省略し、ツールチップで全体を見せる。
 * エリアが1つもなければ出さない。
 */
export function AreaTabs() {
  const { areas, areaId, setAreaId } = useAreas()
  if (areas.length === 0) {
    return null
  }
  return (
    <div className={styles.tabs} role="group" aria-label="エリア">
      <button
        type="button"
        className={areaId === null ? `${styles.tab} ${styles.on}` : styles.tab}
        aria-pressed={areaId === null}
        onClick={() => setAreaId(null)}
      >
        すべて
      </button>
      {areas.map((area) => (
        <button
          key={area.id}
          type="button"
          className={area.id === areaId ? `${styles.tab} ${styles.on}` : styles.tab}
          aria-pressed={area.id === areaId}
          onClick={() => setAreaId(area.id)}
          title={area.name}
        >
          <AreaDot color={area.color} />
          <span className={styles.name}>{area.name}</span>
        </button>
      ))}
    </div>
  )
}
