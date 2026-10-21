import { z } from 'zod'

/**
 * 目安時間（分）の入力と表示。保存は分の整数（1〜9999）で、入力は次の書き方を受け付ける。
 * 90 / 90m / 90分 / 2h / 1.5h / 1h30m / 1時間30分（大文字・全角数字・空白も可）
 */
export const MAX_ESTIMATE_MINUTES = 9999

export type EstimateParseResult = { ok: true; minutes: number | null } | { ok: false; message: string }

const ESTIMATE_PATTERN = /^(?:(\d+(?:\.\d+)?)(?:h|時間))?(?:(\d+)(?:m|分)?)?$/

export function parseEstimate(text: string): EstimateParseResult {
  const value = text
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .toLowerCase()
  if (value === '') {
    return { ok: true, minutes: null }
  }
  const match = ESTIMATE_PATTERN.exec(value)
  if (!match || (match[1] === undefined && match[2] === undefined)) {
    return { ok: false, message: '「90」「1h30m」「1.5h」のように入力してください' }
  }
  const minutes = Math.round(Number(match[1] ?? 0) * 60) + Number(match[2] ?? 0)
  if (minutes < 1 || minutes > MAX_ESTIMATE_MINUTES) {
    return { ok: false, message: `目安時間は1分〜${MAX_ESTIMATE_MINUTES}分（約166時間）で入力してください` }
  }
  return { ok: true, minutes }
}

/** フォームの入力欄（文字列）。読めない書き方ならエラーにする */
export const estimateText = z.string().superRefine((value, ctx) => {
  const parsed = parseEstimate(value)
  if (!parsed.ok) {
    ctx.addIssue({ code: 'custom', message: parsed.message })
  }
})

/** 入力欄の文字列を分に直す（estimateText で確かめ済みの値に使う。読めなければ null） */
export function estimateMinutesOf(text: string): number | null {
  const parsed = parseEstimate(text)
  return parsed.ok ? parsed.minutes : null
}

/**
 * 入力欄を離れたときの整形。読める入力なら「1h30m」の形（空なら空文字）にして返す。
 * 読めなければ null（入力はそのまま残して、エラーを見せる）
 */
export function tidyEstimateText(text: string): string | null {
  const parsed = parseEstimate(text)
  return parsed.ok ? formatEstimate(parsed.minutes) : null
}

/** 90 → "1h30m"、120 → "2h"、45 → "45m"。null は空文字 */
export function formatEstimate(minutes: number | null | undefined): string {
  if (minutes == null) {
    return ''
  }
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) {
    return `${m}m`
  }
  return m === 0 ? `${h}h` : `${h}h${m}m`
}

/** サブタスクの目安の合計が親の目安を超えた分（分）。超えていない・どちらかが未設定なら null */
export function estimateOverrun(own: number | null | undefined, subtaskTotal: number | null): number | null {
  if (own == null || subtaskTotal === null || subtaskTotal <= own) {
    return null
  }
  return subtaskTotal - own
}

/** 目安時間のあるものだけを合計する。1件もなければ null */
export function sumEstimates(items: { estimateMinutes: number | null }[]): number | null {
  const values = items.map((i) => i.estimateMinutes).filter((v): v is number => v != null)
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0)
}
