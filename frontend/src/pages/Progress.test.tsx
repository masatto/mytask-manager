import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Plan } from '../api/plans.ts'
import { EMPTY_COUNTS, installFakeApi, makeTask } from '../test/fakeApi.ts'
import { renderApp } from '../test/renderApp.tsx'

test('Today の進み具合に、残りの作業の目安の合計を添える', async () => {
  installFakeApi({
    'GET /tasks/counts': () => ({
      status: 200,
      body: { today: 2, overdue: 0, upcoming: 0, noDue: 0, doneToday: 1, todayEstimateMinutes: 210 },
    }),
    'GET /tasks?view=today': () => ({ status: 200, body: { items: [], hasMore: false } }),
  })
  renderApp('/today')

  expect(await screen.findByRole('img', { name: '今日の進み具合：1件完了、残り2件、残りの目安3h30m' })).toHaveTextContent(
    '1件完了・残り2件・目安 3h30m',
  )
})

const PLAN: Plan = {
  name: '韓国語学習',
  areaId: 4,
  state: 'BEHIND',
  totalSteps: 3,
  doneSteps: 1,
  overdueSteps: 1,
  totalMinutes: 930,
  remainingMinutes: 690,
  finalDueDate: '2026-10-27',
  daysLeft: 14,
  weeklyMinutesNeeded: 345,
  nextStepId: 12,
  unscheduledSubtasks: 0,
  steps: [
    { id: 11, title: '韓国語学習 Step1: 教材', number: 1, status: 'DONE', dueDate: '2026-10-10', overdue: false,
      estimateMinutes: 180, remainingMinutes: 0, subtasksDone: 0, subtasksTotal: 0, overdueSubtasks: 0 },
    { id: 12, title: '韓国語学習 Step2: ハングル', number: 2, status: 'IN_PROGRESS', dueDate: '2026-10-13', overdue: true,
      estimateMinutes: 150, remainingMinutes: 90, subtasksDone: 1, subtasksTotal: 2, overdueSubtasks: 1 },
    { id: 13, title: '韓国語学習 Step10: 仕上げ', number: 10, status: 'TODO', dueDate: '2026-10-27', overdue: false,
      estimateMinutes: 600, remainingMinutes: 600, subtasksDone: 0, subtasksTotal: 0, overdueSubtasks: 0 },
  ],
}

describe('Progress 計画の進み具合', () => {
  test('計画ごとに状態・ステップ数・残りの目安・最終期限・必要なペース・次のステップを出す', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /areas': () => ({
        status: 200,
        body: { items: [{ id: 4, name: 'Learning', color: 'pink', taskCount: 3, ruleCount: 0 }] },
      }),
      'GET /plans': () => ({ status: 200, body: { items: [PLAN] } }),
    })
    renderApp('/progress')

    const card = await screen.findByRole('listitem', { name: '計画「韓国語学習」' })
    expect(within(card).getByRole('heading', { name: '韓国語学習' })).toBeInTheDocument()
    expect(card).toHaveTextContent('遅れ（期限切れ 1）')
    expect(within(card).getByRole('img', { name: '3ステップ中1ステップ完了' })).toHaveTextContent('1/3 ステップ')
    expect(card).toHaveTextContent('残りの目安11h30m / 15h30m')
    expect(card).toHaveTextContent('最終期限10/27(火)（あと14日）')
    expect(card).toHaveTextContent('必要なペース週 5h45m')
    expect(card).toHaveTextContent('次：韓国語学習 Step2: ハングル（期限 10/13(火)）')
    // 期限のないサブタスクがなければ、割り振りの案内は出さない
    expect(within(card).queryByRole('button', { name: '期限を割り振る' })).not.toBeInTheDocument()
    // 「すべて」を選んでいるので、エリアのバッジを出す
    expect(within(card).getByText('Learning')).toBeInTheDocument()

    const steps = within(card).getAllByRole('listitem')
    expect(steps.map((s) => s.textContent)).toEqual([
      '✓韓国語学習 Step1: 教材3h10/10(土)',
      '◐韓国語学習 Step2: ハングル✓ 1/2（遅れ 1）残り 1h30m / 2h30m10/13(火)',
      '○韓国語学習 Step10: 仕上げ10h10/27(火)',
    ])
  })

  test('ステップを押すと詳細パネルで開く', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /plans': () => ({ status: 200, body: { items: [PLAN] } }),
      'GET /tasks/12': () => ({ status: 200, body: { ...makeTask({ id: 12, title: '韓国語学習 Step2: ハングル' }), subtasks: [] } }),
    })
    const { router } = renderApp('/progress')
    const user = userEvent.setup()

    // 「次：」のリンクとステップの一覧の両方にあるので、「次：」の方を押す
    await user.click((await screen.findAllByRole('button', { name: '韓国語学習 Step2: ハングル' }))[0])
    await waitFor(() => expect(router.state.location.search).toBe('?task=12'))
    expect(await screen.findByRole('complementary', { name: 'タスク詳細' })).toBeInTheDocument()
  })

  test('期限のないサブタスクがあれば案内し、確認してから期限を割り振る', async () => {
    const { requests } = installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /plans': () => ({ status: 200, body: { items: [{ ...PLAN, unscheduledSubtasks: 3 }] } }),
      'POST /plans/schedule-subtasks?dryRun=true': () => ({
        status: 200,
        body: {
          count: 3,
          subtasks: [
            { id: 21, title: '母音', stepId: 12, dueDate: '2026-10-22' },
            { id: 22, title: '子音', stepId: 12, dueDate: '2026-10-25' },
            { id: 23, title: '仕上げ', stepId: 13, dueDate: '2026-10-27' },
          ],
        },
      }),
      'POST /plans/schedule-subtasks?dryRun=false': () => ({ status: 200, body: { count: 3, subtasks: [] } }),
    })
    renderApp('/progress')
    const user = userEvent.setup()

    const card = await screen.findByRole('listitem', { name: '計画「韓国語学習」' })
    expect(card).toHaveTextContent('期限のないサブタスクが 3件あります')
    await user.click(within(card).getByRole('button', { name: '期限を割り振る' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('「韓国語学習」のサブタスク 3件に期限を付けます')
    expect(dialog).toHaveTextContent('10/22(木) 〜 10/27(火)')
    expect(requests.filter((r) => r.path.startsWith('/plans/schedule-subtasks'))).toHaveLength(1)

    await user.click(within(dialog).getByRole('button', { name: '割り振る' }))
    expect(await screen.findByText('サブタスク 3件に期限を割り振りました')).toBeInTheDocument()
    expect(requests.find((r) => r.path === '/plans/schedule-subtasks?dryRun=false')?.body).toEqual({ name: '韓国語学習' })
  })

  test('計画がなければ、どういうタスクがまとまるのかを案内する', async () => {
    installFakeApi({
      'GET /tasks/counts': () => EMPTY_COUNTS,
      'GET /plans': () => ({ status: 200, body: { items: [] } }),
    })
    renderApp('/progress')

    expect(await screen.findByText(/「名前 番号: 内容」の形のタスクが2つ以上あると/)).toBeInTheDocument()
  })
})
