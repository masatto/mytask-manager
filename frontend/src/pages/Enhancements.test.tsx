import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, todayKey } from '../lib/date.ts'
import { EMPTY_COUNTS, installFakeApi, listItem, makeTask } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

const today = todayKey()
const EMPTY_LIST = { status: 200, body: { items: [], hasMore: false } }

describe('検索', () => {
  test('サイドバーの検索欄で Enter を押すと検索画面に結果が出る', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => EMPTY_LIST,
      'GET /tasks/search?q=%E8%A6%8B%E7%A9%8D': () => ({
        status: 200,
        body: {
          items: [
            listItem(makeTask({ id: 1, title: '見積もり（下書き）' })),
            listItem(makeTask({ id: 2, title: '見積もり（済）', status: 'DONE', completedAt: '2026-10-14T09:00:00+09:00' })),
          ],
          hasMore: false,
        },
      }),
    })
    const { router } = renderApp('/today')
    const user = userEvent.setup()

    await user.type(await screen.findByRole('searchbox', { name: 'タスクを検索' }), '見積{Enter}')

    await waitFor(() => expect(router.state.location.pathname).toBe('/search'))
    expect(await screen.findByRole('button', { name: '見積もり（下書き）' })).toBeInTheDocument()
    expect(screen.getByText('2件')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '「見積もり（済）」を完了にする' })).toBeChecked()
    expect(requests.some((r) => r.path.startsWith('/tasks/search'))).toBe(true)
  })

  test('一致しなければその旨を出す', async () => {
    installFakeApi({ 'GET /tasks/counts': () => EMPTY_COUNTS, 'GET /tasks/search?q=zzz': () => EMPTY_LIST })
    renderApp('/search?q=zzz')

    expect(await screen.findByText('「zzz」に一致するタスクはありません')).toBeInTheDocument()
    // 検索画面では、検索欄に今の検索語が入っている
    expect(screen.getByRole('searchbox', { name: 'タスクを検索' })).toHaveValue('zzz')
  })
})

describe('キーボードショートカット', () => {
  test('N でクイック追加、/ で検索欄に移動する', async () => {
    installFakeApi({ 'GET /tasks/counts': () => EMPTY_COUNTS, 'GET /tasks?view=today': () => EMPTY_LIST })
    renderApp('/today')
    const user = userEvent.setup()
    await screen.findByText('今日やることはありません')

    await user.keyboard('n')
    expect(screen.getByRole('textbox', { name: 'タスクを追加' })).toHaveFocus()
    // 入力欄の中では N はただの文字
    await user.keyboard('n')
    expect(screen.getByRole('textbox', { name: 'タスクを追加' })).toHaveValue('n')

    await user.keyboard('{Escape}')
    expect(screen.getByRole('textbox', { name: 'タスクを追加' })).not.toHaveFocus()
    await user.keyboard('/')
    expect(screen.getByRole('searchbox', { name: 'タスクを検索' })).toHaveFocus()
    expect(screen.getByRole('searchbox', { name: 'タスクを検索' })).toHaveValue('')
  })

  test('Esc で詳細パネルを閉じる（入力欄にいるときはまず入力欄から抜ける）', async () => {
    const task = makeTask({ id: 3, title: 't' })
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=no-due': () => ({ status: 200, body: { items: [listItem(task)], hasMore: false } }),
      'GET /tasks/3': () => ({ status: 200, body: { ...task, subtasks: [] } }),
    })
    const { router } = renderApp('/no-due?task=3')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    await user.click(await within(panel).findByRole('textbox', { name: 'タイトル' }))
    await user.keyboard('{Escape}')
    expect(router.state.location.search).toBe('?task=3')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })
})

describe('延期', () => {
  test('一覧の「明日へ」で期限を明日にし（時刻はそのまま）、元に戻すで戻せる', async () => {
    const task = makeTask({ id: 5, title: '請求書を送る', dueDate: addDays(today, -2), dueTime: '18:00', overdue: true })
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({ status: 200, body: { items: [listItem(task)], hasMore: false } }),
      'PUT /tasks/5': (req) => ({ status: 200, body: { ...task, ...(req.body as object) } }),
    })
    renderApp('/today')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '「請求書を送る」を明日に延期' }))

    expect(await screen.findByText('「請求書を送る」を明日に延期しました')).toBeInTheDocument()
    expect(requests.find((r) => r.method === 'PUT')?.body).toMatchObject({
      dueDate: addDays(today, 1),
      dueTime: '18:00',
      status: 'TODO',
    })

    await user.click(screen.getByRole('button', { name: '元に戻す' }))
    await waitFor(() => expect(requests.filter((r) => r.method === 'PUT')).toHaveLength(2))
    expect(requests.filter((r) => r.method === 'PUT')[1].body).toMatchObject({ dueDate: addDays(today, -2) })
  })

  test('期限が明日以降・期限なし・完了済みのタスクには「明日へ」を出さない', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=upcoming': () => ({
        status: 200,
        body: { items: [listItem(makeTask({ id: 6, title: '来週の作業', dueDate: addDays(today, 7) }))], hasMore: false },
      }),
    })
    renderApp('/upcoming')

    await screen.findByRole('button', { name: '来週の作業' })
    expect(screen.queryByRole('button', { name: /明日に延期/ })).not.toBeInTheDocument()
  })

  test('詳細パネルの「明日」ボタンで期限日を入れられる', async () => {
    const task = makeTask({ id: 3, title: 't' })
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=no-due': () => ({ status: 200, body: { items: [listItem(task)], hasMore: false } }),
      'GET /tasks/3': () => ({ status: 200, body: { ...task, subtasks: [] } }),
      'PUT /tasks/3': (req) => ({ status: 200, body: { ...task, ...(req.body as object) } }),
    })
    renderApp('/no-due?task=3')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    const quick = await within(panel).findByRole('group', { name: '期限をすばやく設定' })
    await user.click(within(quick).getByRole('button', { name: '明日' }))
    expect(within(panel).getByLabelText('期限')).toHaveValue(addDays(today, 1))
    await user.click(within(panel).getByRole('button', { name: '保存' }))

    await waitFor(() => expect(requests.find((r) => r.method === 'PUT')?.body).toMatchObject({ dueDate: addDays(today, 1) }))
  })
})

test('ブラウザのタブに今日の件数を出す', async () => {
  installFakeApi({
    'GET /tasks/counts': () => ({ status: 200, body: { today: 3, overdue: 0, upcoming: 0, noDue: 0 } }),
    'GET /tasks?view=today': () => EMPTY_LIST,
  })
  renderApp('/today')

  await waitFor(() => expect(document.title).toBe('(3) Orbit'))
})

test('設定画面に自動バックアップの保存先と保存済みファイルを出す', async () => {
  installFakeApi({
    'GET /tasks/counts': () => EMPTY_COUNTS,
    'GET /backup/auto': () => ({
      status: 200,
      body: {
        directory: 'C:\\Users\\me\\.mytask-manager\\backups',
        keep: 14,
        files: [{ name: 'mytask-manager-auto-20261015.json', size: 4096, createdAt: '2026-10-15T00:05:00+09:00' }],
      },
    }),
  })
  renderApp('/settings')

  const section = await screen.findByRole('region', { name: '自動バックアップ' })
  expect(await within(section).findByText('C:\\Users\\me\\.mytask-manager\\backups')).toBeInTheDocument()
  expect(within(section).getByText('mytask-manager-auto-20261015.json')).toBeInTheDocument()
  expect(within(section).getByText(/直近14\s*日分/)).toBeInTheDocument()
})
