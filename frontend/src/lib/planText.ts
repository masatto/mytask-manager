import { z } from 'zod'
import type { PlanImportRequest } from '../api/planImport.ts'

/**
 * AI が出力した作業分割（プロンプトで指定した JSON）を読む。
 * 形（項目の有無と型）だけをここで確かめ、日付の書式などの中身はサーバーで確かめる（api-design 9章）。
 */
const optionalText = z.string().nullish()

const subtaskSchema = z.object({
  title: z.string({ error: 'title（タイトル）がありません' }),
  memo: optionalText,
  dueDate: optionalText,
  dueTime: optionalText,
  priority: optionalText,
  done: z.boolean().nullish(),
  // 範囲（1〜9999）はサーバーで確かめる
  estimateMinutes: z
    .number({ error: 'estimateMinutes（目安時間）は分の数値にしてください' })
    .int('estimateMinutes（目安時間）は分の整数にしてください')
    .nullish(),
})

const planSchema = z.object({
  area: z.string().nullish(),
  tasks: z
    .array(subtaskSchema.extend({ subtasks: z.array(subtaskSchema).nullish() }), {
      error: 'tasks（タスクの一覧）がありません',
    })
    .min(1, 'tasks にタスクが1件もありません'),
})

export type ParsedPlan = { areaName: string | null; tasks: PlanImportRequest['tasks'] }

export type PlanTextResult = { ok: true; plan: ParsedPlan } | { ok: false; errors: string[] }

/**
 * 貼り付けた文字列から JSON を取り出して読む。AI の回答は ```json のコードブロックや前後の説明文を含むことがあるので、
 * 最初の { から最後の } までを JSON とみなす。
 */
export function readPlanText(text: string): PlanTextResult {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) {
    return { ok: false, errors: ['JSON が見つかりません。AI が出力した JSON をそのまま貼り付けてください'] }
  }
  let data: unknown
  try {
    data = JSON.parse(text.slice(start, end + 1))
  } catch {
    return { ok: false, errors: ['JSON として読めません。途中で切れていないか確かめてください'] }
  }
  const result = planSchema.safeParse(data)
  if (!result.success) {
    return { ok: false, errors: result.error.issues.map((issue) => `${formatPath(issue.path)}${issue.message}`) }
  }
  return { ok: true, plan: { areaName: result.data.area ?? null, tasks: result.data.tasks } }
}

/** ["tasks", 0, "subtasks", 1, "title"] → "tasks[0].subtasks[1].title：" */
export function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) {
    return ''
  }
  const joined = path
    .map((key) => (typeof key === 'number' ? `[${key}]` : `.${String(key)}`))
    .join('')
    .replace(/^\./, '')
  return `${joined}：`
}
