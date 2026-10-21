import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { todayKey } from '../lib/date.ts'
import { EMPTY_COUNTS, installFakeApi, listItem, makeTask } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

const today = todayKey()

describe('TaskListPage', () => {
  test('今日ビューは期限切れと今日のグループに分けて表示する', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({
        status: 200,
        body: {
          items: [
            listItem(makeTask({ id: 1, title: '請求書を送る', dueDate: '2026-10-12', overdue: true })),
            listItem(makeTask({ id: 2, title: '歯医者の予約', dueDate: today, dueTime: '10:00' })),
          ],
          hasMore: false,
        },
      }),
    })
    renderApp('/today')

    const overdue = await screen.findByRole('region', { name: '期限切れ' })
    expect(within(overdue).getByText('請求書を送る')).toBeInTheDocument()
    expect(within(overdue).getByText('10/12(月)')).toBeInTheDocument()
    const todayGroup = screen.getByRole('region', { name: '今日' })
    // 今日のグループでは日付を省略し、時刻だけを出す
    expect(within(todayGroup).getByText('10:00')).toBeInTheDocument()
  })

  test('0件なら空の表示を出す', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({ status: 200, body: { items: [], hasMore: false } }),
    })
    renderApp('/today')

    expect(await screen.findByText('今日やることはありません')).toBeInTheDocument()
  })

  test('読み込みに失敗したら再試行ボタンを出す', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({ status: 500, body: { code: 'INTERNAL_ERROR', message: 'x' } }),
    })
    renderApp('/today')

    expect(await screen.findByRole('alert')).toHaveTextContent('読み込みに失敗しました')
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument()
  })

  test('クイック追加は期限を今日にして登録し、入力欄を空に戻す', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({ status: 200, body: { items: [], hasMore: false } }),
      'POST /tasks': () => ({ status: 201, body: makeTask({ id: 10, title: '新しいタスク' }) }),
    })
    renderApp('/today')
    const user = userEvent.setup()

    const input = await screen.findByRole('textbox', { name: 'タスクを追加' })
    await user.type(input, '  新しいタスク  {Enter}')

    await waitFor(() => expect(input).toHaveValue(''))
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ title: '新しいタスク', dueDate: today, areaId: null })
    expect(input).toHaveFocus()
  })

  test('完了にすると「元に戻す」付きのトーストを出し、元に戻すと前のステータスに戻す', async () => {
    const task = makeTask({ id: 7, title: '週次の振り返り', dueDate: today, status: 'IN_PROGRESS' })
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({ status: 200, body: { items: [listItem(task)], hasMore: false } }),
      'PATCH /tasks/7/status': () => ({
        status: 200,
        body: { changed: [{ id: 7, previousStatus: 'IN_PROGRESS', status: 'DONE' }] },
      }),
      'PATCH /tasks/statuses': () => ({ status: 204 }),
    })
    renderApp('/today')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('checkbox', { name: '「週次の振り返り」を完了にする' }))

    expect(await screen.findByText('完了にしました')).toBeInTheDocument()
    expect(requests.find((r) => r.path === '/tasks/7/status')?.body).toEqual({ status: 'DONE' })

    await user.click(screen.getByRole('button', { name: '元に戻す' }))

    await waitFor(() =>
      expect(requests.find((r) => r.path === '/tasks/statuses')?.body).toEqual({
        changes: [{ id: 7, status: 'IN_PROGRESS' }],
      }),
    )
  })

  test('タイトルをクリックすると詳細パネルが開き、編集して保存できる', async () => {
    const task = makeTask({ id: 3, title: 'API設計書を書く' })
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=no-due': () => ({ status: 200, body: { items: [listItem(task)], hasMore: false } }),
      'GET /tasks/3': () => ({ status: 200, body: { ...task, subtasks: [] } }),
      'PUT /tasks/3': (req) => ({ status: 200, body: { ...task, ...(req.body as object) } }),
    })
    const { router } = renderApp('/no-due')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'API設計書を書く' }))
    expect(router.state.location.search).toBe('?task=3')

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    const title = await within(panel).findByRole('textbox', { name: 'タイトル' })
    const save = within(panel).getByRole('button', { name: '保存' })
    expect(save).toBeDisabled()

    await user.clear(title)
    await user.type(title, 'API設計書を仕上げる')
    await user.click(within(panel).getByRole('radio', { name: '高' }))
    await user.type(within(panel).getByLabelText('期限'), '2026-10-20')
    await user.type(within(panel).getByLabelText('目安時間'), '90')
    await user.click(save)

    expect(await screen.findByText('保存しました')).toBeInTheDocument()
    expect(requests.find((r) => r.method === 'PUT')?.body).toEqual({
      title: 'API設計書を仕上げる',
      memo: null,
      dueDate: '2026-10-20',
      dueTime: null,
      priority: 'HIGH',
      status: 'TODO',
      areaId: null,
      estimateMinutes: 90,
    })
  })

  test('未保存の変更があるパネルを閉じようとすると確認ダイアログを出す', async () => {
    const task = makeTask({ id: 3, title: 'API設計書を書く' })
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=no-due': () => ({ status: 200, body: { items: [listItem(task)], hasMore: false } }),
      'GET /tasks/3': () => ({ status: 200, body: { ...task, subtasks: [] } }),
    })
    const { router } = renderApp('/no-due?task=3')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    await user.type(await within(panel).findByRole('textbox', { name: 'タイトル' }), '!')
    await user.click(within(panel).getByRole('button', { name: 'キャンセル' }))

    const dialog = await screen.findByRole('alertdialog', { name: '変更を破棄しますか？' })
    await user.click(within(dialog).getByRole('button', { name: '編集に戻る' }))
    expect(router.state.location.search).toBe('?task=3')

    await user.click(within(panel).getByRole('button', { name: 'キャンセル' }))
    await user.click(await screen.findByRole('button', { name: '破棄' }))
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  test('未保存の変更がある状態でサイドバーから別のビューへ移ろうとすると D4 を出す', async () => {
    const task = makeTask({ id: 3, title: 'API設計書を書く' })
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=no-due': () => ({ status: 200, body: { items: [listItem(task)], hasMore: false } }),
      'GET /tasks?view=today': () => ({ status: 200, body: { items: [], hasMore: false } }),
      'GET /tasks/3': () => ({ status: 200, body: { ...task, subtasks: [] } }),
    })
    const { router } = renderApp('/no-due?task=3')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    await user.type(await within(panel).findByRole('textbox', { name: 'タイトル' }), '!')
    await user.click(screen.getByRole('link', { name: /^Today/ }))

    const dialog = await screen.findByRole('alertdialog', { name: '変更を破棄しますか？' })
    expect(router.state.location.pathname).toBe('/no-due')
    await user.click(within(dialog).getByRole('button', { name: '破棄' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/today'))
  })

  test('未保存の変更がある状態でブラウザの戻るを押すと D4 を出し、編集に戻れる', async () => {
    const task = makeTask({ id: 3, title: 'API設計書を書く' })
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=no-due': () => ({ status: 200, body: { items: [listItem(task)], hasMore: false } }),
      'GET /tasks/3': () => ({ status: 200, body: { ...task, subtasks: [] } }),
    })
    const { router } = renderApp('/no-due')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'API設計書を書く' }))
    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    await user.type(await within(panel).findByRole('textbox', { name: 'タイトル' }), '!')
    await router.navigate(-1)

    const dialog = await screen.findByRole('alertdialog', { name: '変更を破棄しますか？' })
    await user.click(within(dialog).getByRole('button', { name: '編集に戻る' }))
    expect(router.state.location.search).toBe('?task=3')
    expect(within(panel).getByRole('textbox', { name: 'タイトル' })).toHaveValue('API設計書を書く!')
  })

  test('時刻だけの期限は保存できない（日付を空にすると時刻も消える）', async () => {
    const task = makeTask({ id: 3, title: 't', dueDate: '2026-10-20', dueTime: '10:00' })
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=upcoming': () => ({ status: 200, body: { items: [listItem(task)], hasMore: false } }),
      'GET /tasks/3': () => ({ status: 200, body: { ...task, subtasks: [] } }),
      'PUT /tasks/3': (req) => ({ status: 200, body: { ...task, ...(req.body as object) } }),
    })
    renderApp('/upcoming?task=3')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    await user.click(await within(panel).findByRole('button', { name: 'クリア' }))
    expect(within(panel).getByLabelText('期限時刻')).toBeDisabled()
    await user.click(within(panel).getByRole('button', { name: '保存' }))

    await waitFor(() => expect(requests.some((r) => r.method === 'PUT')).toBe(true))
    expect(requests.find((r) => r.method === 'PUT')?.body).toMatchObject({ dueDate: null, dueTime: null })
  })
})
