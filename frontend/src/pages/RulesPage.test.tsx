import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Rule } from '../api/types.ts'
import { todayKey } from '../lib/date.ts'
import { EMPTY_COUNTS, installFakeApi, listItem, makeTask } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 1,
    title: '週次の振り返り',
    memo: null,
    priority: 'MEDIUM',
    dueTime: null,
    pattern: { type: 'WEEKLY', daysOfWeek: ['MON', 'THU'], dayOfMonth: null },
    startDate: '2026-10-01',
    endDate: null,
    active: true,
    subtaskTemplates: [],
    areaId: null,
    nextOccurrence: '2026-10-19',
    lastGeneratedDate: '2026-10-15',
    createdAt: '2026-10-01T09:00:00+09:00',
    updatedAt: '2026-10-01T09:00:00+09:00',
    ...overrides,
  }
}

const PREVIEW = { status: 200, body: { occurrences: ['2026-10-19', '2026-10-26', '2026-11-02'] } }

describe('S3 繰り返しルール一覧', () => {
  test('パターンの説明と次回の生成日を表示し、停止中は「停止中」と出す', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /rules': () => ({
        status: 200,
        body: {
          items: [
            makeRule(),
            makeRule({
              id: 2,
              title: '家賃振込',
              pattern: { type: 'MONTHLY', daysOfWeek: null, dayOfMonth: -1 },
              active: false,
              nextOccurrence: null,
            }),
          ],
        },
      }),
    })
    renderApp('/rules')

    const rows = await screen.findAllByRole('row')
    expect(rows.slice(1).map((r) => r.textContent)).toEqual([
      '週次の振り返り毎週 月・木10/19(月)',
      '家賃振込毎月 末日—（停止中）',
    ])
    expect(screen.getByRole('switch', { name: '「家賃振込」を有効にする' })).not.toBeChecked()
  })

  test('0件なら空の表示を出す', async () => {
    installFakeApi({ 'GET /tasks/counts': () => EMPTY_COUNTS, 'GET /rules': () => ({ status: 200, body: { items: [] } }) })
    renderApp('/rules')

    expect(await screen.findByText('繰り返しルールはありません')).toBeInTheDocument()
  })

  test('スイッチで停止できる', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /rules': () => ({ status: 200, body: { items: [makeRule()] } }),
      'PATCH /rules/1/active': () => ({ status: 200, body: makeRule({ active: false, nextOccurrence: null }) }),
    })
    renderApp('/rules')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('switch', { name: '「週次の振り返り」を有効にする' }))

    expect(await screen.findByText('「週次の振り返り」を停止しました')).toBeInTheDocument()
    expect(requests.find((r) => r.method === 'PATCH')?.body).toEqual({ active: false })
  })
})

describe('S4 繰り返しルール編集', () => {
  test('新規ルールを作成する（ひな形つき）', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /rules': () => ({ status: 200, body: { items: [] } }),
      'POST /rules/preview': () => PREVIEW,
      'POST /rules': (req) => ({ status: 201, body: makeRule({ id: 5, ...(req.body as object) }) }),
      'GET /rules/5': () => ({ status: 200, body: makeRule({ id: 5 }) }),
    })
    const { router } = renderApp('/rules')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '＋ 新規ルール' }))
    const panel = await screen.findByRole('complementary', { name: '繰り返しルールの編集' })

    await user.type(within(panel).getByLabelText('タイトル'), '週次の振り返り')
    // 初期値は今日の曜日だけが選ばれているので、いったん全部外してから月・木を選ぶ
    const weekdays = within(panel).getByRole('group', { name: '曜日' })
    for (const box of within(weekdays).getAllByRole('checkbox')) {
      if ((box as HTMLInputElement).checked) {
        await user.click(box)
      }
    }
    await user.click(within(weekdays).getByLabelText('月'))
    await user.click(within(weekdays).getByLabelText('木'))
    await user.type(within(panel).getByLabelText('期限時刻'), '09:00')
    await user.click(within(panel).getByRole('button', { name: '＋ 追加' }))
    await user.type(within(panel).getByLabelText('ひな形1のタイトル'), '来週の計画')

    expect(await within(panel).findByText('10/19(月)、10/26(月)、11/2(月)')).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: '作成' }))

    expect(await screen.findByText('ルールを作成しました')).toBeInTheDocument()
    expect(requests.find((r) => r.path === '/rules' && r.method === 'POST')?.body).toEqual({
      title: '週次の振り返り',
      memo: null,
      priority: 'MEDIUM',
      dueTime: '09:00',
      pattern: { type: 'WEEKLY', daysOfWeek: ['MON', 'THU'], dayOfMonth: null },
      startDate: todayKey(),
      endDate: null,
      active: true,
      subtaskTemplates: [{ title: '来週の計画', priority: 'MEDIUM' }],
      areaId: null,
    })
    await waitFor(() => expect(router.state.location.search).toBe('?rule=5'))
  })

  test('毎月・末日を選ぶと dayOfMonth は -1 で送る', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /rules': () => ({ status: 200, body: { items: [] } }),
      'POST /rules/preview': () => PREVIEW,
      'POST /rules': (req) => ({ status: 201, body: makeRule({ id: 6, ...(req.body as object) }) }),
      'GET /rules/6': () => ({ status: 200, body: makeRule({ id: 6 }) }),
    })
    renderApp('/rules?rule=new')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: '繰り返しルールの編集' })
    await user.type(within(panel).getByLabelText('タイトル'), '家賃振込')
    await user.click(within(panel).getByRole('radio', { name: '毎月' }))
    expect(within(panel).queryByRole('group', { name: '曜日' })).not.toBeInTheDocument()
    await user.selectOptions(within(panel).getByLabelText('日付'), '-1')
    await user.click(within(panel).getByRole('button', { name: '作成' }))

    await waitFor(() =>
      expect(requests.find((r) => r.path === '/rules' && r.method === 'POST')?.body).toMatchObject({
        pattern: { type: 'MONTHLY', daysOfWeek: null, dayOfMonth: -1 },
      }),
    )
  })

  test('毎週で曜日を1つも選ばないと保存できない', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /rules': () => ({ status: 200, body: { items: [] } }),
      'POST /rules/preview': () => PREVIEW,
    })
    renderApp('/rules?rule=new')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: '繰り返しルールの編集' })
    await user.type(within(panel).getByLabelText('タイトル'), 't')
    const weekdays = within(panel).getByRole('group', { name: '曜日' })
    for (const box of within(weekdays).getAllByRole('checkbox')) {
      if ((box as HTMLInputElement).checked) {
        await user.click(box)
      }
    }
    await user.click(within(panel).getByRole('button', { name: '作成' }))

    expect(await within(panel).findByText('曜日を1つ以上選んでください')).toBeInTheDocument()
    expect(requests.some((r) => r.path === '/rules' && r.method === 'POST')).toBe(false)
  })

  test('ルールの削除は生成済みタスクが残ることを伝えて確認する', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /rules': () => ({ status: 200, body: { items: [makeRule()] } }),
      'GET /rules/1': () => ({ status: 200, body: makeRule() }),
      'POST /rules/preview': () => PREVIEW,
    })
    renderApp('/rules?rule=1')
    const user = userEvent.setup()

    const panel = await screen.findByRole('complementary', { name: '繰り返しルールの編集' })
    await user.click(await within(panel).findByRole('button', { name: 'ルールを削除' }))

    expect(
      await screen.findByRole('alertdialog', {
        name: 'ルール「週次の振り返り」を削除しますか？生成済みのタスクは残ります。',
      }),
    ).toBeInTheDocument()
  })
})

test('繰り返しから生成されたタスクの詳細から、ルールを開ける', async () => {
  const task = makeTask({
    id: 3,
    title: '週次の振り返り',
    dueDate: todayKey(),
    recurrence: { ruleId: 1, ruleTitle: '週次の振り返り', occurrenceDate: '2026-10-15' },
  })
  installFakeApi({
    'GET /tasks/counts': () => EMPTY_COUNTS,
    'GET /tasks?view=today': () => ({ status: 200, body: { items: [listItem(task)], hasMore: false } }),
    'GET /tasks/3': () => ({ status: 200, body: { ...task, subtasks: [] } }),
    'GET /rules': () => ({ status: 200, body: { items: [makeRule()] } }),
    'GET /rules/1': () => ({ status: 200, body: makeRule() }),
    'POST /rules/preview': () => PREVIEW,
  })
  const { router } = renderApp('/today?task=3')
  const user = userEvent.setup()

  const panel = await screen.findByRole('complementary', { name: 'タスク詳細' })
  expect(await within(panel).findByText(/週次の振り返り（10\/15\(木\)分）/)).toBeInTheDocument()
  await user.click(within(panel).getByRole('button', { name: '→ ルールを開く' }))

  await waitFor(() => expect(router.state.location.pathname + router.state.location.search).toBe('/rules?rule=1'))
  expect(await screen.findByRole('complementary', { name: '繰り返しルールの編集' })).toBeInTheDocument()
})
