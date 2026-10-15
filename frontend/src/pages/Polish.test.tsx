import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, todayKey } from '../lib/date.ts'
import { EMPTY_COUNTS, installFakeApi, listItem, makeTask } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

const today = todayKey()

describe('期限切れをすべて今日へ', () => {
  test('期限切れの親とサブタスクを今日に移し（過ぎた時刻は消す）、元に戻すで元の期限に戻す', async () => {
    const parent = makeTask({ id: 1, title: '請求書', dueDate: addDays(today, -2), dueTime: '23:59', overdue: true })
    const sub = makeTask({ id: 2, title: '見積書', parentId: 1, dueDate: addDays(today, -1), dueTime: '00:00', overdue: true })
    const notOverdue = makeTask({ id: 3, title: '下書き', parentId: 1 })
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({
        status: 200,
        body: { items: [{ ...listItem(parent), subtasks: [sub, notOverdue], viewOverdue: true }], hasMore: false },
      }),
      'PUT /tasks/1': (req) => ({ status: 200, body: { ...parent, ...(req.body as object) } }),
      'PUT /tasks/2': (req) => ({ status: 200, body: { ...sub, ...(req.body as object) } }),
    })
    renderApp('/today')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'すべて今日へ' }))

    expect(await screen.findByText('期限切れの2件を今日にしました')).toBeInTheDocument()
    const puts = () => requests.filter((r) => r.method === 'PUT')
    expect(puts().map((r) => [r.path, (r.body as { dueDate: string }).dueDate, (r.body as { dueTime: string }).dueTime])).toEqual([
      ['/tasks/1', today, '23:59'],
      ['/tasks/2', today, null], // 今日の 00:00 はもう過ぎているので時刻を消す
    ])

    await user.click(screen.getByRole('button', { name: '元に戻す' }))
    await waitFor(() => expect(puts()).toHaveLength(4))
    expect(puts().slice(2).map((r) => [r.path, (r.body as { dueDate: string }).dueDate, (r.body as { dueTime: string }).dueTime])).toEqual([
      ['/tasks/1', addDays(today, -2), '23:59'],
      ['/tasks/2', addDays(today, -1), '00:00'],
    ])
  })
})

test('Today に今日の進み具合を出す', async () => {
  installFakeApi({
    'GET /tasks/counts': () => ({ status: 200, body: { today: 2, overdue: 0, upcoming: 0, noDue: 0, doneToday: 3 } }),
    'GET /tasks?view=today': () => ({ status: 200, body: { items: [], hasMore: false } }),
  })
  renderApp('/today')

  expect(await screen.findByRole('img', { name: '今日の進み具合：3件完了、残り2件' })).toHaveTextContent('3件完了・残り2件')
})

describe('詳細パネル', () => {
  const task = makeTask({
    id: 3,
    title: 'API設計書',
    memo: '参考：https://example.com/spec?a=1 と（https://example.org/guide）',
    dueDate: today,
    dueTime: '10:00',
    priority: 'HIGH',
  })
  const subs = [makeTask({ id: 4, title: '一覧API', parentId: 3, priority: 'LOW' })]

  function setup() {
    return installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({ status: 200, body: { items: [listItem(task)], hasMore: false } }),
      'GET /tasks/3': () => ({ status: 200, body: { ...task, subtasks: subs } }),
      'GET /tasks/10': () => ({ status: 200, body: { ...task, id: 10, title: 'API設計書（コピー）', subtasks: [] } }),
      'POST /tasks': (req) => {
        const body = req.body as { parentId?: number }
        return { status: 201, body: makeTask({ id: body.parentId ? 11 : 10, ...(req.body as object) }) }
      },
    })
  }

  test('メモの URL をリンクとして出す', async () => {
    setup()
    renderApp('/today?task=3')

    const links = await screen.findByRole('list', { name: 'メモのリンク' })
    expect(within(links).getByRole('link', { name: 'example.com/spec?a=1' })).toHaveAttribute('href', 'https://example.com/spec?a=1')
    expect(within(links).getByRole('link', { name: 'example.org/guide' })).toHaveAttribute('target', '_blank')
  })

  test('複製すると、サブタスクごと写したタスクを作ってパネルで開く', async () => {
    const { requests } = setup()
    const { router } = renderApp('/today?task=3')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    await user.click(await within(panel).findByRole('button', { name: '複製' }))

    await waitFor(() => expect(router.state.location.search).toBe('?task=10'))
    expect(screen.getByText('複製しました')).toBeInTheDocument()
    expect(requests.filter((r) => r.method === 'POST').map((r) => r.body)).toEqual([
      { title: 'API設計書（コピー）', memo: task.memo, dueDate: today, dueTime: '10:00', priority: 'HIGH' },
      { title: '一覧API', memo: null, dueDate: null, dueTime: null, priority: 'LOW', parentId: 10 },
    ])
  })
})

test('設定画面の自動バックアップ一覧から復元できる（検証 → 確認 → 置き換え）', async () => {
  const { requests } = installFakeApi({
    'GET /tasks/counts': () => EMPTY_COUNTS,
    'GET /backup/auto': () => ({
      status: 200,
      body: { directory: 'C:\\b', keep: 14, files: [{ name: 'orbit-auto-20261015.json', size: 2048, createdAt: null }] },
    }),
    'POST /backup/auto/orbit-auto-20261015.json/import?dryRun=true': () => ({
      status: 200,
      body: { current: { tasks: 5, rules: 1 }, incoming: { tasks: 4, rules: 1 } },
    }),
    'POST /backup/auto/orbit-auto-20261015.json/import?dryRun=false': () => ({ status: 204 }),
  })
  renderApp('/settings')
  const user = userEvent.setup()

  await user.click(await screen.findByRole('button', { name: 'orbit-auto-20261015.json から復元' }))
  const dialog = await screen.findByRole('alertdialog', { name: '現在のデータはすべて置き換えられます。' })
  expect(dialog).toHaveTextContent('タスク 5件 → 4件')
  await user.click(within(dialog).getByRole('button', { name: '置き換える' }))

  expect(await screen.findByText('orbit-auto-20261015.json からインポートしました')).toBeInTheDocument()
  expect(requests.some((r) => r.path === '/backup/auto/orbit-auto-20261015.json/import?dryRun=false')).toBe(true)
})

test('Today の一番下に「今日完了」を出し、開くと並び、チェックを外すと未完了に戻せる', async () => {
  const done = makeTask({ id: 8, title: '健康診断の予約', status: 'DONE', completedAt: `${today}T15:51:00+09:00` })
  const { requests } = installFakeApi({
    'GET /tasks/counts': () => ({ status: 200, body: { today: 0, overdue: 0, upcoming: 0, noDue: 0, doneToday: 1 } }),
    'GET /tasks?view=today': () => ({ status: 200, body: { items: [], hasMore: false } }),
    'GET /tasks?view=done-today': () => ({ status: 200, body: { items: [listItem(done)], hasMore: false } }),
    'PATCH /tasks/8/status': () => ({ status: 200, body: { changed: [{ id: 8, previousStatus: 'DONE', status: 'TODO' }] } }),
  })
  renderApp('/today')
  const user = userEvent.setup()

  expect(await screen.findByRole('img', { name: '今日の進み具合：1件完了、残り0件' })).toBeInTheDocument()
  const toggle = await screen.findByRole('button', { name: /今日完了/ })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: '健康診断の予約' })).not.toBeInTheDocument()

  await user.click(toggle)
  const section = screen.getByRole('region', { name: '今日完了' })
  expect(within(section).getByText('完了 15:51')).toBeInTheDocument()
  await user.click(within(section).getByRole('checkbox', { name: '「健康診断の予約」を完了にする' }))

  await waitFor(() => expect(requests.find((r) => r.method === 'PATCH')?.body).toEqual({ status: 'TODO' }))
})
