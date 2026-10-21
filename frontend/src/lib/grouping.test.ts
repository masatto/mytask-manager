import type { Task, TaskListItem } from '../api/types.ts'
import { groupItems } from './grouping.ts'

const TODAY = '2026-10-14'

function item(overrides: Partial<TaskListItem> & { completedAt?: string; title?: string } = {}): TaskListItem {
  const task: Task = {
    id: 1,
    title: overrides.title ?? 't',
    memo: null,
    dueDate: overrides.viewDate ?? null,
    dueTime: null,
    priority: 'MEDIUM',
    status: overrides.completedAt ? 'DONE' : 'TODO',
    completedAt: overrides.completedAt ?? null,
    overdue: overrides.viewOverdue ?? false,
    parentId: null,
    recurrence: null,
    areaId: null,
    estimateMinutes: null,
    createdAt: '2026-10-01T00:00:00+09:00',
    updatedAt: '2026-10-01T00:00:00+09:00',
  }
  return {
    task,
    contextOnly: false,
    subtasks: [],
    progress: { done: 0, total: 0 },
    viewDate: null,
    viewTime: null,
    viewOverdue: false,
    ...overrides,
  }
}

describe('groupItems', () => {
  test('今日ビューは期限切れ→今日の順に分け、空のグループは出さない', () => {
    const groups = groupItems(
      'today',
      [item({ title: 'a', viewOverdue: true }), item({ title: 'b' }), item({ title: 'c', viewOverdue: true })],
      TODAY,
    )
    expect(groups.map((g) => [g.label, g.items.map((i) => i.task.title)])).toEqual([
      ['期限切れ', ['a', 'c']],
      ['今日', ['b']],
    ])

    expect(groupItems('today', [item({ title: 'b' })], TODAY).map((g) => g.label)).toEqual(['今日'])
  })

  test('今後ビューは日付ごとに分け、明日の見出しと7日以内の強調を付ける', () => {
    const groups = groupItems(
      'upcoming',
      [
        item({ viewDate: '2026-10-15' }),
        item({ viewDate: '2026-10-15' }),
        item({ viewDate: '2026-10-21' }),
        item({ viewDate: '2026-10-22' }),
      ],
      TODAY,
    )
    expect(groups.map((g) => [g.label, g.items.length, g.emphasized])).toEqual([
      ['明日 10/15(木)', 2, true],
      ['10/21(水)', 1, true],
      ['10/22(木)', 1, false],
    ])
  })

  test('完了済みビューはサーバーが返す完了日（viewDate）ごとに分ける', () => {
    const groups = groupItems(
      'done',
      [
        item({ completedAt: '2026-10-14T09:12:00+09:00', viewDate: '2026-10-14' }),
        // 親がコンテキスト表示の行は親に完了日時がないので、viewDate で分ける
        item({ viewDate: '2026-10-14', contextOnly: true }),
        item({ completedAt: '2026-10-13T23:59:00+09:00', viewDate: '2026-10-13' }),
      ],
      TODAY,
    )
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ['10/14(水)', 2],
      ['10/13(火)', 1],
    ])
  })

  test('期限なしビューは見出しなしの1グループ、0件ならグループなし', () => {
    expect(groupItems('no-due', [item()], TODAY).map((g) => g.label)).toEqual([null])
    expect(groupItems('no-due', [], TODAY)).toEqual([])
  })
})
