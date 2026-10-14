/** タスク一覧のビュー定義（screen-design 1章） */
export const VIEWS = [
  { key: 'today', path: '/today', label: '今日' },
  { key: 'upcoming', path: '/upcoming', label: '今後' },
  { key: 'no-due', path: '/no-due', label: '期限なし' },
  { key: 'done', path: '/done', label: '完了済み' },
] as const

export type ViewKey = (typeof VIEWS)[number]['key']
