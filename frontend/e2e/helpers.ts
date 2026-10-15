import type { Page } from '@playwright/test'

/** テスト間でタイトルが重ならないようにする（E2E は1つのDBを共有するため） */
export function unique(title: string): string {
  return `${title}-${Date.now().toString(36)}`
}

/** 現在表示中のビューのクイック追加でタスクを登録する */
export async function quickAdd(page: Page, title: string) {
  const input = page.getByRole('textbox', { name: 'タスクを追加' })
  await input.fill(title)
  await input.press('Enter')
  await page.getByRole('button', { name: title, exact: true }).waitFor()
}

export const taskPanel = (page: Page) => page.getByRole('complementary', { name: 'タスク詳細' })
export const rulePanel = (page: Page) => page.getByRole('complementary', { name: '繰り返しルールの編集' })
