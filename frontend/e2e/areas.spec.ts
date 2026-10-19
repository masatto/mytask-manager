import { expect, test } from '@playwright/test'
import { taskPanel, unique } from './helpers.ts'

test('エリアを選んで追加したタスクは、そのエリアのタブにだけ出て、詳細パネルで付け替えられる', async ({ page }) => {
  const internal = unique('勤怠の締め')
  const project = unique('設計レビュー')
  await page.goto('/today')
  const tabs = page.getByRole('group', { name: 'エリア' })

  // Internal を選んで追加 → Internal に入る
  await tabs.getByRole('button', { name: 'Internal' }).click()
  await expect(page.getByLabel('エリア：Internal')).toBeVisible()
  const input = page.getByRole('textbox', { name: 'タスクを追加' })
  await input.fill(internal)
  await input.press('Enter')
  await expect(page.getByRole('button', { name: internal, exact: true })).toBeVisible()

  // @ で Project を指定して追加 → Internal の一覧には出ない
  await input.fill(`${project} @project`)
  await input.press('Enter')
  await expect(input).toHaveValue('')
  await expect(page.getByRole('button', { name: project, exact: true })).toBeHidden()

  // 「すべて」では両方にバッジ付きで出る
  await tabs.getByRole('button', { name: 'すべて' }).click()
  const projectRow = page.locator('li', { has: page.getByRole('button', { name: project, exact: true }) })
  await expect(projectRow.getByText('Project', { exact: true })).toBeVisible()

  // 詳細パネルで Internal に移すと、Internal のタブに出る
  await page.getByRole('button', { name: project, exact: true }).click()
  const panel = taskPanel(page)
  await panel.getByRole('radio', { name: 'Internal' }).check({ force: true })
  await panel.getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('保存しました')).toBeVisible()
  await panel.getByRole('button', { name: '閉じる' }).click()
  await tabs.getByRole('button', { name: 'Internal' }).click()
  await expect(page.getByRole('button', { name: project, exact: true })).toBeVisible()

  // 選んだタブは開き直しても残る
  await page.reload()
  await expect(page.getByLabel('エリア：Internal')).toBeVisible()
})
