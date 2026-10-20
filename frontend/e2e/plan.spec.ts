import { expect, test } from '@playwright/test'
import { unique } from './helpers.ts'

test('AIが出したJSONを貼り付けて確認し、登録すると一覧に出る。同じ計画をもう一度取り込んでも二重にならない', async ({
  page,
}) => {
  const areaName = unique('学習').slice(0, 20)
  const created = await page.request.post('/api/areas', { data: { name: areaName, color: 'orange' } })
  expect(created.ok()).toBeTruthy()

  const step1 = unique('計画E2E Step1: 準備')
  const step2 = unique('計画E2E Step2: 実装')
  const plan = `はい、こちらです。\n\n\`\`\`json\n${JSON.stringify(
    {
      area: areaName,
      tasks: [
        {
          title: step1,
          memo: '目安 2h\n終了条件: 動く',
          dueDate: '2030-01-10',
          priority: 'HIGH',
          subtasks: [{ title: '環境を作る', done: true }, { title: '型を書く' }],
        },
        { title: step2, dueDate: '2030-01-11', subtasks: [{ title: 'APIを書く' }] },
      ],
    },
    null,
    2,
  )}\n\`\`\``

  await page.goto('/plan')
  await expect(page.getByRole('heading', { name: /Plan/ })).toBeVisible()
  await page.getByLabel(/コードブロックの前後/).fill(plan)
  await page.getByRole('button', { name: '内容を確認' }).click()

  const rows = page.getByRole('list', { name: '登録する内容' })
  await expect(rows.getByText(step1)).toBeVisible()
  await expect(rows.getByText('サブタスク 2件（完了 1）')).toBeVisible()
  await expect(page.getByLabel('登録先のエリア')).toHaveText(new RegExp(areaName))
  await page.screenshot({ path: test.info().outputPath('plan-preview.png'), fullPage: true })

  await page.getByRole('button', { name: '2件を登録' }).click()
  await expect(page.getByText('2件を登録しました')).toBeVisible()

  // これからの一覧に、エリアのバッジ付きで出る
  await page.goto('/upcoming')
  await expect(page.getByRole('button', { name: step1, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: step2, exact: true })).toBeVisible()
  await page.getByRole('group', { name: 'エリア' }).getByRole('button', { name: areaName }).click()
  await expect(page.getByRole('button', { name: step1, exact: true })).toBeVisible()
  await page.locator('nav').screenshot({ path: test.info().outputPath('sidebar.png') })

  // 同じ計画をもう一度取り込むと、すべて飛ばす
  await page.goto('/plan')
  await page.getByLabel(/コードブロックの前後/).fill(plan)
  await page.getByRole('button', { name: '内容を確認' }).click()
  await expect(page.getByText('同じタイトルの2件は登録しません')).toBeVisible()
  await expect(page.getByRole('button', { name: '0件を登録' })).toBeDisabled()
})
