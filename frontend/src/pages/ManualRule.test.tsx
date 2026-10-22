import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Rule } from '../api/types.ts'
import { todayKey } from '../lib/date.ts'
import { EMPTY_COUNTS, installFakeApi } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

const INTERVIEW: Rule = {
  id: 3,
  title: 'インタビュー準備',
  memo: null,
  priority: 'HIGH',
  dueTime: null,
  pattern: { type: 'MANUAL', daysOfWeek: null, dayOfMonth: null },
  startDate: '2026-10-22',
  endDate: null,
  active: true,
  subtaskTemplates: [
    { title: '会議室準備', priority: 'MEDIUM', estimateMinutes: 15 },
    { title: '質問内容整理', priority: 'MEDIUM', estimateMinutes: 45 },
  ],
  areaId: null,
  estimateMinutes: 60,
  nextOccurrence: null,
  lastGeneratedDate: null,
  createdAt: '2026-10-22T09:00:00+09:00',
  updatedAt: '2026-10-22T09:00:00+09:00',
}

describe('手動のルール（ひな形からタスクを作る）', () => {
  test('一覧では「手動」と「作成」を出し、有効・停止の切り替えは出さない', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /rules': () => ({ status: 200, body: { items: [INTERVIEW] } }),
    })
    renderApp('/rules')

    const row = (await screen.findByRole('button', { name: 'インタビュー準備' })).closest('tr')!
    expect(row).toHaveTextContent('手動')
    expect(within(row).getByRole('button', { name: '「インタビュー準備」からタスクを作成' })).toBeInTheDocument()
    expect(within(row).queryByRole('switch')).not.toBeInTheDocument()
  })

  test('「作成」でタスク名と期限を入れて作り、トーストを出す', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /rules': () => ({ status: 200, body: { items: [INTERVIEW] } }),
      'POST /rules/3/tasks': () => ({
        status: 201,
        body: { id: 50, title: 'インタビュー準備（佐藤さん）', dueDate: todayKey() },
      }),
    })
    renderApp('/rules')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '「インタビュー準備」からタスクを作成' }))
    const dialog = screen.getByRole('dialog', { name: '「インタビュー準備」からタスクを作成' })
    expect(dialog).toHaveTextContent('サブタスク：会議室準備・質問内容整理')

    const title = within(dialog).getByLabelText('タスク名')
    expect(title).toHaveValue('インタビュー準備')
    await user.clear(title)
    await user.type(title, 'インタビュー準備（佐藤さん）')
    await user.type(within(dialog).getByLabelText('期限時刻'), '15:00')
    await user.click(within(dialog).getByRole('button', { name: '作成' }))

    expect(await screen.findByText('「インタビュー準備（佐藤さん）」を作成しました')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(requests.find((r) => r.path === '/rules/3/tasks')?.body).toEqual({
      title: 'インタビュー準備（佐藤さん）',
      dueDate: todayKey(),
      dueTime: '15:00',
    })
  })

  test('新規ルールで「手動」を選ぶと、期間と生成予定を出さずに MANUAL で保存する', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /rules': () => ({ status: 200, body: { items: [] } }),
      'POST /rules/preview': () => ({ status: 200, body: { occurrences: [] } }),
      'POST /rules': () => ({ status: 201, body: { ...INTERVIEW, id: 5 } }),
      'GET /rules/5': () => ({ status: 200, body: { ...INTERVIEW, id: 5 } }),
    })
    renderApp('/rules')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '＋ 新規ルール' }))
    const panel = await screen.findByRole('complementary', { name: '繰り返しルールの編集' })
    await user.type(within(panel).getByLabelText('タイトル'), 'インタビュー準備')
    await user.click(within(panel).getByRole('radio', { name: '手動' }))

    expect(within(panel).queryByLabelText('開始日')).not.toBeInTheDocument()
    expect(within(panel).queryByRole('region', { name: '次回の生成予定' })).not.toBeInTheDocument()
    expect(within(panel).getByText(/自動では作りません/)).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: '作成' }))
    await waitFor(() =>
      expect(requests.find((r) => r.path === '/rules' && r.method === 'POST')?.body).toMatchObject({
        pattern: { type: 'MANUAL', daysOfWeek: null, dayOfMonth: null },
      }),
    )
  })
})
