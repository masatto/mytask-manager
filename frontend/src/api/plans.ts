import { areaParam } from './areas.ts'
import { apiFetch } from './client.ts'
import type { TaskStatus } from './types.ts'

/** GET /api/plans（api-design 11章）。「<計画名> <番号>: <内容>」の親タスクを計画名でまとめたもの */
export type PlanState = 'DONE' | 'BEHIND' | 'ON_TRACK'

export type PlanStep = {
  id: number
  title: string
  number: number
  status: TaskStatus
  dueDate: string | null
  overdue: boolean
  /** ステップ全体の目安（サブタスクに目安があればその合計） */
  estimateMinutes: number | null
  /** 残りの目安（完了なら 0） */
  remainingMinutes: number | null
  subtasksDone: number
  subtasksTotal: number
  /** 期限を過ぎた未完了のサブタスクの数（1件以上なら overdue も true） */
  overdueSubtasks: number
}

export type Plan = {
  name: string
  areaId: number | null
  state: PlanState
  totalSteps: number
  doneSteps: number
  overdueSteps: number
  totalMinutes: number | null
  remainingMinutes: number | null
  finalDueDate: string | null
  /** 今日から最終期限までの日数（今日を含む） */
  daysLeft: number | null
  /** 最終期限までに終えるのに必要な1週間あたりの時間（分） */
  weeklyMinutesNeeded: number | null
  nextStepId: number | null
  /** 期限を割り振れる（期限のある未完了のステップの下で、期限のない未完了の）サブタスクの数 */
  unscheduledSubtasks: number
  steps: PlanStep[]
}

/** タスクを変えると進み具合も変わるので、タスクと同じ ['tasks'] の下に置き、タスクの更新でまとめて取り直す */
export const planKeys = {
  list: (areaId: number | null) => ['tasks', 'plans', areaId] as const,
}

export type SubtaskSchedule = {
  count: number
  subtasks: { id: number; title: string; stepId: number; dueDate: string }[]
}

/** POST /api/plans/schedule-subtasks（api-design 11.2）。dryRun なら割り振る内容だけを返す */
export function scheduleSubtasks(name: string, dryRun: boolean): Promise<SubtaskSchedule> {
  return apiFetch(`/plans/schedule-subtasks?dryRun=${dryRun}`, { method: 'POST', body: JSON.stringify({ name }) })
}

export function fetchPlans(areaId: number | null): Promise<{ items: Plan[] }> {
  const params = new URLSearchParams(areaParam(areaId))
  return apiFetch(params.size > 0 ? `/plans?${params}` : '/plans')
}
