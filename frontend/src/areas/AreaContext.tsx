import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { areaKeys, fetchAreas } from '../api/areas.ts'
import { AreaContext } from './useAreas.ts'

const STORAGE_KEY = 'orbit.area'

/** 選んだエリアは、次に開いたときも残す（見る人のブラウザごと） */
function readStored(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function writeStored(id: number | null) {
  try {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, String(id))
    }
  } catch {
    // 保存できなくても、開いている間の切り替えはできる
  }
}

/**
 * サイドバーのタブで選んだエリア。一覧・件数・検索・繰り返しルールはこのエリアで絞り込む。
 * 選んでいたエリアが消されたら「すべて」に戻す。
 */
export function AreaProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({ queryKey: areaKeys.all, queryFn: fetchAreas })
  const [stored, setStored] = useState(readStored)

  const areas = useMemo(() => data?.items ?? [], [data])
  // 一覧が読めるまでは保存してあった値を信じる。読めた後は、ないエリアなら「すべて」
  const missing = data !== undefined && stored !== null && !areas.some((a) => a.id === stored)
  const areaId = missing ? null : stored

  // 消えたエリアを覚えたままにしない（ブラウザに保存した値だけを消す。表示は上で「すべて」になっている）
  useEffect(() => {
    if (missing) {
      writeStored(null)
    }
  }, [missing])

  const setAreaId = useCallback((id: number | null) => {
    setStored(id)
    writeStored(id)
  }, [])

  const value = useMemo(
    () => ({ areas, areaId, area: areas.find((a) => a.id === areaId), setAreaId }),
    [areas, areaId, setAreaId],
  )
  return <AreaContext.Provider value={value}>{children}</AreaContext.Provider>
}
