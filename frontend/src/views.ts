/**
 * タスク一覧のビュー定義（screen-design 1章）。
 * 見出しは英語（label）と日本語（sub）の2段で表示する。
 */
export const VIEWS = [
  { key: 'today', path: '/today', label: 'Today', sub: '今日' },
  { key: 'upcoming', path: '/upcoming', label: 'Upcoming', sub: 'これから' },
  { key: 'no-due', path: '/no-due', label: 'Someday', sub: 'いつか' },
  { key: 'done', path: '/done', label: 'Done', sub: '完了' },
] as const

export type ViewKey = (typeof VIEWS)[number]['key']

/** ビュー以外のページの見出し */
export const PAGE_TITLES = {
  rules: { label: 'Routines', sub: '繰り返し' },
  settings: { label: 'Settings', sub: '設定' },
  search: { label: 'Search', sub: '検索' },
  progress: { label: 'Progress', sub: '計画の進み具合' },
  plan: { label: 'Plan', sub: '計画の取り込み' },
} as const
