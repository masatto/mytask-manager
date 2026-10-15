import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, formatDate, todayKey } from '../lib/date.ts'
import { EMPTY_COUNTS, installFakeApi, makeTask } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

const today = todayKey()
const EMPTY_LIST = { status: 200, body: { items: [], hasMore: false } }

function setup(view: 'today' | 'no-due') {
  const api = installFakeApi({
    'GET /tasks/counts': () => EMPTY_COUNTS,
    [`GET /tasks?view=${view}`]: () => EMPTY_LIST,
    'POST /tasks': (req) => ({ status: 201, body: makeTask({ id: 9, ...(req.body as object) }) }),
  })
  renderApp(`/${view}`)
  return api
}

describe('クイック追加の自然な書き方', () => {
  test('期限・時刻・優先度を読み取ってプレビューし、そのとおりに登録する', async () => {
    const { requests } = setup('today')
    const user = userEvent.setup()
    const input = await screen.findByRole('textbox', { name: 'タスクを追加' })

    await user.type(input, '明日 15:00 歯医者 !高')
    expect(screen.getByRole('status', { name: '読み取った内容' })).toHaveTextContent(`期限 ${formatDate(addDays(today, 1))} 15:00 ・ 優先度 高「歯医者」`)

    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(requests.find((r) => r.method === 'POST')?.body).toEqual({
        title: '歯医者',
        dueDate: addDays(today, 1),
        dueTime: '15:00',
        priority: 'HIGH',
      }),
    )
    expect(input).toHaveValue('')
  })

  test('期限を書かなければビューの既定の期限で登録し、プレビューは出さない', async () => {
    const { requests } = setup('today')
    const user = userEvent.setup()
    const input = await screen.findByRole('textbox', { name: 'タスクを追加' })

    await user.type(input, '請求書を送る')
    expect(screen.queryByRole('status', { name: '読み取った内容' })).not.toBeInTheDocument()

    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ title: '請求書を送る', dueDate: today }),
    )
  })

  test('期限なしビューで時刻だけを書いたら今日のその時刻にする', async () => {
    const { requests } = setup('no-due')
    const user = userEvent.setup()

    await user.type(await screen.findByRole('textbox', { name: 'タスクを追加' }), '9時半 電話{Enter}')

    await waitFor(() =>
      expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ title: '電話', dueDate: today, dueTime: '09:30' }),
    )
  })

  test('タイトルがなければ登録せず、入力を促す', async () => {
    const { requests } = setup('today')
    const user = userEvent.setup()

    await user.type(await screen.findByRole('textbox', { name: 'タスクを追加' }), '明日 !高{Enter}')

    expect(screen.getByText('タイトルを入力してください')).toBeInTheDocument()
    expect(requests.some((r) => r.method === 'POST')).toBe(false)
  })
})
