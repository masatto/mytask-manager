import type { Priority } from '../api/types.ts'
import { addDays, nextMonday, parseDateKey, toDateKey } from './date.ts'

/**
 * クイック追加の入力から、期限日・時刻・優先度を読み取る（requirements F10）。
 *
 * 入力をスペース（半角・全角）で区切り、語の全体が次の書き方に一致したものだけを読み取る。残りの語がタイトルになる。
 * 種類ごとに最初の1語だけを使い、2語目以降はタイトルの一部として残す。
 *
 * - 日付：今日 / 明日 / 明後日 / N日後 / 金曜（今日以降で最も近い）/ 来週金曜 / 来週（来週の月曜）/
 *   10/20・10月20日（過ぎていれば翌年）/ 2026-12-01・2026/12/1
 * - 時刻：15:00 / 9時 / 9時半 / 9時15分
 * - 優先度：!高 / !中 / !低（!h !m !l も可）
 * - エリア：@Internal（エリア名。大文字小文字は区別せず、名前の先頭だけでも1つに決まれば可）
 *
 * 全角の数字・記号（１５：００、！高）も、一致の判定では半角として扱う。
 */
export type ParsedQuickAdd = {
  title: string
  /** 書かれていなければ undefined（呼び出し側の既定値を使う） */
  dueDate: string | undefined
  dueTime: string | undefined
  priority: Priority | undefined
  /** @ で指定したエリア */
  areaId: number | undefined
}

type AreaName = { id: number; name: string }

const WEEKDAY_INDEX: Record<string, number> = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 }

const PRIORITY_WORDS: Record<string, Priority> = {
  高: 'HIGH',
  h: 'HIGH',
  high: 'HIGH',
  中: 'MEDIUM',
  m: 'MEDIUM',
  medium: 'MEDIUM',
  低: 'LOW',
  l: 'LOW',
  low: 'LOW',
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** 存在する日付なら YYYY-MM-DD、そうでなければ null（2/30 など） */
function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return toDateKey(date)
}

function parseDate(word: string, today: string): string | null {
  switch (word) {
    case '今日':
    case 'きょう':
      return today
    case '明日':
    case 'あした':
      return addDays(today, 1)
    case '明後日':
    case 'あさって':
      return addDays(today, 2)
    case '来週':
      return nextMonday(today)
  }
  let m = /^(\d{1,3})日後$/.exec(word)
  if (m) {
    return addDays(today, Number(m[1]))
  }
  m = /^(来週)?([日月火水木金土])曜日?$/.exec(word)
  if (m) {
    const target = WEEKDAY_INDEX[m[2]]
    if (m[1]) {
      // 来週の月曜から数える（来週の日曜はその週の最後）
      return addDays(nextMonday(today), (target + 6) % 7)
    }
    const diff = (target - parseDateKey(today).getDay() + 7) % 7
    return addDays(today, diff)
  }
  m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(word)
  if (m) {
    return validDate(Number(m[1]), Number(m[2]), Number(m[3]))
  }
  m = /^(\d{1,2})\/(\d{1,2})$/.exec(word) ?? /^(\d{1,2})月(\d{1,2})日$/.exec(word)
  if (m) {
    const year = parseDateKey(today).getFullYear()
    const thisYear = validDate(year, Number(m[1]), Number(m[2]))
    if (thisYear === null) {
      return null
    }
    // 過ぎた日付は来年のこととみなす
    return thisYear < today ? validDate(year + 1, Number(m[1]), Number(m[2])) : thisYear
  }
  return null
}

function parseTime(word: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(word) ?? /^(\d{1,2})時(?:(半)|(\d{1,2})分)?$/.exec(word)
  if (!m) {
    return null
  }
  const hour = Number(m[1])
  const minute = m[2] === '半' ? 30 : Number(m[2] ?? m[3] ?? 0)
  if (hour > 23 || minute > 59) {
    return null
  }
  return `${pad(hour)}:${pad(minute)}`
}

function parsePriority(word: string): Priority | null {
  const m = /^!(.+)$/.exec(word)
  return m ? (PRIORITY_WORDS[m[1].toLowerCase()] ?? null) : null
}

/** @名前 のエリア。完全に一致するもの、なければ先頭が一致して1つに決まるもの */
function parseArea(word: string, areas: AreaName[]): number | null {
  const m = /^@(.+)$/.exec(word)
  if (!m) {
    return null
  }
  const query = m[1].toLowerCase()
  const exact = areas.find((a) => a.name.normalize('NFKC').toLowerCase() === query)
  if (exact) {
    return exact.id
  }
  const prefixed = areas.filter((a) => a.name.normalize('NFKC').toLowerCase().startsWith(query))
  return prefixed.length === 1 ? prefixed[0].id : null
}

export function parseQuickAdd(input: string, today: string, areas: AreaName[] = []): ParsedQuickAdd {
  const result: ParsedQuickAdd = {
    title: '',
    dueDate: undefined,
    dueTime: undefined,
    priority: undefined,
    areaId: undefined,
  }
  const titleWords: string[] = []

  for (const word of input.split(/[\s　]+/).filter(Boolean)) {
    const normalized = word.normalize('NFKC')
    if (result.dueDate === undefined) {
      const date = parseDate(normalized, today)
      if (date) {
        result.dueDate = date
        continue
      }
    }
    if (result.dueTime === undefined) {
      const time = parseTime(normalized)
      if (time) {
        result.dueTime = time
        continue
      }
    }
    if (result.priority === undefined) {
      const priority = parsePriority(normalized)
      if (priority) {
        result.priority = priority
        continue
      }
    }
    if (result.areaId === undefined) {
      const areaId = parseArea(normalized, areas)
      if (areaId !== null) {
        result.areaId = areaId
        continue
      }
    }
    titleWords.push(word)
  }

  result.title = titleWords.join(' ')
  return result
}
