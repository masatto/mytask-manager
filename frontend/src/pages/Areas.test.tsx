import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Area } from '../api/areas.ts'
import { todayKey } from '../lib/date.ts'
import { EMPTY_COUNTS, installFakeApi, listItem, makeTask } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

const today = todayKey()

const AREAS: Area[] = [
  { id: 1, name: 'Project', color: 'blue', taskCount: 2, ruleCount: 0 },
  { id: 2, name: 'Internal', color: 'green', taskCount: 1, ruleCount: 1 },
]
const AREA_LIST = { status: 200, body: { items: AREAS } }

const PROJECT_TASK = makeTask({ id: 10, title: '設計レビュー', dueDate: today, areaId: 1 })
const INTERNAL_TASK = makeTask({ id: 11, title: '勤怠の締め', dueDate: today, areaId: 2 })

function todayList(items: ReturnType<typeof makeTask>[]) {
  return { status: 200, body: { items: items.map(listItem), hasMore: false } }
}

describe('エリア', () => {
  test('「すべて」では両方のタスクにエリアのバッジを付け、タブで選ぶとそのエリアだけを問い合わせる', async () => {
    const { requests } = installFakeApi({
      'GET /areas': () => AREA_LIST,
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks/counts?area=2': () => ({ status: 200, body: { ...EMPTY_COUNTS.body, today: 1 } }),
      'GET /tasks?view=today': () => todayList([PROJECT_TASK, INTERNAL_TASK]),
      'GET /tasks?view=today&area=2': () => todayList([INTERNAL_TASK]),
      'GET /tasks?view=done-today': () => todayList([]),
      'GET /tasks?view=done-today&area=2': () => todayList([]),
    })
    renderApp('/today')
    const user = userEvent.setup()

    const tabs = await screen.findByRole('group', { name: 'エリア' })
    expect(within(tabs).getByRole('button', { name: 'すべて' })).toHaveAttribute('aria-pressed', 'true')
    const row = (await screen.findByRole('button', { name: '勤怠の締め' })).parentElement!
    expect(within(row).getByText('Internal')).toBeInTheDocument()

    await user.click(within(tabs).getByRole('button', { name: 'Internal' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: '設計レビュー' })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: '勤怠の締め' })).toBeInTheDocument()
    expect(requests.some((r) => r.path === '/tasks/counts?area=2')).toBe(true)
    // 見出しに選んでいるエリア。絞り込み中は行のバッジは出さない
    expect(screen.getByLabelText('エリア：Internal')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: '勤怠の締め' }).parentElement!).queryByText('Internal')).toBeNull()
    // 選んだエリアは次に開いたときのために残す
    expect(localStorage.getItem('orbit.area')).toBe('2')
  })

  test('選んでいたエリアが消されていたら「すべて」に戻す', async () => {
    localStorage.setItem('orbit.area', '99')
    installFakeApi({
      'GET /areas': () => AREA_LIST,
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => todayList([PROJECT_TASK]),
      'GET /tasks?view=done-today': () => todayList([]),
    })
    renderApp('/today')

    expect(await screen.findByRole('button', { name: '設計レビュー' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'すべて' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(localStorage.getItem('orbit.area')).toBeNull())
  })

  test('クイック追加は選んでいるエリアに入れ、@名前 で別のエリアを指定できる', async () => {
    localStorage.setItem('orbit.area', '1')
    const { requests } = installFakeApi({
      'GET /areas': () => AREA_LIST,
      'GET /tasks/counts?area=1': () => EMPTY_COUNTS,
      'GET /tasks?view=today&area=1': () => todayList([]),
      'GET /tasks?view=done-today&area=1': () => todayList([]),
      'POST /tasks': () => ({ status: 201, body: makeTask({ id: 20 }) }),
    })
    renderApp('/today')
    const user = userEvent.setup()
    const input = await screen.findByRole('textbox', { name: 'タスクを追加' })

    await user.type(input, '結合テスト{Enter}')
    await waitFor(() => expect(requests.filter((r) => r.method === 'POST')).toHaveLength(1))
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ title: '結合テスト', dueDate: today, areaId: 1 })

    await user.type(input, '研修アンケート @int')
    expect(screen.getByRole('status', { name: '読み取った内容' })).toHaveTextContent('エリア Internal')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(requests.filter((r) => r.method === 'POST')).toHaveLength(2))
    expect(requests.filter((r) => r.method === 'POST')[1].body).toEqual({ title: '研修アンケート', dueDate: today, areaId: 2 })
  })

  test('詳細パネルでエリアを付け替えられる（サブタスクには出さない）', async () => {
    const { requests } = installFakeApi({
      'GET /areas': () => AREA_LIST,
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => todayList([PROJECT_TASK]),
      'GET /tasks?view=done-today': () => todayList([]),
      'GET /tasks/10': () => ({ status: 200, body: { ...PROJECT_TASK, subtasks: [] } }),
      'PUT /tasks/10': (req) => ({ status: 200, body: { ...PROJECT_TASK, ...(req.body as object) } }),
    })
    renderApp('/today?task=10')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
    const group = await within(panel).findByRole('radiogroup', { name: 'エリア' })
    expect(within(group).getByRole('radio', { name: 'Project' })).toBeChecked()
    await user.click(within(group).getByRole('radio', { name: 'Internal' }))
    await user.click(within(panel).getByRole('button', { name: '保存' }))

    expect(await screen.findByText('保存しました')).toBeInTheDocument()
    expect(requests.find((r) => r.method === 'PUT')?.body).toMatchObject({ areaId: 2 })
  })

  test('エリアがなければタブも選択欄も出さない', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=no-due': () => todayList([makeTask({ id: 3, title: 'メモ' })]),
      'GET /tasks/3': () => ({ status: 200, body: { ...makeTask({ id: 3, title: 'メモ' }), subtasks: [] } }),
    })
    renderApp('/no-due?task=3')

    await screen.findByRole('complementary', { name: 'タスク詳細' })
    expect(screen.queryByRole('group', { name: 'エリア' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'エリア' })).not.toBeInTheDocument()
  })
})

describe('設定画面のエリア', () => {
  function setup(extra: Parameters<typeof installFakeApi>[0] = {}) {
    return installFakeApi({
      'GET /areas': () => AREA_LIST,
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /backup/auto': () => ({ status: 200, body: { directory: 'C:\\b', keep: 14, files: [], mirrorDirectory: null, mirrorError: null, mirrorFiles: [] } }),
      ...extra,
    })
  }

  test('追加・名前の変更・並べ替えができる', async () => {
    const { requests } = setup({
      'POST /areas': () => ({ status: 201, body: { id: 3, name: '案件A', color: 'purple', taskCount: 0, ruleCount: 0 } }),
      'PUT /areas/2': (req) => ({ status: 200, body: { ...AREAS[1], ...(req.body as object) } }),
      'PUT /areas/order': () => ({ status: 200, body: { items: [AREAS[1], AREAS[0]] } }),
    })
    renderApp('/settings')
    const user = userEvent.setup()
    const card = await screen.findByRole('region', { name: 'エリア' })

    await user.type(await within(card).findByLabelText('新しいエリアの名前'), '案件A{Enter}')
    // 色は、まだ使っていない色から選んでおく
    await waitFor(() => expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ name: '案件A', color: 'purple' }))

    const name = within(card).getByLabelText('「Internal」の名前')
    await user.clear(name)
    await user.type(name, '社内')
    await user.click(within(card).getByRole('button', { name: '保存' }))
    await waitFor(() =>
      expect(requests.find((r) => r.path === '/areas/2')?.body).toEqual({ name: '社内', color: 'green' }),
    )

    await user.click(within(card).getByRole('button', { name: '「Internal」を上へ' }))
    await waitFor(() => expect(requests.find((r) => r.path === '/areas/order')?.body).toEqual({ ids: [2, 1] }))
    expect(within(card).getByRole('button', { name: '「Project」を上へ' })).toBeDisabled()
  })

  test('同じ名前などのエラーは、その行に出す', async () => {
    setup({
      'PUT /areas/2': () => ({
        status: 400,
        body: { code: 'VALIDATION_ERROR', message: 'x', fieldErrors: [{ field: 'name', message: '同じ名前のエリアがあります' }] },
      }),
    })
    renderApp('/settings')
    const user = userEvent.setup()
    const name = await screen.findByLabelText('「Internal」の名前')

    await user.clear(name)
    await user.type(name, 'project{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('同じ名前のエリアがあります')
  })

  test('削除するときは、タスクとルールの移動先を選ぶ', async () => {
    const { requests } = setup({ 'DELETE /areas/2': () => ({ status: 204 }) })
    renderApp('/settings')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '「Internal」を削除' }))
    const dialog = screen.getByRole('alertdialog', { name: 'エリア「Internal」を削除しますか？' })
    expect(dialog).toHaveTextContent('タスク 1件・繰り返しルール 1件があります')
    await user.selectOptions(within(dialog).getByLabelText('移動先'), '未分類（「すべて」でだけ表示）')
    await user.click(within(dialog).getByRole('button', { name: '削除' }))

    await waitFor(() => expect(requests.some((r) => r.method === 'DELETE' && r.path === '/areas/2')).toBe(true))
    expect(await screen.findByText('エリア「Internal」を削除しました')).toBeInTheDocument()
  })

  test('10個あれば追加欄の代わりに上限を知らせる', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...AREAS[0], id: i + 1, name: `A${i + 1}` }))
    setup({ 'GET /areas': () => ({ status: 200, body: { items: many } }) })
    renderApp('/settings')

    expect(await screen.findByText(/エリアは10個までです。/)).toBeInTheDocument()
    expect(screen.queryByLabelText('新しいエリアの名前')).not.toBeInTheDocument()
  })
})
