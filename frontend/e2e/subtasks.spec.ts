import { expect, test } from '@playwright/test'
import { quickAdd, taskPanel, unique } from './helpers.ts'

test('サブタスクを追加し、未完了のサブタスクが残る親を一括完了する', async ({ page }) => {
  const parent = unique('設計レビューの指摘対応')
  await page.goto('/today')
  await quickAdd(page, parent)

  await page.getByRole('button', { name: parent, exact: true }).click()
  const section = taskPanel(page).getByRole('region', { name: 'サブタスク' })
  const add = section.getByRole('textbox', { name: 'サブタスクを追加' })
  for (const sub of ['指摘1', '指摘2', '指摘3']) {
    await add.fill(sub)
    await add.press('Enter')
    await expect(section.getByRole('button', { name: sub, exact: true })).toBeVisible()
  }
  await section.getByRole('checkbox', { name: '「指摘1」を完了にする' }).click()
  await expect(section.getByRole('heading')).toContainText('1/3')

  // 一覧では親の下にサブタスクが並び、進捗が出る
  const subList = page.getByRole('list', { name: `「${parent}」のサブタスク` })
  await expect(subList.getByRole('listitem')).toHaveCount(3)
  await expect(page.getByLabel('サブタスク 1/3 完了')).toBeVisible()

  // 親を完了 → D1 → すべて完了
  await taskPanel(page).getByRole('button', { name: '閉じる' }).click()
  await page.getByRole('checkbox', { name: `「${parent}」を完了にする` }).click()
  const dialog = page.getByRole('alertdialog', { name: '未完了のサブタスクが2件あります。すべて完了にしますか？' })
  await dialog.getByRole('button', { name: 'すべて完了' }).click()
  await expect(page.getByText('完了にしました')).toBeVisible()

  await page.getByRole('link', { name: /^完了済み/ }).click()
  await expect(page.getByLabel('サブタスク 3/3 完了').first()).toBeVisible()
})
