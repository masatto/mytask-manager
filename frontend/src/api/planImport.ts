import { apiFetch } from './client.ts'
import type { Priority } from './types.ts'

/** POST /api/plan-import の本文（api-design 9章）。日付などは文字列のまま送り、解釈はサーバーで行う */
export type PlanTaskInput = {
  title: string
  memo?: string | null | undefined
  dueDate?: string | null | undefined
  dueTime?: string | null | undefined
  priority?: string | null | undefined
  done?: boolean | null | undefined
}

export type PlanImportRequest = {
  areaId: number | null
  tasks: (PlanTaskInput & { subtasks?: PlanTaskInput[] | null | undefined })[]
}

export type PlanImportRow = {
  action: 'CREATE' | 'SKIP_DUPLICATE'
  /** 登録した親タスクのID（dryRun と飛ばした行では null） */
  id: number | null
  title: string
  dueDate: string | null
  dueTime: string | null
  priority: Priority
  done: boolean
  subtasks: { title: string; done: boolean }[]
}

export type PlanImportResult = { created: number; skipped: number; tasks: PlanImportRow[] }

/** dryRun なら登録せず、登録する内容と飛ばす内容だけを返す */
export function importPlan(request: PlanImportRequest, dryRun: boolean): Promise<PlanImportResult> {
  return apiFetch(`/plan-import?dryRun=${dryRun}`, { method: 'POST', body: JSON.stringify(request) })
}
