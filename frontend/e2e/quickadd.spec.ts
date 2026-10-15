import { expect, test } from '@playwright/test'
import { taskPanel, unique } from './helpers.ts'

test('自然な書き方で期限・時刻・優先度つきのタスクを追加し、複製できる', async ({ page }) => {
  const title = unique('定例資料の準備')
  await page.goto('/today')
  const input = page.getByRole('textbox', { name: 'タスクを追加' })
  await input.fill(`明日 15:00 ${title} !高`)
  await expect(page.getByRole('status', { name: '読み取った内容' })).toContainText('15:00 ・ 優先度 高')
  await input.press('Enter')
  await expect(input).toHaveValue('')

  // 期限は明日なので Upcoming に出る
  await page.getByRole('link', { name: /^Upcoming/ }).click()
  const row = page.locator('li', { has: page.getByRole('button', { name: title, exact: true }) })
  await expect(row).toContainText('15:00')
  await expect(row.getByRole('img', { name: '優先度: 高' })).toBeVisible()

  // 複製
  await page.getByRole('button', { name: title, exact: true }).click()
  await taskPanel(page).getByRole('button', { name: '複製' }).click()
  await expect(taskPanel(page).getByRole('textbox', { name: 'タイトル' })).toHaveValue(`${title}（コピー）`)
  await expect(page.getByRole('button', { name: `${title}（コピー）`, exact: true })).toBeVisible()
})
