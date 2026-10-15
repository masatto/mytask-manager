import { nextMonday } from './date.ts'

test('nextMonday は次の月曜（月曜当日なら翌週）', () => {
  expect(nextMonday('2026-10-14')).toBe('2026-10-19') // 水曜
  expect(nextMonday('2026-10-18')).toBe('2026-10-19') // 日曜
  expect(nextMonday('2026-10-19')).toBe('2026-10-26') // 月曜
  expect(nextMonday('2026-12-30')).toBe('2027-01-04') // 年またぎ
})
