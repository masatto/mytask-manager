import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EMPTY_COUNTS, installFakeApi } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

const BACKUP = {
  format: 'mytask-manager-backup',
  version: 1,
  exportedAt: '2026-10-15T21:00:00+09:00',
  tasks: [],
  rules: [],
}

function backupFile(content: string, name = 'mytask-manager-20261015-2100.json') {
  return new File([content], name, { type: 'application/json' })
}

beforeEach(() => {
  localStorage.clear()
  // jsdom には URL.createObjectURL がないので差し替える
  URL.createObjectURL = vi.fn(() => 'blob:backup')
  URL.revokeObjectURL = vi.fn()
})

describe('S5 設定（バックアップ）', () => {
  test('エクスポートするとサーバーが指定したファイル名でダウンロードし、最終エクスポート日時を残す', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /backup': () => ({
        status: 200,
        body: BACKUP,
        headers: { 'Content-Disposition': 'attachment; filename="mytask-manager-20261015-2100.json"' },
      }),
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderApp('/settings')
    const user = userEvent.setup()

    expect(await screen.findByText('最終エクスポート：まだエクスポートしていません')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'JSONをエクスポート' }))

    expect(await screen.findByText('mytask-manager-20261015-2100.json をダウンロードしました')).toBeInTheDocument()
    expect(click).toHaveBeenCalledTimes(1)
    expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe('mytask-manager-20261015-2100.json')
    expect(screen.queryByText('最終エクスポート：まだエクスポートしていません')).not.toBeInTheDocument()
    expect(localStorage.getItem('mytask-manager.lastExportAt')).not.toBeNull()
    click.mockRestore()
  })

  test('インポートはまず検証して件数を出し、確認してから置き換える', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'POST /backup/import?dryRun=true': () => ({
        status: 200,
        body: { current: { tasks: 120, rules: 4 }, incoming: { tasks: 85, rules: 3 } },
      }),
      'POST /backup/import?dryRun=false': () => ({ status: 204 }),
    })
    renderApp('/settings')
    const user = userEvent.setup()

    await user.upload(await screen.findByLabelText('インポートするファイル'), backupFile(JSON.stringify(BACKUP)))

    const dialog = await screen.findByRole('alertdialog', {
      name: '現在のデータはすべて置き換えられます。',
      description: 'タスク 120件 → 85件 ／ ルール 4件 → 3件',
    })
    expect(requests.some((r) => r.path === '/backup/import?dryRun=false')).toBe(false)

    await user.click(within(dialog).getByRole('button', { name: '置き換える' }))

    expect(await screen.findByText('mytask-manager-20261015-2100.json からインポートしました')).toBeInTheDocument()
    expect(requests.find((r) => r.path === '/backup/import?dryRun=false')?.body).toEqual(BACKUP)
  })

  test('確認でキャンセルすると置き換えない', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'POST /backup/import?dryRun=true': () => ({
        status: 200,
        body: { current: { tasks: 1, rules: 0 }, incoming: { tasks: 0, rules: 0 } },
      }),
    })
    renderApp('/settings')
    const user = userEvent.setup()

    await user.upload(await screen.findByLabelText('インポートするファイル'), backupFile(JSON.stringify(BACKUP)))
    await user.click(await screen.findByRole('button', { name: 'キャンセル' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(requests.some((r) => r.path === '/backup/import?dryRun=false')).toBe(false)
  })

  test('不正なファイルはサーバーの理由を表示して中止する', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'POST /backup/import?dryRun=true': () => ({
        status: 400,
        body: { code: 'INVALID_BACKUP', message: 'バックアップファイルが不正です：JSON として読み込めません' },
      }),
    })
    renderApp('/settings')
    const user = userEvent.setup()

    await user.upload(await screen.findByLabelText('インポートするファイル'), backupFile('{not json', 'broken.json'))

    expect(await screen.findByRole('alert')).toHaveTextContent('バックアップファイルが不正です：JSON として読み込めません')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
