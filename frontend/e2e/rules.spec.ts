import { expect, test } from '@playwright/test'
import { rulePanel, taskPanel, unique } from './helpers.ts'

test('今日の曜日の繰り返しルールを作ると今日の分が生成され、タスクからルールを開ける', async ({ page }) => {
  const title = unique('週次の振り返り')
  await page.goto('/rules')
  await page.getByRole('button', { name: '＋ 新規ルール' }).click()

  // 新規作成の初期値は「毎週・今日の曜日・開始日は今日」
  const panel = rulePanel(page)
  await panel.getByLabel('タイトル', { exact: true }).fill(title)
  await panel.getByLabel('期限時刻').fill('23:30')
  await panel.getByRole('button', { name: '＋ 追加' }).click()
  await panel.getByLabel('ひな形1のタイトル').fill('アウトプット確認')
  await expect(panel.getByRole('region', { name: '次回の生成予定' })).toContainText('、')
  await panel.getByRole('button', { name: '作成' }).click()
  await expect(page.getByText('ルールを作成しました')).toBeVisible()
  await expect(page.locator('tbody tr', { hasText: title })).toContainText('毎週')

  // 今日ビューに生成されたタスク（↻・サブタスクつき）
  await page.getByRole('link', { name: /^Today/ }).click()
  const row = page.locator('li', { has: page.getByRole('button', { name: title, exact: true }) })
  await expect(row.getByRole('img', { name: '繰り返し' })).toBeVisible()
  await expect(row).toContainText('アウトプット確認')

  // タスクの詳細からルールを開く
  await page.getByRole('button', { name: title, exact: true }).click()
  await taskPanel(page).getByRole('button', { name: '→ ルールを開く' }).click()
  await expect(page).toHaveURL(/\/rules\?rule=\d+/)
  await expect(rulePanel(page).getByLabel('タイトル', { exact: true })).toHaveValue(title)
})
