import { createContext, useContext } from 'react'
import type { Area } from '../api/areas.ts'

export type AreaContextValue = {
  /** 並び順のエリア一覧（読み込み前・取得できないときは空） */
  areas: Area[]
  /** 選んでいるエリア。null は「すべて」 */
  areaId: number | null
  area: Area | undefined
  setAreaId: (id: number | null) => void
}

export const AreaContext = createContext<AreaContextValue>({
  areas: [],
  areaId: null,
  area: undefined,
  setAreaId: () => {},
})

/** サイドバーのタブで選んだエリア（AreaProvider の中で使う） */
export function useAreas(): AreaContextValue {
  return useContext(AreaContext)
}
