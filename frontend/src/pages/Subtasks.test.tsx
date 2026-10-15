import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Task } from '../api/types.ts'
import { todayKey } from '../lib/date.ts'
import { EMPTY_COUNTS, installFakeApi, listItem, makeTask } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

const today = todayKey()

const parent = makeTask({ id: 1, title: '設計レビューの指摘対応', dueDate: today })
const subtasks: Task[] = [
  makeTask({ id: 11, title: '指摘1', parentId: 1, status: 'DONE', completedAt: '2026-10-14T09:00:00+09:00' }),
  makeTask({ id: 12, title: '指摘2', parentId: 1 }),
  makeTask({ id: 13, title: '指摘3', parentId: 1 }),
]

function parentItem(overrides = {}) {
  return { ...listItem(parent), subtasks, progress: { done: 1, total: 3 }, ...overrides }
}

describe('サブタスク（一覧）', () => {
  test('親の下にサブタスクを表示し、進捗を出し、開閉できる', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({ status: 200, body: { items: [parentItem()], hasMore: false } }),
    })
    renderApp('/today')
    const user = userEvent.setup()

    const list = await screen.findByRole('list', { name: '「設計レビューの指摘対応」のサブタスク' })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('指摘1'),
      expect.stringContaining('指摘2'),
      expect.stringContaining('指摘3'),
    ])
    expect(screen.getByLabelText('サブタスク 1/3 完了')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'サブタスクを閉じる' }))
    expect(screen.queryByRole('list', { name: '「設計レビューの指摘対応」のサブタスク' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'サブタスクを開く' }))
    expect(screen.getByRole('list', { name: '「設計レビューの指摘対応」のサブタスク' })).toBeInTheDocument()
  })

  test('未完了のサブタスクが残る親を完了にすると D1 を出し、OKなら一括完了する', async () => {
    let calls = 0
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({ status: 200, body: { items: [parentItem()], hasMore: false } }),
      'PATCH /tasks/1/status': () =>
        ++calls === 1
          ? { status: 409, body: { code: 'SUBTASKS_INCOMPLETE', message: 'x', incompleteCount: 2 } }
          : {
              status: 200,
              body: {
                changed: [
                  { id: 12, previousStatus: 'TODO', status: 'DONE' },
                  { id: 13, previousStatus: 'TODO', status: 'DONE' },
                  { id: 1, previousStatus: 'TODO', status: 'DONE' },
                ],
              },
            },
    })
    renderApp('/today')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('checkbox', { name: '「設計レビューの指摘対応」を完了にする' }))

    const dialog = await screen.findByRole('alertdialog', {
      name: '未完了のサブタスクが2件あります。すべて完了にしますか？',
    })
    // 確定するまでチェックは付かない
    expect(screen.getByRole('checkbox', { name: '「設計レビューの指摘対応」を完了にする' })).not.toBeChecked()

    await user.click(within(dialog).getByRole('button', { name: 'すべて完了' }))

    expect(await screen.findByText('完了にしました')).toBeInTheDocument()
    expect(requests.filter((r) => r.path === '/tasks/1/status').map((r) => r.body)).toEqual([
      { status: 'DONE' },
      { status: 'DONE', completeSubtasks: true },
    ])
  })

  test('D1 でキャンセルすると何も変更しない', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({ status: 200, body: { items: [parentItem()], hasMore: false } }),
      'PATCH /tasks/1/status': () => ({
        status: 409,
        body: { code: 'SUBTASKS_INCOMPLETE', message: 'x', incompleteCount: 2 },
      }),
    })
    renderApp('/today')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('checkbox', { name: '「設計レビューの指摘対応」を完了にする' }))
    await user.click(await screen.findByRole('button', { name: 'キャンセル' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(requests.filter((r) => r.method === 'PATCH')).toHaveLength(1)
  })
})

describe('サブタスク（詳細パネル）', () => {
  function installPanelApi(extra = {}) {
    return installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({ status: 200, body: { items: [parentItem()], hasMore: false } }),
      'GET /tasks/1': () => ({ status: 200, body: { ...parent, subtasks } }),
      'GET /tasks/12': () => ({
        status: 200,
        body: { ...subtasks[1], parent: { id: 1, title: parent.title } },
      }),
      ...extra,
    })
  }

  test('親のパネルでサブタスクを追加できる', async () => {
    const { requests } = installPanelApi({
      'POST /tasks': () => ({ status: 201, body: makeTask({ id: 14, title: '指摘4', parentId: 1 }) }),
    })
    renderApp('/today?task=1')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    const section = await within(panel).findByRole('region', { name: 'サブタスク' })
    expect(within(section).getByText('1/3')).toBeInTheDocument()

    await user.type(within(section).getByRole('textbox', { name: 'サブタスクを追加' }), '指摘4{Enter}')

    await waitFor(() =>
      expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ title: '指摘4', dueDate: null, parentId: 1 }),
    )
  })

  test('サブタスクをクリックするとパネルが切り替わり、親へのリンクで戻れる', async () => {
    installPanelApi()
    const { router } = renderApp('/today?task=1')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    await user.click(await within(panel).findByRole('button', { name: '指摘2' }))

    await waitFor(() => expect(router.state.location.search).toBe('?task=12'))
    const subPanel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    expect(await within(subPanel).findByRole('textbox', { name: 'タイトル' })).toHaveValue('指摘2')
    // サブタスクのパネルにはサブタスク欄を出さない
    expect(within(subPanel).queryByRole('region', { name: 'サブタスク' })).not.toBeInTheDocument()

    await user.click(within(subPanel).getByRole('button', { name: `← ${parent.title}` }))
    await waitFor(() => expect(router.state.location.search).toBe('?task=1'))
  })

  test('サブタスクがある親を削除しようとすると件数付きの確認を出す', async () => {
    installPanelApi()
    renderApp('/today?task=1')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    await within(panel).findByRole('region', { name: 'サブタスク' })
    await user.click(within(panel).getByRole('button', { name: '削除' }))

    expect(
      await screen.findByRole('alertdialog', { name: 'サブタスク3件も削除されます。削除しますか？' }),
    ).toBeInTheDocument()
  })

  test('保存でステータスを完了にすると D1 を出し、一括完了してから保存する', async () => {
    const { requests } = installPanelApi({
      'PATCH /tasks/1/status': () => ({ status: 200, body: { changed: [] } }),
      'PUT /tasks/1': (req: { body: unknown }) => ({ status: 200, body: { ...parent, ...(req.body as object) } }),
    })
    renderApp('/today?task=1')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    await user.selectOptions(await within(panel).findByLabelText('ステータス'), 'DONE')
    await user.click(within(panel).getByRole('button', { name: '保存' }))

    const dialog = await screen.findByRole('alertdialog', {
      name: '未完了のサブタスクが2件あります。すべて完了にしますか？',
    })
    expect(requests.some((r) => r.method === 'PUT')).toBe(false)

    await user.click(within(dialog).getByRole('button', { name: 'すべて完了' }))

    expect(await screen.findByText('保存しました')).toBeInTheDocument()
    const writes = requests.filter((r) => r.method !== 'GET').map((r) => `${r.method} ${r.path}`)
    expect(writes).toEqual(['PATCH /tasks/1/status', 'PUT /tasks/1'])
    expect(requests.find((r) => r.method === 'PATCH')?.body).toEqual({ status: 'DONE', completeSubtasks: true })
  })
})
