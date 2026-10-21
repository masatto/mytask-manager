import { z } from 'zod'
import type { RulePreviewInput } from '../api/rules.ts'
import { PRIORITIES, type Rule, type RuleInput } from '../api/types.ts'
import { fromAreaField, toAreaField } from '../areas/areaField.ts'
import { todayKey } from '../lib/date.ts'
import { estimateMinutesOf, estimateText, formatEstimate } from '../lib/estimate.ts'
import { WEEKDAYS, weekdayOf } from '../lib/recurrence.ts'

/**
 * 繰り返しルール編集パネル（S4）のフォームの値。入力欄は文字列で持ち、保存のときに API の形（RuleInput）に直す。
 * パターンは API では pattern: { type, daysOfWeek, dayOfMonth } だが、フォームでは patternType などに平らにしている。
 */
export const MAX_TEMPLATES = 20

export const ruleFormSchema = z
  .object({
    title: z.string().trim().min(1, 'タイトルは必須です').max(200, 'タイトルは200文字以内で入力してください'),
    memo: z.string().max(10000, 'メモは10000文字以内で入力してください'),
    priority: z.enum(PRIORITIES),
    dueTime: z.string(),
    patternType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    daysOfWeek: z.array(z.enum(WEEKDAYS)),
    /** select の値なので文字列。'-1' は末日 */
    dayOfMonth: z.string(),
    startDate: z.string().min(1, '開始日は必須です'),
    endDate: z.string(),
    /** '' は未分類 */
    areaId: z.string(),
    /** 「90」「1h30m」などの入力（'' は未設定） */
    estimate: estimateText,
    subtaskTemplates: z
      .array(
        z.object({
          title: z.string().trim().min(1, 'タイトルを入力してください').max(200, '200文字以内で入力してください'),
          priority: z.enum(PRIORITIES),
          estimate: estimateText,
        }),
      )
      .max(MAX_TEMPLATES, `サブタスクのひな形は${MAX_TEMPLATES}件までです`),
  })
  .superRefine((v, ctx) => {
    if (v.patternType === 'WEEKLY' && v.daysOfWeek.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['daysOfWeek'], message: '曜日を1つ以上選んでください' })
    }
    if (v.endDate !== '' && v.startDate !== '' && v.endDate < v.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: '終了日は開始日以降にしてください' })
    }
  })

export type RuleFormValues = z.input<typeof ruleFormSchema>
export type RuleFormOutput = z.output<typeof ruleFormSchema>

/**
 * @param rule null なら新規作成（今日を起点に、毎週・今日の曜日）
 * @param defaultAreaId 新規作成のときのエリア（選んでいるエリア）
 */
export function toFormValues(rule: Rule | null, defaultAreaId: number | null = null): RuleFormValues {
  const now = new Date()
  if (!rule) {
    return {
      title: '',
      memo: '',
      priority: 'MEDIUM',
      dueTime: '',
      patternType: 'WEEKLY',
      daysOfWeek: [weekdayOf(now)],
      dayOfMonth: String(now.getDate()),
      startDate: todayKey(),
      endDate: '',
      areaId: toAreaField(defaultAreaId),
      estimate: '',
      subtaskTemplates: [],
    }
  }
  return {
    title: rule.title,
    memo: rule.memo ?? '',
    priority: rule.priority,
    dueTime: rule.dueTime ?? '',
    patternType: rule.pattern.type,
    // パターンを切り替えたときの初期値として、使っていない項目にも今日の値を入れておく
    daysOfWeek: rule.pattern.daysOfWeek ?? [weekdayOf(now)],
    dayOfMonth: String(rule.pattern.dayOfMonth ?? now.getDate()),
    startDate: rule.startDate,
    endDate: rule.endDate ?? '',
    areaId: toAreaField(rule.areaId),
    estimate: formatEstimate(rule.estimateMinutes),
    subtaskTemplates: rule.subtaskTemplates.map((t) => ({
      title: t.title,
      priority: t.priority,
      estimate: formatEstimate(t.estimateMinutes),
    })),
  }
}

type PatternFields = Pick<RuleFormValues, 'patternType' | 'daysOfWeek' | 'dayOfMonth'>

/** 選んでいるパターンで使う項目だけを入れる（ほかは null） */
export function toPattern(v: PatternFields): RuleInput['pattern'] {
  return {
    type: v.patternType,
    daysOfWeek: v.patternType === 'WEEKLY' ? WEEKDAYS.filter((d) => v.daysOfWeek.includes(d)) : null,
    dayOfMonth: v.patternType === 'MONTHLY' ? Number(v.dayOfMonth) : null,
  }
}

export function toInput(v: RuleFormOutput, active: boolean): RuleInput {
  return {
    title: v.title,
    memo: v.memo === '' ? null : v.memo,
    priority: v.priority,
    dueTime: v.dueTime === '' ? null : v.dueTime,
    pattern: toPattern(v),
    startDate: v.startDate,
    endDate: v.endDate === '' ? null : v.endDate,
    active,
    subtaskTemplates: v.subtaskTemplates.map((t) => ({
      title: t.title,
      priority: t.priority,
      estimateMinutes: estimateMinutesOf(t.estimate),
    })),
    areaId: fromAreaField(v.areaId),
    estimateMinutes: estimateMinutesOf(v.estimate),
  }
}

/** 次回の生成予定を計算するための入力。入力が途中（開始日なし・曜日なし・終了日が前）なら null */
export function toPreviewInput(
  v: PatternFields & Pick<RuleFormValues, 'startDate' | 'endDate'>,
): RulePreviewInput | null {
  const incomplete =
    v.startDate === '' ||
    (v.patternType === 'WEEKLY' && v.daysOfWeek.length === 0) ||
    (v.endDate !== '' && v.endDate < v.startDate)
  if (incomplete) {
    return null
  }
  return { pattern: toPattern(v), startDate: v.startDate, endDate: v.endDate === '' ? null : v.endDate }
}

/**
 * サーバーが返した項目名（fieldErrors[].field）を、フォームの項目名にする。
 * pattern.daysOfWeek → daysOfWeek、estimateMinutes（ひな形のものも）→ estimate
 */
export function toFormField(serverField: string): keyof RuleFormValues {
  return serverField.replace(/^pattern\./, '').replace(/estimateMinutes$/, 'estimate') as keyof RuleFormValues
}
