import { describePattern, weekdayOf } from './recurrence.ts'

describe('describePattern', () => {
  test('毎週は曜日を月曜始まりの順に並べる（入力の順序に依存しない）', () => {
    expect(describePattern({ type: 'WEEKLY', daysOfWeek: ['THU', 'MON'], dayOfMonth: null })).toBe('毎週 月・木')
  })

  test('毎月は日付、または末日', () => {
    expect(describePattern({ type: 'MONTHLY', daysOfWeek: null, dayOfMonth: 15 })).toBe('毎月 15日')
    expect(describePattern({ type: 'MONTHLY', daysOfWeek: null, dayOfMonth: -1 })).toBe('毎月 末日')
  })

  test('毎日', () => {
    expect(describePattern({ type: 'DAILY', daysOfWeek: null, dayOfMonth: null })).toBe('毎日')
  })
})

test('weekdayOf は日曜始まりの getDay を月曜始まりに直す', () => {
  expect(weekdayOf(new Date(2026, 9, 18))).toBe('SUN')
  expect(weekdayOf(new Date(2026, 9, 19))).toBe('MON')
})
