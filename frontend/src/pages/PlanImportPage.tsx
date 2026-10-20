import { useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { ApiRequestError } from '../api/client.ts'
import { importPlan, type PlanImportResult } from '../api/planImport.ts'
import { useAreas } from '../areas/useAreas.ts'
import { PageTitle } from '../components/PageTitle.tsx'
import { formatDate, todayKey } from '../lib/date.ts'
import { buildPlanPrompt } from '../lib/planPrompt.ts'
import { readPlanText, type ParsedPlan } from '../lib/planText.ts'
import { useToast } from '../toast/useToast.ts'
import { PAGE_TITLES } from '../views.ts'
import styles from './PlanImportPage.module.css'

/** 確認（dryRun）が済んだ計画。preview は登録する内容と飛ばす内容 */
type Checked = { plan: ParsedPlan; preview: PlanImportResult }

function serverErrors(error: unknown): string[] {
  if (error instanceof ApiRequestError && error.fieldErrors.length > 0) {
    return error.fieldErrors.map((e) => `${e.field}：${e.message}`)
  }
  return [error instanceof ApiRequestError ? error.message : '確認できませんでした。Orbit が動いているか確かめてください']
}

/**
 * S6 計画の取り込み（screen-design 8.2）。
 * プロンプトをコピーしてチャットAIで作業分割し、出てきた JSON を貼り付けて、確認してから登録する。
 */
export function PlanImportPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { areas, areaId: currentAreaId } = useAreas()
  const textId = useId()
  const areaSelectId = useId()
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [checked, setChecked] = useState<Checked | null>(null)
  const [areaId, setAreaId] = useState<number | null>(null)
  const [areaNotice, setAreaNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const prompt = buildPlanPrompt({ areaNames: areas.map((a) => a.name), today: todayKey() })

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      showToast({ message: 'プロンプトをコピーしました。チャットAIに貼り付けてください' })
    } catch {
      showToast({ message: 'コピーできませんでした。「プロンプトを見る」から選択してコピーしてください' })
    }
  }

  /** JSON の area（名前）を、今あるエリアに当てはめる。見つからなければ選んでいるエリアにして知らせる */
  const resolveArea = (name: string | null): number | null => {
    if (name === null) {
      setAreaNotice(null)
      return null
    }
    const match = areas.find((a) => a.name.toLowerCase() === name.toLowerCase())
    if (match) {
      setAreaNotice(null)
      return match.id
    }
    setAreaNotice(`「${name}」というエリアはありません。登録先を選んでください`)
    return currentAreaId
  }

  const check = async () => {
    setChecked(null)
    const result = readPlanText(text)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    const resolved = resolveArea(result.plan.areaName)
    setBusy(true)
    try {
      const preview = await importPlan({ areaId: resolved, tasks: result.plan.tasks }, true)
      setErrors([])
      setAreaId(resolved)
      setChecked({ plan: result.plan, preview })
    } catch (error) {
      setErrors(serverErrors(error))
    } finally {
      setBusy(false)
    }
  }

  const register = async (target: Checked) => {
    setBusy(true)
    try {
      const result = await importPlan({ areaId, tasks: target.plan.tasks }, false)
      await queryClient.invalidateQueries()
      showToast({
        message:
          result.skipped > 0
            ? `${result.created}件を登録しました（同じタイトルの${result.skipped}件は飛ばしました）`
            : `${result.created}件を登録しました`,
      })
      setText('')
      setChecked(null)
      setAreaNotice(null)
    } catch (error) {
      setErrors(serverErrors(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <PageTitle {...PAGE_TITLES.plan} showArea={false} />
      <p className={styles.lead}>
        チャットAI（ChatGPT など）に作業を分割してもらい、その結果をまとめてタスクに登録します。
      </p>

      <section className={styles.card} aria-labelledby="plan-prompt-heading">
        <h2 id="plan-prompt-heading" className={styles.heading}>
          1. プロンプトをAIに渡す
        </h2>
        <p className={styles.description}>
          コピーしてチャットAIに貼り付け、続けて「何をするか」「1日に使える時間」などを伝えます。
          AI が分割結果を表で見せるので、よければ「OK」と返すと JSON が出てきます。
        </p>
        <div className={styles.row}>
          <button type="button" className={styles.button} onClick={copyPrompt}>
            プロンプトをコピー
          </button>
        </div>
        <details className={styles.details}>
          <summary>プロンプトを見る</summary>
          <pre className={styles.prompt}>{prompt}</pre>
        </details>
      </section>

      <section className={styles.card} aria-labelledby="plan-json-heading">
        <h2 id="plan-json-heading" className={styles.heading}>
          2. AIが出したJSONを貼り付ける
        </h2>
        <label htmlFor={textId} className={styles.description}>
          コードブロックの前後の説明文ごと貼り付けても読めます。
        </label>
        <textarea
          id={textId}
          className={styles.textarea}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            // 書き換えたら、前の確認結果は使えない
            setChecked(null)
          }}
          rows={10}
          spellCheck={false}
          placeholder='{ "area": "…", "tasks": [ … ] }'
        />
        <div className={styles.row}>
          <button type="button" className={styles.button} onClick={check} disabled={busy || text.trim() === ''}>
            内容を確認
          </button>
        </div>
        {errors.length > 0 && (
          <div className={styles.error} role="alert">
            <p className={styles.errorTitle}>取り込めません</p>
            <ul className={styles.errorList}>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {checked && (
        <section className={styles.card} aria-labelledby="plan-preview-heading">
          <h2 id="plan-preview-heading" className={styles.heading}>
            3. 確認して登録する
          </h2>
          <div className={styles.areaRow}>
            <label htmlFor={areaSelectId}>登録先のエリア</label>
            <select
              id={areaSelectId}
              className={styles.select}
              value={areaId === null ? '' : String(areaId)}
              onChange={(e) => setAreaId(e.target.value === '' ? null : Number(e.target.value))}
            >
              {areas.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.name}
                </option>
              ))}
              <option value="">未分類</option>
            </select>
          </div>
          {areaNotice && <p className={styles.notice}>{areaNotice}</p>}

          <ul className={styles.rows} aria-label="登録する内容">
            {checked.preview.tasks.map((row, i) => {
              const skip = row.action === 'SKIP_DUPLICATE'
              const doneCount = row.subtasks.filter((s) => s.done).length
              return (
                <li key={`${i}-${row.title}`} className={skip ? `${styles.item} ${styles.skip}` : styles.item}>
                  <div className={styles.itemHead}>
                    <span className={skip ? `${styles.badge} ${styles.badgeSkip}` : styles.badge}>
                      {skip ? '飛ばす' : '登録'}
                    </span>
                    <span className={styles.title}>{row.title}</span>
                  </div>
                  <p className={styles.meta}>
                    {row.dueDate ? `期限 ${formatDate(row.dueDate)}${row.dueTime ? ` ${row.dueTime}` : ''}` : '期限なし'}
                    {row.priority === 'HIGH' && ' ・ 優先度 高'}
                    {row.done && ' ・ 完了'}
                    {skip && ' ・ 同じタイトルのタスクがあります'}
                  </p>
                  {row.subtasks.length > 0 && (
                    <details className={styles.subtasks}>
                      <summary>
                        サブタスク {row.subtasks.length}件{doneCount > 0 && `（完了 ${doneCount}）`}
                      </summary>
                      <ul>
                        {row.subtasks.map((s, j) => (
                          <li key={`${j}-${s.title}`} className={s.done || row.done ? styles.subDone : undefined}>
                            {s.title}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              )
            })}
          </ul>

          <div className={styles.row}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => register(checked)}
              disabled={busy || checked.preview.created === 0}
            >
              {checked.preview.created}件を登録
            </button>
            {checked.preview.skipped > 0 && (
              <span className={styles.meta}>同じタイトルの{checked.preview.skipped}件は登録しません</span>
            )}
          </div>
        </section>
      )}
    </section>
  )
}
