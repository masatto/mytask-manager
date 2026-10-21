import type { Plan, PlanState, PlanStep } from '../api/plans.ts'
import { AreaBadge } from '../areas/AreaBadge.tsx'
import { useAreas } from '../areas/useAreas.ts'
import { PageTitle } from '../components/PageTitle.tsx'
import { usePlans } from '../hooks/usePlans.ts'
import { useTaskPanel } from '../hooks/useTaskPanel.tsx'
import { formatDate } from '../lib/date.ts'
import { formatEstimate } from '../lib/estimate.ts'
import { PAGE_TITLES } from '../views.ts'
import listStyles from './TaskListPage.module.css'
import styles from './ProgressPage.module.css'

const STATE_LABELS: Record<PlanState, string> = {
  ON_TRACK: '順調',
  BEHIND: '遅れ',
  DONE: '完了',
}

const STEP_MARKS = { DONE: '✓', IN_PROGRESS: '◐', TODO: '○' } as const

/**
 * 計画ごとの進み具合（screen-design 8.4）。「<計画名> <番号>: <内容>」の親タスクを計画名でまとめ、
 * 進んだステップ数・残りの目安・最終期限までに必要なペースを出す。ステップを押すと詳細パネルで開く。
 */
export function ProgressPage() {
  const { selectedId, open, panel } = useTaskPanel()
  const { data, isPending, isError, refetch } = usePlans()

  return (
    <div className={selectedId ? listStyles.withPanel : undefined}>
      <PageTitle {...PAGE_TITLES.progress} />

      {isPending ? (
        <p className={listStyles.empty}>読み込み中…</p>
      ) : isError ? (
        <p className={listStyles.error} role="alert">
          読み込めませんでした
          <button type="button" className={listStyles.retry} onClick={() => refetch()}>
            再試行
          </button>
        </p>
      ) : data.items.length === 0 ? (
        <p className={listStyles.empty}>
          計画はまだありません。「韓国語学習 Step1: …」のように「名前 番号: 内容」の形のタスクが2つ以上あると、ここにまとまります
          （Plan 画面で取り込んだ計画はこの形になります）
        </p>
      ) : (
        <ul className={styles.plans}>
          {data.items.map((plan) => (
            <PlanCard key={plan.name} plan={plan} selectedId={selectedId} onOpen={open} />
          ))}
        </ul>
      )}

      {panel}
    </div>
  )
}

type PlanCardProps = { plan: Plan; selectedId: number | null; onOpen: (id: number) => void }

/** 計画1つ分のカード：見出し → バー → 数字 → 次のステップ → ステップの一覧 */
function PlanCard({ plan, selectedId, onOpen }: PlanCardProps) {
  // 「すべて」のときだけエリアを出す（絞り込んでいれば全部同じなので出さない）
  const { areas, areaId } = useAreas()
  const area = areaId === null ? areas.find((a) => a.id === plan.areaId) : undefined
  const next = plan.steps.find((s) => s.id === plan.nextStepId)
  const percent = Math.round((plan.doneSteps / plan.totalSteps) * 100)

  return (
    <li className={styles.card} aria-label={`計画「${plan.name}」`}>
      <div className={styles.head}>
        {area && <AreaBadge area={area} />}
        <h2 className={styles.name}>{plan.name}</h2>
        <span className={`${styles.state} ${styles[plan.state]}`}>
          {STATE_LABELS[plan.state]}
          {plan.state === 'BEHIND' && `（期限切れ ${plan.overdueSteps}）`}
        </span>
      </div>

      <div
        className={styles.progress}
        role="img"
        aria-label={`${plan.totalSteps}ステップ中${plan.doneSteps}ステップ完了`}
      >
        <span className={styles.bar}>
          <span className={styles.fill} style={{ width: `${percent}%` }} />
        </span>
        <span className={styles.stepCount}>
          {plan.doneSteps}/{plan.totalSteps} ステップ
        </span>
      </div>

      <PlanStats plan={plan} />

      {next && (
        <p className={styles.next}>
          次：
          <button type="button" className={styles.link} onClick={() => onOpen(next.id)}>
            {next.title}
          </button>
          {next.dueDate && (
            <span className={next.overdue ? styles.overdue : styles.of}>（期限 {formatDate(next.dueDate)}）</span>
          )}
        </p>
      )}

      <details className={styles.steps}>
        <summary>ステップの一覧</summary>
        <ol className={styles.stepList}>
          {plan.steps.map((step) => (
            <StepRow key={step.id} step={step} selected={step.id === selectedId} onOpen={onOpen} />
          ))}
        </ol>
      </details>
    </li>
  )
}

/** 残りの目安・最終期限・必要なペース。値のないものは出さない */
function PlanStats({ plan }: { plan: Plan }) {
  return (
    <dl className={styles.stats}>
      {plan.remainingMinutes !== null && plan.totalMinutes !== null && (
        <div>
          <dt>残りの目安</dt>
          <dd>
            {formatEstimate(plan.remainingMinutes)}
            <span className={styles.of}> / {formatEstimate(plan.totalMinutes)}</span>
          </dd>
        </div>
      )}
      {plan.finalDueDate && (
        <div>
          <dt>最終期限</dt>
          <dd>
            {formatDate(plan.finalDueDate)}
            {plan.state !== 'DONE' && plan.daysLeft !== null && (
              <span className={styles.of}>{daysLeftLabel(plan.daysLeft)}</span>
            )}
          </dd>
        </div>
      )}
      {plan.weeklyMinutesNeeded !== null && (
        <div>
          <dt>必要なペース</dt>
          <dd>週 {formatEstimate(plan.weeklyMinutesNeeded)}</dd>
        </div>
      )}
    </dl>
  )
}

/** 最終期限が今日なら daysLeft は 1（今日を含む日数）。0 以下は過ぎている */
function daysLeftLabel(daysLeft: number): string {
  return daysLeft > 0 ? `（あと${daysLeft}日）` : '（過ぎています）'
}

/** 手を付けていない・完了したステップは目安だけ、途中なら「残り 1h30m / 2h30m」 */
function stepEstimateLabel(step: PlanStep): string {
  if (step.estimateMinutes === null) {
    return ''
  }
  const untouched = step.remainingMinutes === step.estimateMinutes
  if (step.status === 'DONE' || untouched) {
    return formatEstimate(step.estimateMinutes)
  }
  return `残り ${formatEstimate(step.remainingMinutes)} / ${formatEstimate(step.estimateMinutes)}`
}

type StepRowProps = { step: PlanStep; selected: boolean; onOpen: (id: number) => void }

function StepRow({ step, selected, onOpen }: StepRowProps) {
  const done = step.status === 'DONE'
  return (
    <li className={selected ? `${styles.step} ${styles.selected}` : styles.step}>
      <span className={done ? `${styles.mark} ${styles.markDone}` : styles.mark} aria-hidden="true">
        {STEP_MARKS[step.status]}
      </span>
      <button
        type="button"
        className={done ? `${styles.stepTitle} ${styles.stepDone}` : styles.stepTitle}
        onClick={() => onOpen(step.id)}
      >
        {step.title}
      </button>
      {step.subtasksTotal > 0 && (
        <span className={styles.meta}>
          ✓ {step.subtasksDone}/{step.subtasksTotal}
        </span>
      )}
      <span className={styles.meta}>{stepEstimateLabel(step)}</span>
      <span className={step.overdue ? `${styles.due} ${styles.overdue}` : styles.due}>
        {step.dueDate ? formatDate(step.dueDate) : ''}
      </span>
    </li>
  )
}
