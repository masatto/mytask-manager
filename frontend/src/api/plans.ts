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
  steps: PlanStep[]
}

/** タスクを変えると進み具合も変わるので、タスクと同じ ['tasks'] の下に置き、タスクの更新でまとめて取り直す */
export const planKeys = {
  list: (areaId: number | null) => ['tasks', 'plans', areaId] as const,
}

export function fetchPlans(areaId: number | null): Promise<{ items: Plan[] }> {
  const params = new URLSearchParams(areaParam(areaId))
  return apiFetch(params.size > 0 ? `/plans?${params}` : '/plans')
}
