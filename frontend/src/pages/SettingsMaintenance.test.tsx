import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EMPTY_COUNTS, installFakeApi } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

const STATUS = {
  directory: 'C:\\Users\\me\\.mytask-manager\\backups',
  keep: 14,
  files: [{ name: 'orbit-auto-20261015.json', size: 2048, createdAt: '2026-10-15T09:00:00+09:00' }],
  mirrorDirectory: null,
  mirrorError: null,
  mirrorFiles: [] as { name: string; size: number; createdAt: string | null }[],
}
const SYSTEM = {
  version: '1.0.0',
  buildTime: '2026-10-15T16:53:16+09:00',
  dataDirectory: 'C:\\Users\\me\\.mytask-manager\\data',
  backupDirectory: 'C:\\Users\\me\\.mytask-manager\\backups',
  logFile: 'C:\\Users\\me\\.mytask-manager\\logs\\orbit.log',
}

describe('設定画面（運用まわり）', () => {
  test('このアプリについて：バージョンとビルド日時を出す', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /backup/auto': () => ({ status: 200, body: STATUS }),
      'GET /system': () => ({ status: 200, body: SYSTEM }),
    })
    renderApp('/settings')

    const about = await screen.findByRole('region', { name: 'このアプリについて' })
    expect(await within(about).findByText('Orbit 1.0.0')).toBeInTheDocument()
    expect(within(about).getByText('10/15 16:53')).toBeInTheDocument()
    expect(within(about).queryByText('C:\\Users\\me\\.mytask-manager\\data')).not.toBeInTheDocument()
  })

  test('保存場所：場所ごとの役割をまとめて出し、未設定のものはそう示す', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /backup/auto': () => ({ status: 200, body: STATUS }),
      'GET /system': () => ({ status: 200, body: { ...SYSTEM, logFile: null } }),
    })
    renderApp('/settings')

    const storage = await screen.findByRole('region', { name: '保存場所' })
    expect(await within(storage).findByText('C:\\Users\\me\\.mytask-manager\\data')).toBeInTheDocument()
    expect(within(storage).getByText(/触らないでください/)).toBeInTheDocument()
    expect(within(storage).getByText('C:\\Users\\me\\.mytask-manager\\backups')).toBeInTheDocument()
    expect(within(storage).getByText(/未設定/)).toBeInTheDocument()
    expect(within(storage).getByText(/開発用の起動/)).toBeInTheDocument()
    expect(within(storage).getByText(/ダウンロード」フォルダー/)).toBeInTheDocument()
    expect(within(storage).getAllByRole('button', { name: /パスをコピー/ })).toHaveLength(2)
  })

  test('コピー先の状況と、名前変更前のファイルの注記を出す', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /backup/auto': () => ({
        status: 200,
        body: {
          ...STATUS,
          files: [...STATUS.files, { name: 'mytask-manager-auto-20261014.json', size: 1024, createdAt: '2026-10-14T09:00:00+09:00' }],
          mirrorDirectory: 'C:\\Users\\me\\OneDrive\\Orbit',
          mirrorFiles: [
            { name: 'orbit-auto-20261015.json', size: 2048, createdAt: '2026-10-15T17:09:00+09:00' },
            { name: 'mytask-manager-auto-20261014.json', size: 1024, createdAt: '2026-10-14T09:00:00+09:00' },
          ],
        },
      }),
      'GET /system': () => ({ status: 200, body: SYSTEM }),
    })
    renderApp('/settings')

    expect(await screen.findByText(/コピー済み 2件/)).toHaveTextContent('10/15 17:09')
    expect(screen.getAllByText('名前変更前')).toHaveLength(1)
    const storage = screen.getByRole('region', { name: '保存場所' })
    expect(within(storage).getByText('C:\\Users\\me\\OneDrive\\Orbit')).toBeInTheDocument()
  })

  test('コピー先を設定でき、使えないフォルダーなら理由を出す', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /backup/auto': () => ({ status: 200, body: STATUS }),
      'GET /system': () => ({ status: 200, body: SYSTEM }),
      'PUT /backup/auto/mirror': (req) => {
        const dir = (req.body as { mirrorDirectory: string }).mirrorDirectory
        return dir === 'D:\\nowhere'
          ? {
              status: 400,
              body: {
                code: 'VALIDATION_ERROR',
                message: 'x',
                fieldErrors: [{ field: 'mirrorDirectory', message: 'フォルダーが見つかりません（先に作成してください）' }],
              },
            }
          : { status: 200, body: { ...STATUS, mirrorDirectory: dir } }
      },
    })
    renderApp('/settings')
    const user = userEvent.setup()
    const input = await screen.findByLabelText(/コピー先（任意）/)

    await user.type(input, 'D:\\nowhere')
    await user.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByText('フォルダーが見つかりません（先に作成してください）')).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, 'C:\\Users\\me\\OneDrive\\Orbit')
    await user.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByText('コピー先を設定しました')).toBeInTheDocument()
    expect(requests.filter((r) => r.method === 'PUT').at(-1)?.body).toEqual({ mirrorDirectory: 'C:\\Users\\me\\OneDrive\\Orbit' })
    expect(screen.getByRole('button', { name: '解除' })).toBeInTheDocument()
  })

  test('コピーに失敗していれば理由を出し、今すぐバックアップできる', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /backup/auto': () => ({
        status: 200,
        body: { ...STATUS, mirrorDirectory: 'E:\\USB', mirrorError: 'コピー先のフォルダーが見つかりません: E:\\USB' },
      }),
      'GET /system': () => ({ status: 200, body: SYSTEM }),
      'POST /backup/auto/run': () => ({ status: 200, body: { ...STATUS, mirrorDirectory: 'E:\\USB', mirrorError: null } }),
    })
    renderApp('/settings')
    const user = userEvent.setup()

    expect(await screen.findByRole('alert')).toHaveTextContent('コピー先に写せませんでした：コピー先のフォルダーが見つかりません')
    await user.click(screen.getByRole('button', { name: '今すぐバックアップ' }))

    expect(await screen.findByText('バックアップしました')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(requests.some((r) => r.method === 'POST' && r.path === '/backup/auto/run')).toBe(true)
  })
})
