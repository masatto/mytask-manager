import { z } from 'zod'
import { PRIORITIES, STATUSES, type TaskDetail, type TaskUpdateInput } from '../api/types.ts'
import { fromAreaField, toAreaField } from '../areas/areaField.ts'
import { estimateMinutesOf, estimateText, formatEstimate } from '../lib/estimate.ts'

/**
 * タスク詳細パネル（S2）のフォームの値。入力欄は文字列で持ち、保存のときに API の形（TaskUpdateInput）に直す。
 * フォームの項目名はおおむね API と同じだが、目安時間だけは入力欄の文字列 estimate と API の estimateMinutes で分けている。
 */
export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, 'タイトルは必須です').max(200, 'タイトルは200文字以内で入力してください'),
    memo: z.string().max(10000, 'メモは10000文字以内で入力してください'),
    dueDate: z.string(),
    // 日付が空のときは入力欄を無効にするので、値が来ないことがある
    dueTime: z.string().optional(),
    priority: z.enum(PRIORITIES),
    status: z.enum(STATUSES),
    /** '' は未分類 */
    areaId: z.string(),
    /** 「90」「1h30m」などの入力。保存時に分へ直す（'' は未設定） */
    estimate: estimateText,
  })
  .refine((v) => !v.dueTime || v.dueDate !== '', {
    path: ['dueTime'],
    message: '時刻だけの期限は設定できません。日付も入力してください',
  })

export type TaskFormValues = z.input<typeof taskFormSchema>
export type TaskFormOutput = z.output<typeof taskFormSchema>

export function toFormValues(task: TaskDetail): TaskFormValues {
  return {
    title: task.title,
    memo: task.memo ?? '',
    dueDate: task.dueDate ?? '',
    dueTime: task.dueTime ?? '',
    priority: task.priority,
    status: task.status,
    areaId: toAreaField(task.areaId),
    estimate: formatEstimate(task.estimateMinutes),
  }
}

export function toUpdateInput(values: TaskFormOutput): TaskUpdateInput {
  return {
    title: values.title,
    memo: values.memo === '' ? null : values.memo,
    dueDate: values.dueDate || null,
    dueTime: values.dueDate && values.dueTime ? values.dueTime : null,
    priority: values.priority,
    status: values.status,
    areaId: fromAreaField(values.areaId),
    estimateMinutes: estimateMinutesOf(values.estimate),
  }
}

/** サーバーが返した項目名（fieldErrors[].field）を、フォームの項目名にする */
export function toFormField(serverField: string): keyof TaskFormValues {
  return (serverField === 'estimateMinutes' ? 'estimate' : serverField) as keyof TaskFormValues
}
