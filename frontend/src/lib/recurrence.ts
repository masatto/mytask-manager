import type { Pattern, Weekday } from '../api/types.ts'

export const WEEKDAYS: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MON: '月',
  TUE: '火',
  WED: '水',
  THU: '木',
  FRI: '金',
  SAT: '土',
  SUN: '日',
}

export const LAST_DAY = -1

/** Date.getDay()（日曜=0）→ Weekday */
export function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[(date.getDay() + 6) % 7]
}

/** パターンの説明（S3 の一覧）：毎日／毎週 月・木／毎月 15日／毎月 末日／手動 */
export function describePattern(pattern: Pattern): string {
  switch (pattern.type) {
    case 'DAILY':
      return '毎日'
    case 'WEEKLY': {
      const days = WEEKDAYS.filter((d) => pattern.daysOfWeek?.includes(d)).map((d) => WEEKDAY_LABELS[d])
      return `毎週 ${days.join('・')}`
    }
    case 'MONTHLY':
      return pattern.dayOfMonth === LAST_DAY ? '毎月 末日' : `毎月 ${pattern.dayOfMonth}日`
    case 'MANUAL':
      return '手動'
  }
}
