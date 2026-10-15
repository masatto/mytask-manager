import { expect, test } from '@playwright/test'
import { quickAdd, taskPanel, unique } from './helpers.ts'

test('タスクを追加し、詳細パネルで編集し、完了して元に戻す', async ({ page }) => {
  const title = unique('API設計書を書く')
  await page.goto('/today')
  await quickAdd(page, title)

  // 詳細パネルで編集
  await page.getByRole('button', { name: title, exact: true }).click()
  const panel = taskPanel(page)
  await panel.getByLabel('ステータス').selectOption('IN_PROGRESS')
  await panel.getByRole('radio', { name: '高' }).check()
  await panel.getByLabel('期限時刻').fill('23:59')
  await panel.getByLabel('メモ').fill('エンドポイント一覧から書く')
  await panel.getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('保存しました')).toBeVisible()

  const row = page.locator('li', { has: page.getByRole('button', { name: title, exact: true }) })
  await expect(row).toContainText('進行中')
  await expect(row).toContainText('23:59')
  await expect(row.getByRole('img', { name: '優先度: 高' })).toBeVisible()

  // 完了 → 一覧から消える → 元に戻す
  await panel.getByRole('button', { name: '閉じる' }).click()
  await row.getByRole('checkbox').click()
  await expect(page.getByText('完了にしました')).toBeVisible()
  await expect(page.getByRole('button', { name: title, exact: true })).toBeHidden()
  await page.getByRole('button', { name: '元に戻す' }).click()
  await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible()
  await expect(row).toContainText('進行中')

  // 完了して完了済みビューへ
  await row.getByRole('checkbox').click()
  await page.getByRole('link', { name: /^Done/ }).click()
  await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible()
})

test('未保存の変更があるとき、サイドバーで移動しようとすると確認が出る', async ({ page }) => {
  const title = unique('本棚の整理')
  await page.goto('/no-due')
  await quickAdd(page, title)
  await page.getByRole('button', { name: title, exact: true }).click()
  await taskPanel(page).getByRole('textbox', { name: 'タイトル' }).fill(`${title}（編集中）`)

  await page.getByRole('link', { name: /^Today/ }).click()
  const dialog = page.getByRole('alertdialog', { name: '変更を破棄しますか？' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '編集に戻る' }).click()
  await expect(page).toHaveURL(/\/no-due\?task=\d+/)
  await expect(taskPanel(page).getByRole('textbox', { name: 'タイトル' })).toHaveValue(`${title}（編集中）`)
})

test('タスクを削除するとパネルが閉じ、一覧から消える', async ({ page }) => {
  const title = unique('削除するタスク')
  await page.goto('/no-due')
  await quickAdd(page, title)
  await page.getByRole('button', { name: title, exact: true }).click()
  await taskPanel(page).getByRole('button', { name: '削除' }).click()
  await page.getByRole('alertdialog', { name: 'このタスクを削除しますか？' }).getByRole('button', { name: '削除' }).click()

  await expect(page.getByText('削除しました')).toBeVisible()
  await expect(taskPanel(page)).toBeHidden()
  await expect(page).toHaveURL(/\/no-due$/)
  await expect(page.getByRole('button', { name: title, exact: true })).toBeHidden()
})
