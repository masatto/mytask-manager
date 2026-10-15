import { expect, test } from '@playwright/test'
import { quickAdd, unique } from './helpers.ts'

test('エクスポートしたファイルをインポートすると、その時点の状態に戻る', async ({ page }, testInfo) => {
  const kept = unique('エクスポート前からあるタスク')
  const added = unique('エクスポート後に追加したタスク')
  await page.goto('/no-due')
  await quickAdd(page, kept)

  // エクスポート
  await page.getByRole('link', { name: /^Settings/ }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'JSONをエクスポート' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^mytask-manager-\d{8}-\d{4}\.json$/)
  const file = testInfo.outputPath('backup.json')
  await download.saveAs(file)
  await expect(page.getByText(/最終エクスポート：\d+\/\d+ \d\d:\d\d/)).toBeVisible()

  // データを変えてからインポートで戻す
  await page.getByRole('link', { name: /^Someday/ }).click()
  await quickAdd(page, added)
  await page.getByRole('link', { name: /^Settings/ }).click()
  await page.getByLabel('インポートするファイル').setInputFiles(file)
  const dialog = page.getByRole('alertdialog', { name: '現在のデータはすべて置き換えられます。' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '置き換える' }).click()
  await expect(page.getByText('backup.json からインポートしました')).toBeVisible()

  await page.getByRole('link', { name: /^Someday/ }).click()
  await expect(page.getByRole('button', { name: kept, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: added, exact: true })).toBeHidden()
})

test('不正なファイルは理由を表示して取り込まない', async ({ page }) => {
  await page.goto('/settings')
  await page.getByLabel('インポートするファイル').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{not json'),
  })
  await expect(page.getByRole('alert')).toContainText('JSON として読み込めません')
  await expect(page.getByRole('alertdialog')).toBeHidden()
})
