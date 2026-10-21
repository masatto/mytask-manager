import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Rule } from '../api/types.ts'
import { readPlanText } from '../lib/planText.ts'
import { EMPTY_COUNTS, installFakeApi, listItem, makeTask } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

describe('目安時間：タスクの詳細パネル', () => {
  const parent = makeTask({ id: 3, title: 'Step8', estimateMinutes: 480 })
  const subs = [
    makeTask({ id: 4, title: '模擬問題を解く', parentId: 3, estimateMinutes: 120 }),
    makeTask({ id: 5, title: '解き方を学ぶ', parentId: 3, estimateMinutes: 510 }),
    makeTask({ id: 6, title: '目安なし', parentId: 3 }),
  ]

  function setup() {
    return installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({ status: 200, body: { items: [listItem(parent)], hasMore: false } }),
      'GET /tasks/3': () => ({ status: 200, body: { ...parent, subtasks: subs } }),
      'PUT /tasks/3': (req) => ({ status: 200, body: { ...parent, ...(req.body as object) } }),
    })
  }

  test('目安を表示し、サブタスクの合計が超えていれば超過分を出す', async () => {
    setup()
    renderApp('/today?task=3')

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    expect(await within(panel).findByLabelText('目安時間')).toHaveValue('8h')
    expect(within(panel).getByText('サブタスク合計 10h30m（2h30m 超過）')).toBeInTheDocument()
    expect(within(panel).getByLabelText('目安 2h')).toBeInTheDocument()
  })

  test('「90」と入力すると 1h30m に整え、分で保存する。超過の表示は入力に合わせて変わる', async () => {
    const { requests } = setup()
    renderApp('/today?task=3')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    const input = await within(panel).findByLabelText('目安時間')
    await user.clear(input)
    await user.type(input, '12h')
    await user.tab()
    expect(within(panel).getByText('サブタスク合計 10h30m')).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, '90')
    await user.tab()
    expect(input).toHaveValue('1h30m')
    await user.click(within(panel).getByRole('button', { name: '保存' }))

    expect(await screen.findByText('保存しました')).toBeInTheDocument()
    expect(requests.find((r) => r.method === 'PUT')?.body).toMatchObject({ estimateMinutes: 90 })
  })

  test('読めない書き方はエラーにして保存しない。空にすると未設定で保存する', async () => {
    const { requests } = setup()
    renderApp('/today?task=3')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    const input = await within(panel).findByLabelText('目安時間')
    await user.clear(input)
    await user.type(input, '2日')
    await user.click(within(panel).getByRole('button', { name: '保存' }))
    expect(await within(panel).findByText(/のように入力してください/)).toBeInTheDocument()
    expect(requests.some((r) => r.method === 'PUT')).toBe(false)

    await user.clear(input)
    await user.click(within(panel).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(requests.find((r) => r.method === 'PUT')?.body).toMatchObject({ estimateMinutes: null }))
  })
})

describe('目安時間：繰り返しルール', () => {
  test('ルールとひな形の目安を分で送る', async () => {
    const created: Rule = {
      id: 5,
      title: '単語暗記',
      memo: null,
      priority: 'MEDIUM',
      dueTime: null,
      pattern: { type: 'DAILY', daysOfWeek: null, dayOfMonth: null },
      startDate: '2026-10-14',
      endDate: null,
      active: true,
      subtaskTemplates: [],
      areaId: null,
      estimateMinutes: 20,
      nextOccurrence: null,
      lastGeneratedDate: null,
      createdAt: '2026-10-14T09:00:00+09:00',
      updatedAt: '2026-10-14T09:00:00+09:00',
    }
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /rules': () => ({ status: 200, body: { items: [] } }),
      'POST /rules/preview': () => ({ status: 200, body: { occurrences: [] } }),
      'POST /rules': () => ({ status: 201, body: created }),
      'GET /rules/5': () => ({ status: 200, body: created }),
    })
    renderApp('/rules')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '＋ 新規ルール' }))
    const panel = await screen.findByRole('complementary', { name: '繰り返しルールの編集' })
    await user.type(within(panel).getByLabelText('タイトル'), '単語暗記')
    await user.click(within(panel).getByRole('radio', { name: '毎日' }))
    await user.type(within(panel).getByLabelText('目安時間'), '20')
    await user.click(within(panel).getByRole('button', { name: '＋ 追加' }))
    await user.type(within(panel).getByLabelText('ひな形1のタイトル'), '復習')
    await user.type(within(panel).getByLabelText('ひな形1の目安時間'), '1h')
    await user.click(within(panel).getByRole('button', { name: '作成' }))

    await waitFor(() =>
      expect(requests.find((r) => r.path === '/rules' && r.method === 'POST')?.body).toMatchObject({
        estimateMinutes: 20,
        subtaskTemplates: [{ title: '復習', priority: 'MEDIUM', estimateMinutes: 60 }],
      }),
    )
  })
})

describe('目安時間：計画の取り込み', () => {
  test('JSON の estimateMinutes を読み、分の整数でなければ理由を返す', () => {
    const ok = readPlanText('{"tasks":[{"title":"Step1","estimateMinutes":480,"subtasks":[{"title":"a","estimateMinutes":60}]}]}')
    expect(ok.ok && ok.plan.tasks[0]).toMatchObject({ estimateMinutes: 480, subtasks: [{ estimateMinutes: 60 }] })

    const wrong = readPlanText('{"tasks":[{"title":"Step1","estimateMinutes":"8h"}]}')
    expect(wrong).toEqual({ ok: false, errors: [expect.stringMatching(/^tasks\[0\]\.estimateMinutes：/)] })
  })

  test('確認画面に目安と、サブタスクの合計の超過を出す', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'POST /plan-import?dryRun=true': () => ({
        status: 200,
        body: {
          created: 1,
          skipped: 0,
          tasks: [
            {
              action: 'CREATE',
              id: null,
              title: 'Step8',
              dueDate: null,
              dueTime: null,
              priority: 'MEDIUM',
              done: false,
              estimateMinutes: 480,
              subtasks: [
                { title: '解く', done: false, estimateMinutes: 300 },
                { title: '見直す', done: false, estimateMinutes: 330 },
              ],
            },
          ],
        },
      }),
    })
    renderApp('/plan')
    const user = userEvent.setup()

    await user.click(await screen.findByLabelText(/コードブロックの前後/))
    await user.paste('{"tasks":[{"title":"Step8"}]}')
    await user.click(screen.getByRole('button', { name: '内容を確認' }))

    const items = within(await screen.findByRole('list', { name: '登録する内容' })).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('期限なし ・ 目安 8h')
    expect(items[0]).toHaveTextContent('サブタスク 2件 ・ 合計 10h30m')
    expect(items[0]).toHaveTextContent('親の目安（8h）を 2h30m 超えています')
  })
})
