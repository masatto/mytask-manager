/** フォームの areaId の値（'' は未分類）と、API の値の変換 */
export function toAreaField(areaId: number | null): string {
  return areaId === null ? '' : String(areaId)
}

export function fromAreaField(value: string): number | null {
  return value === '' ? null : Number(value)
}
