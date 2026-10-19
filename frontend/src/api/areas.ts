import { apiFetch } from './client.ts'

/** api-design 8章：エリア */

export const AREA_COLORS = ['blue', 'green', 'purple', 'orange', 'teal', 'pink', 'brown', 'gray'] as const
export type AreaColor = (typeof AREA_COLORS)[number]

export const AREA_COLOR_LABELS: Record<AreaColor, string> = {
  blue: '青',
  green: '緑',
  purple: '紫',
  orange: 'オレンジ',
  teal: '青緑',
  pink: 'ピンク',
  brown: '茶',
  gray: 'グレー',
}

/** サイドバーのタブが増えすぎないように、作れる数と名前の長さに上限がある（サーバーと同じ値） */
export const MAX_AREAS = 10
export const MAX_AREA_NAME = 20

export type Area = {
  id: number
  name: string
  color: AreaColor
  /** このエリアの親タスクの数（完了済みも含む） */
  taskCount: number
  ruleCount: number
}

export type AreaInput = { name: string; color: AreaColor }

export const areaKeys = {
  all: ['areas'] as const,
}

export function fetchAreas(): Promise<{ items: Area[] }> {
  return apiFetch('/areas')
}

export function createArea(input: AreaInput): Promise<Area> {
  return apiFetch('/areas', { method: 'POST', body: JSON.stringify(input) })
}

export function updateArea(id: number, input: AreaInput): Promise<Area> {
  return apiFetch(`/areas/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function reorderAreas(ids: number[]): Promise<{ items: Area[] }> {
  return apiFetch('/areas/order', { method: 'PUT', body: JSON.stringify({ ids }) })
}

/** moveTo を省くと、そのエリアのタスクとルールは未分類になる */
export function deleteArea(id: number, moveTo: number | null): Promise<void> {
  const query = moveTo === null ? '' : `?moveTo=${moveTo}`
  return apiFetch(`/areas/${id}${query}`, { method: 'DELETE' })
}

/** 一覧・件数・検索の問い合わせに付けるパラメーター（すべてなら付けない） */
export function areaParam(areaId: number | null): Record<string, string> {
  return areaId === null ? {} : { area: String(areaId) }
}
