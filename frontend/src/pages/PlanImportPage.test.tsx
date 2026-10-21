import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readPlanText } from '../lib/planText.ts'
import { EMPTY_COUNTS, installFakeApi } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

const AREAS = {
  status: 200,
  body: {
    items: [
      { id: 1, name: 'Project', color: 'blue', taskCount: 0, ruleCount: 0 },
      { id: 3, name: 'Study', color: 'orange', taskCount: 0, ruleCount: 0 },
    ],
  },
}

const PLAN_TEXT = `分割結果です。

\`\`\`json
{
  "area": "study",
  "tasks": [
    { "title": "expense-flow Step1: 準備", "memo": "目安 3h", "dueDate": "2026-10-20", "priority": "HIGH",
      "subtasks": [{ "title": "環境を作る", "done": true }, { "title": "型を書く" }] },
    { "title": "expense-flow Step2: 実装", "dueDate": "2026-10-21", "subtasks": [] }
  ]
}
\`\`\`
`

const PREVIEW = {
  created: 1,
  skipped: 1,
  tasks: [
    {
      action: 'CREATE',
      id: null,
      title: 'expense-flow Step1: 準備',
      dueDate: '2026-10-20',
      dueTime: null,
      priority: 'HIGH',
      done: false,
      subtasks: [
        { title: '環境を作る', done: true },
        { title: '型を書く', done: false, estimateMinutes: null, dueDate: '2026-10-20', scheduled: true },
      ],
    },
    {
      action: 'SKIP_DUPLICATE',
      id: null,
      title: 'expense-flow Step2: 実装',
      dueDate: '2026-10-21',
      dueTime: null,
      priority: 'MEDIUM',
      done: false,
      subtasks: [],
    },
  ],
}

describe('計画の取り込みの JSON の読み取り', () => {
  test('コードブロックや前後の説明文があっても JSON を取り出す', () => {
    const result = readPlanText(PLAN_TEXT)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.areaName).toBe('study')
      expect(result.plan.tasks).toHaveLength(2)
    }
  })

  test('JSON が無い・壊れている・形が違うときは理由を返す', () => {
    expect(readPlanText('こんにちは')).toEqual({ ok: false, errors: [expect.stringContaining('JSON が見つかりません')] })
    expect(readPlanText('{ "tasks": [ ')).toEqual({ ok: false, errors: [expect.stringContaining('JSON が見つかりません')] })
    expect(readPlanText('{ "tasks": [ } ')).toEqual({ ok: false, errors: [expect.stringContaining('JSON として読めません')] })
    const wrong = readPlanText('{"tasks":[{"memo":"x","subtasks":[{"title":1}]}]}')
    expect(wrong.ok).toBe(false)
    if (!wrong.ok) {
      expect(wrong.errors).toEqual([
        expect.stringMatching(/^tasks\[0\]\.title：/),
        expect.stringMatching(/^tasks\[0\]\.subtasks\[0\]\.title：/),
      ])
    }
  })
})

describe('S6 計画の取り込み', () => {
  test('貼り付けた JSON を確認し、エリア名を当てはめて登録する', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /areas': () => AREAS,
      'POST /plan-import?dryRun=true': () => ({ status: 200, body: PREVIEW }),
      'POST /plan-import?dryRun=false': () => ({ status: 200, body: { ...PREVIEW, created: 1 } }),
    })
    renderApp('/plan')
    const user = userEvent.setup()

    await user.click(await screen.findByLabelText(/コードブロックの前後/))
    await user.paste(PLAN_TEXT)
    await user.click(screen.getByRole('button', { name: '内容を確認' }))

    const rows = await screen.findByRole('list', { name: '登録する内容' })
    const items = within(rows).getAllByRole('listitem').filter((li) => li.parentElement === rows)
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('登録expense-flow Step1: 準備')
    expect(items[0]).toHaveTextContent('期限 10/20(火) ・ 優先度 高')
    expect(items[0]).toHaveTextContent('サブタスク 2件（完了 1）')
    expect(items[1]).toHaveTextContent('飛ばす')
    expect(items[1]).toHaveTextContent('同じタイトルのタスクがあります')
    // 大文字小文字が違っても、今あるエリアに当てはめる
    expect(screen.getByLabelText('登録先のエリア')).toHaveValue('3')
    expect(requests.find((r) => r.path === '/plan-import?dryRun=true')?.body).toMatchObject({
      areaId: 3,
      scheduleSubtasks: true,
    })
    // 期限のないサブタスクには、取り込むときに割り振った期限を「（自動）」付きで見せる
    expect(items[0]).toHaveTextContent('型を書く10/20(火)（自動）')

    await user.selectOptions(screen.getByLabelText('登録先のエリア'), '未分類')
    await user.click(screen.getByRole('button', { name: '1件を登録' }))

    expect(await screen.findByText('1件を登録しました（同じタイトルの1件は飛ばしました）')).toBeInTheDocument()
    const registered = requests.find((r) => r.path === '/plan-import?dryRun=false')
    expect(registered?.body).toMatchObject({ areaId: null, tasks: [{ title: 'expense-flow Step1: 準備' }, {}] })
    expect(screen.getByLabelText(/コードブロックの前後/)).toHaveValue('')
    expect(screen.queryByRole('list', { name: '登録する内容' })).not.toBeInTheDocument()
  })

  test('無いエリア名なら知らせ、サーバーの入力エラーは項目ごとに出す', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /areas': () => AREAS,
      'POST /plan-import?dryRun=true': (req) => {
        const body = req.body as { tasks: { dueDate?: string }[] }
        return body.tasks[0]?.dueDate === '10/20'
          ? {
              status: 400,
              body: {
                code: 'VALIDATION_ERROR',
                message: '入力内容に誤りがあります',
                fieldErrors: [{ field: 'tasks[0].dueDate', message: '日付は YYYY-MM-DD で指定してください' }],
              },
            }
          : { status: 200, body: { ...PREVIEW, skipped: 0, tasks: [PREVIEW.tasks[0]] } }
      },
    })
    renderApp('/plan')
    const user = userEvent.setup()
    const textarea = await screen.findByLabelText(/コードブロックの前後/)

    await user.click(textarea)
    await user.paste('{"area":"Private","tasks":[{"title":"a"}]}')
    await user.click(screen.getByRole('button', { name: '内容を確認' }))
    expect(await screen.findByText('「Private」というエリアはありません。登録先を選んでください')).toBeInTheDocument()

    await user.clear(textarea)
    await user.paste('{"tasks":[{"title":"a","dueDate":"10/20"}]}')
    // 書き換えたら前の確認結果は消える
    expect(screen.queryByRole('list', { name: '登録する内容' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '内容を確認' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('tasks[0].dueDate：日付は YYYY-MM-DD で指定してください')
  })

  test('サブタスクの期限の割り振りは外せる', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /areas': () => AREAS,
      'POST /plan-import?dryRun=true': () => ({ status: 200, body: PREVIEW }),
    })
    renderApp('/plan')
    const user = userEvent.setup()

    const checkbox = await screen.findByRole('checkbox', { name: /期限のないサブタスクにも期限を割り振る/ })
    expect(checkbox).toBeChecked()
    await user.click(checkbox)
    await user.click(screen.getByLabelText(/コードブロックの前後/))
    await user.paste(PLAN_TEXT)
    await user.click(screen.getByRole('button', { name: '内容を確認' }))

    await screen.findByRole('list', { name: '登録する内容' })
    expect(requests.find((r) => r.path === '/plan-import?dryRun=true')?.body).toMatchObject({ scheduleSubtasks: false })
  })

  test('プロンプトに今あるエリアを入れてコピーできる', async () => {
    installFakeApi({ 'GET /tasks/counts': () => EMPTY_COUNTS, 'GET /areas': () => AREAS })
    renderApp('/plan')
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')

    await screen.findByText('Project', { selector: 'span' })
    await user.click(screen.getByRole('button', { name: 'プロンプトをコピー' }))

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('使えるエリア: Project / Study'))
    expect(await screen.findByText('プロンプトをコピーしました。チャットAIに貼り付けてください')).toBeInTheDocument()
  })
})
