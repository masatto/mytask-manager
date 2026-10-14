import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '../routes.tsx'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

describe('Layout', () => {
  test('ルートにアクセスすると今日ビューにリダイレクトされる', async () => {
    renderAt('/')

    expect(await screen.findByRole('heading', { name: '今日' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '今日' })).toHaveAttribute('aria-current', 'page')
  })

  test('サイドバーに全ビューと設定へのリンクがある', async () => {
    renderAt('/today')

    for (const name of ['今日', '今後', '期限なし', '完了済み', '繰り返しルール', '設定']) {
      expect(await screen.findByRole('link', { name })).toBeInTheDocument()
    }
  })
})
