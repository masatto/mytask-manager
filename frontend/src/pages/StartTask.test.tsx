import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { todayKey } from '../lib/date.ts'
import { EMPTY_COUNTS, installFakeApi, listItem, makeTask } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

const today = todayKey()

describe('一覧の行から進行中にする', () => {
  test('未着手の行の「着手」で進行中にし、「元に戻す」で未着手に戻す', async () => {
    const task = makeTask({ id: 7, title: '一覧APIを作る', dueDate: today })
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({ status: 200, body: { items: [listItem(task)], hasMore: false } }),
      'PATCH /tasks/7/status': () => ({
        status: 200,
        body: { changed: [{ id: 7, previousStatus: 'TODO', status: 'IN_PROGRESS' }] },
      }),
      'PATCH /tasks/statuses': () => ({ status: 204 }),
    })
    renderApp('/today')
    const user = userEvent.setup()

    // 未着手の行には「中断」は出ない
    await user.click(await screen.findByRole('button', { name: '「一覧APIを作る」に着手' }))
    expect(screen.queryByRole('button', { name: /を中断/ })).not.toBeInTheDocument()

    expect(await screen.findByText('着手しました')).toBeInTheDocument()
    expect(requests.find((r) => r.path === '/tasks/7/status')?.body).toEqual({ status: 'IN_PROGRESS' })

    await user.click(screen.getByRole('button', { name: '元に戻す' }))
    await waitFor(() =>
      expect(requests.find((r) => r.path === '/tasks/statuses')?.body).toEqual({ changes: [{ id: 7, status: 'TODO' }] }),
    )
  })

  test('進行中の行には「中断」が出て、未着手に戻す', async () => {
    const task = makeTask({ id: 8, title: '型を書く', dueDate: today, status: 'IN_PROGRESS' })
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=today': () => ({ status: 200, body: { items: [listItem(task)], hasMore: false } }),
      'PATCH /tasks/8/status': () => ({
        status: 200,
        body: { changed: [{ id: 8, previousStatus: 'IN_PROGRESS', status: 'TODO' }] },
      }),
    })
    renderApp('/today')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '「型を書く」を中断して未着手に戻す' }))
    expect(screen.queryByRole('button', { name: /に着手$/ })).not.toBeInTheDocument()

    expect(await screen.findByText('未着手に戻しました')).toBeInTheDocument()
    expect(requests.find((r) => r.path === '/tasks/8/status')?.body).toEqual({ status: 'TODO' })
  })

  test('完了の行には「着手」も「中断」も出さない', async () => {
    const task = makeTask({ id: 9, title: '環境を作る', status: 'DONE', completedAt: `${today}T10:00:00+09:00` })
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /tasks?view=done&offset=0&limit=100': () => ({ status: 200, body: { items: [listItem(task)], hasMore: false } }),
    })
    renderApp('/done')

    expect(await screen.findByRole('button', { name: '環境を作る' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /に着手|を中断/ })).not.toBeInTheDocument()
  })
})
