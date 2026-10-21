import { makeTask } from '../test/fakeApi.ts'
import { toFormField as toRuleFormField, toPattern, toPreviewInput } from './ruleFormValues.ts'
import { toFormField as toTaskFormField, toFormValues, toUpdateInput } from './taskEditFormValues.ts'

describe('タスク詳細のフォームの値', () => {
  test('API の値を入力欄の文字列にし、保存のときに API の形へ戻す', () => {
    const task = makeTask({ memo: null, dueDate: '2026-10-20', dueTime: '18:00', estimateMinutes: 90, areaId: 3 })
    const values = toFormValues(task)
    expect(values).toMatchObject({ memo: '', dueTime: '18:00', estimate: '1h30m', areaId: '3' })
    expect(toUpdateInput({ ...values, dueTime: values.dueTime ?? '' })).toMatchObject({
      memo: null,
      dueDate: '2026-10-20',
      dueTime: '18:00',
      estimateMinutes: 90,
      areaId: 3,
    })
  })

  test('日付を消したら時刻も送らない。目安を空にしたら未設定', () => {
    const values = { ...toFormValues(makeTask()), dueDate: '', dueTime: '10:00', estimate: '' }
    expect(toUpdateInput(values)).toMatchObject({ dueDate: null, dueTime: null, estimateMinutes: null })
  })

  test('サーバーの estimateMinutes のエラーは、目安の入力欄に出す', () => {
    expect(toTaskFormField('estimateMinutes')).toBe('estimate')
    expect(toTaskFormField('title')).toBe('title')
  })
})

describe('繰り返しルールのフォームの値', () => {
  const base = { patternType: 'WEEKLY', daysOfWeek: ['THU', 'MON'], dayOfMonth: '15' } as const

  test('選んでいるパターンの項目だけを送る（曜日は月曜から順に並べる）', () => {
    expect(toPattern({ ...base, daysOfWeek: [...base.daysOfWeek] })).toEqual({
      type: 'WEEKLY',
      daysOfWeek: ['MON', 'THU'],
      dayOfMonth: null,
    })
    expect(toPattern({ ...base, daysOfWeek: [...base.daysOfWeek], patternType: 'MONTHLY' })).toEqual({
      type: 'MONTHLY',
      daysOfWeek: null,
      dayOfMonth: 15,
    })
  })

  test('入力が途中なら生成予定を計算しない', () => {
    const v = { ...base, daysOfWeek: [...base.daysOfWeek], startDate: '2026-10-01', endDate: '' }
    expect(toPreviewInput(v)).toEqual({
      pattern: { type: 'WEEKLY', daysOfWeek: ['MON', 'THU'], dayOfMonth: null },
      startDate: '2026-10-01',
      endDate: null,
    })
    expect(toPreviewInput({ ...v, startDate: '' })).toBeNull()
    expect(toPreviewInput({ ...v, daysOfWeek: [] })).toBeNull()
    expect(toPreviewInput({ ...v, endDate: '2026-09-30' })).toBeNull()
  })

  test('サーバーの項目名をフォームの項目名にする', () => {
    expect(toRuleFormField('pattern.daysOfWeek')).toBe('daysOfWeek')
    expect(toRuleFormField('estimateMinutes')).toBe('estimate')
    expect(toRuleFormField('subtaskTemplates[0].estimateMinutes')).toBe('subtaskTemplates[0].estimate')
  })
})
