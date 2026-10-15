import { expect, test } from '@playwright/test'
import { quickAdd, taskPanel, unique } from './helpers.ts'

test('ショートカットで追加し、検索で見つけ、明日に延期して元に戻す', async ({ page }) => {
  const title = unique('請求書を送る')
  await page.goto('/today')
  await expect(page).toHaveTitle(/Orbit/)

  // N でクイック追加へ
  await page.keyboard.press('n')
  await expect(page.getByRole('textbox', { name: 'タスクを追加' })).toBeFocused()
  await quickAdd(page, title)
  await expect(page).toHaveTitle(/^\(\d+\) Orbit$/)

  // 明日へ延期 → 今日ビューから消える → 元に戻す
  const row = page.locator('li', { has: page.getByRole('button', { name: title, exact: true }) })
  await row.hover()
  await row.getByRole('button', { name: `「${title}」を明日に延期` }).click()
  await expect(page.getByText(`「${title}」を明日に延期しました`)).toBeVisible()
  await expect(page.getByRole('button', { name: title, exact: true })).toBeHidden()
  await page.getByRole('button', { name: '元に戻す' }).click()
  await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible()

  // / で検索欄へ → 検索 → 結果からパネルを開き、Esc で閉じる
  await page.keyboard.press('Escape')
  await page.locator('body').click({ position: { x: 700, y: 600 } })
  await page.keyboard.press('/')
  const search = page.getByRole('searchbox', { name: 'タスクを検索' })
  await expect(search).toBeFocused()
  await search.fill(title.slice(0, 5))
  await search.press('Enter')
  await expect(page).toHaveURL(/\/search\?q=/)
  await page.getByRole('button', { name: title, exact: true }).click()
  await expect(taskPanel(page)).toBeVisible()
  await page.locator('main h1').click()
  await page.keyboard.press('Escape')
  await expect(taskPanel(page)).toBeHidden()
})

test('設定画面に自動バックアップが表示される（起動時に保存される）', async ({ page }) => {
  await page.goto('/settings')
  const section = page.getByRole('region', { name: '自動バックアップ' })
  await expect(section.getByRole('list', { name: '保存済みの自動バックアップ' })).toContainText(/orbit-auto-\d{8}\.json/)
})
