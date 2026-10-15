const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Date をローカル日付の YYYY-MM-DD にする */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** YYYY-MM-DD をローカル日付の Date にする（new Date(文字列) は UTC 扱いになるため使わない） */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function diffDays(from: string, to: string): number {
  return Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86_400_000)
}

/** 2026-10-14 → 10/14(水) */
export function formatDate(key: string): string {
  const date = parseDateKey(key)
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})`
}

/** ISO 日時 → 09:12 */
export function formatTime(iso: string): string {
  const date = new Date(iso)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** ISO 日時 → 10/14 09:12 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  return `${date.getMonth() + 1}/${date.getDate()} ${formatTime(iso)}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

/** key より後の、最も近い月曜日（key が月曜なら翌週の月曜） */
export function nextMonday(key: string): string {
  const day = parseDateKey(key).getDay() // 日曜=0, 月曜=1
  return addDays(key, ((8 - day) % 7) || 7)
}
