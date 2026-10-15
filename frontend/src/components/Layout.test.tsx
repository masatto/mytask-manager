import { screen, within } from '@testing-library/react'
import { EMPTY_COUNTS, installFakeApi } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

const EMPTY_LIST = { status: 200, body: { items: [], hasMore: false } }

describe('Layout', () => {
  test('ルートにアクセスすると今日ビューにリダイレクトされる', async () => {
    installFakeApi({ 'GET /tasks/counts': () => EMPTY_COUNTS, 'GET /tasks?view=today': () => EMPTY_LIST })
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Today 今日' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Today 今日/ })).toHaveAttribute('aria-current', 'page')
  })

  test('サイドバーに全ビューと設定へのリンクがある', async () => {
    installFakeApi({ 'GET /tasks/counts': () => EMPTY_COUNTS, 'GET /tasks?view=today': () => EMPTY_LIST })
    renderApp('/today')

    for (const name of ['Today 今日', 'Upcoming これから', 'Someday いつか', 'Done 完了', 'Routines 繰り返し', 'Settings 設定']) {
      expect(await screen.findByRole('link', { name: new RegExp(`^${name}`) })).toBeInTheDocument()
    }
  })

  test('サイドバーに件数を出し、期限切れがあれば今日の件数を強調する', async () => {
    installFakeApi({
      'GET /tasks/counts': () => ({ status: 200, body: { today: 5, overdue: 2, upcoming: 12, noDue: 0 } }),
      'GET /tasks?view=today': () => EMPTY_LIST,
    })
    renderApp('/today')

    const nav = screen.getByRole('navigation', { name: 'メインメニュー' })
    expect(await within(nav).findByLabelText('5件（期限切れあり）')).toBeInTheDocument()
    expect(within(nav).getByLabelText('12件')).toBeInTheDocument()
    // 0件のときは件数を出さない
    expect(within(nav).getByRole('link', { name: 'Someday いつか' })).toBeInTheDocument()
  })
})
