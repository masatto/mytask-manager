// AI が出力した作業分割の JSON（PROMPT.md の形式）を Orbit に登録する。
// 使い方: node import-plan.mjs plan.json [--dry-run] [--no-schedule] [--base http://127.0.0.1:8080/api]
// 期限のないサブタスクには、ステップの期間の中で期限を割り振る（--no-schedule で割り振らない）
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--base')
const dryRun = args.includes('--dry-run')
const noSchedule = args.includes('--no-schedule')
const baseIndex = args.indexOf('--base')
const BASE = (baseIndex >= 0 ? args[baseIndex + 1] : 'http://127.0.0.1:8080/api').replace(/\/$/, '')

if (!file) {
  console.error('使い方: node import-plan.mjs plan.json [--dry-run] [--no-schedule] [--base <Orbit の API の URL>]')
  process.exit(1)
}

const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW']
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/
/** 目安時間（分）は 1〜9999 の整数 */
const isEstimate = (v) => Number.isInteger(v) && v >= 1 && v <= 9999

function validate(plan) {
  const errors = []
  if (!plan || !Array.isArray(plan.tasks) || plan.tasks.length === 0) {
    return ['tasks に1件以上のタスクが必要です']
  }
  const check = (t, where) => {
    if (typeof t.title !== 'string' || t.title.trim() === '') errors.push(`${where}: title がありません`)
    else if (t.title.trim().length > 200) errors.push(`${where}: title が200文字を超えています`)
    if (t.memo != null && (typeof t.memo !== 'string' || t.memo.length > 10000)) errors.push(`${where}: memo が不正です`)
    if (t.dueDate != null && !DATE.test(t.dueDate)) errors.push(`${where}: dueDate は YYYY-MM-DD で指定します`)
    if (t.dueTime != null && !TIME.test(t.dueTime)) errors.push(`${where}: dueTime は HH:mm で指定します`)
    if (t.dueTime != null && t.dueDate == null) errors.push(`${where}: dueTime だけを指定することはできません`)
    if (t.priority != null && !PRIORITIES.includes(t.priority)) errors.push(`${where}: priority は ${PRIORITIES.join(' / ')} のどれかです`)
    if (t.estimateMinutes != null && !isEstimate(t.estimateMinutes)) errors.push(`${where}: estimateMinutes は 1〜9999 の整数（分）で指定します`)
  }
  plan.tasks.forEach((t, i) => {
    const where = `tasks[${i}]`
    check(t, where)
    if (t.subtasks != null && !Array.isArray(t.subtasks)) errors.push(`${where}: subtasks は配列で指定します`)
    for (const [j, s] of (t.subtasks ?? []).entries()) {
      check(s, `${where}.subtasks[${j}]`)
      if (s.subtasks != null) errors.push(`${where}.subtasks[${j}]: サブタスクの下にはタスクを作れません`)
    }
  })
  return errors
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

const plan = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''))
const errors = validate(plan)
if (errors.length > 0) {
  console.error('JSON に問題があります:')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

let areaId = null
let areaName = '未分類'
try {
  if (plan.area != null) {
    const { items } = await call('GET', '/areas')
    const area = items.find((a) => a.name.toLowerCase() === String(plan.area).toLowerCase())
    if (!area) {
      console.error(`エリア「${plan.area}」がありません。今あるエリア: ${items.map((a) => a.name).join(', ') || '（なし）'}`)
      process.exit(1)
    }
    areaId = area.id
    areaName = area.name
  }
} catch (e) {
  console.error(`Orbit に接続できません（${BASE}）。起動しているか確認してください。\n${e.message}`)
  process.exit(1)
}

console.log(`${dryRun ? '[確認のみ] ' : ''}登録先: ${BASE}  エリア: ${areaName}`)
// 登録は画面の取り込みと同じ API で行う（入力チェック・同じタイトルの飛ばし・サブタスクの期限の割り振り・1トランザクション）
const tasks = plan.tasks.map(({ subtasks, ...t }) => ({ ...t, subtasks: subtasks ?? [] }))
let result
try {
  result = await call('POST', `/plan-import?dryRun=${dryRun}`, { areaId, scheduleSubtasks: !noSchedule, tasks })
} catch (e) {
  console.error(`登録できませんでした。
${e.message}`)
  process.exit(1)
}
for (const row of result.tasks) {
  const label = `${row.title}（期限 ${row.dueDate ?? 'なし'}${row.dueTime ? ' ' + row.dueTime : ''}・サブタスク ${row.subtasks.length}件）`
  if (row.action === 'SKIP_DUPLICATE') {
    console.log(`  飛ばす  ${label} … 同じタイトルの親タスクが既にあります`)
    continue
  }
  console.log(`  ${dryRun ? '登録する' : `登録した #${row.id}`} ${label}`)
  for (const sub of row.subtasks) {
    const due = sub.dueDate ? ` 期限 ${sub.dueDate}${sub.scheduled ? '（自動）' : ''}` : ''
    console.log(`      - ${sub.done || row.done ? '[完了] ' : ''}${sub.title}${due}`)
  }
}
console.log(`${dryRun ? '登録予定' : '登録'} ${result.created}件、飛ばした ${result.skipped}件`)
