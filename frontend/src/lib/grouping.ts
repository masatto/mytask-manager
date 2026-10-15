import type { TaskListItem } from '../api/types.ts'
import type { ViewKey } from '../views.ts'
import { addDays, diffDays, formatDate } from './date.ts'

export type TaskGroup = {
  key: string
  /** 見出し。null なら見出しを出さない */
  label: string | null
  /** 見出しを強調するか（今後ビューの7日以内など） */
  emphasized: boolean
  /** この見出しが表す日付。行の期限表示で日付を省略するのに使う */
  date: string | null
  items: TaskListItem[]
}

/**
 * ビューごとのグループ分け（screen-design 3章）。
 * items はサーバーで並び順が確定しているので、順序を保ったまま分ける。
 */
export function groupItems(view: ViewKey, items: TaskListItem[], today: string): TaskGroup[] {
  switch (view) {
    case 'today':
      return [
        {
          key: 'overdue',
          label: '期限切れ',
          emphasized: true,
          date: null,
          items: items.filter((i) => i.viewOverdue),
        },
        {
          key: 'today',
          label: '今日',
          emphasized: false,
          date: today,
          items: items.filter((i) => !i.viewOverdue),
        },
      ].filter((g) => g.items.length > 0)
    case 'upcoming': {
      const tomorrow = addDays(today, 1)
      return groupBy(items, (i) => i.viewDate ?? '').map(([date, groupItems]) => ({
        key: date,
        label: date === tomorrow ? `明日 ${formatDate(date)}` : formatDate(date),
        emphasized: diffDays(today, date) <= 7,
        date,
        items: groupItems,
      }))
    }
    case 'no-due':
      return items.length > 0 ? [{ key: 'all', label: null, emphasized: false, date: null, items }] : []
    case 'done':
      // 完了済みビューの viewDate は、その行で最新の完了日（親がコンテキスト表示のときはサブタスクの完了日）
      return groupBy(items, (i) => i.viewDate ?? '').map(
        ([date, groupItems]) => ({
          key: date,
          label: formatDate(date),
          emphasized: false,
          date,
          items: groupItems,
        }),
      )
  }
}

/** 連続する同じキーをまとめる（入力の並び順を保つ） */
function groupBy<T>(items: T[], keyOf: (item: T) => string): [string, T[]][] {
  const groups: [string, T[]][] = []
  for (const item of items) {
    const key = keyOf(item)
    const last = groups.at(-1)
    if (last && last[0] === key) {
      last[1].push(item)
    } else {
      groups.push([key, [item]])
    }
  }
  return groups
}
