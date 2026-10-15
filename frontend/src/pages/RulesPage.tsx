import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Rule } from '../api/types.ts'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { RuleEditPanel } from '../components/RuleEditPanel.tsx'
import { useRules, useSetRuleActive } from '../hooks/useRules.ts'
import { formatDate } from '../lib/date.ts'
import { describePattern } from '../lib/recurrence.ts'
import { useToast } from '../toast/useToast.ts'
import styles from './RulesPage.module.css'

/** S3 繰り返しルール一覧。?rule={id}（新規は ?rule=new）で S4 の編集パネルを開く */
export function RulesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const ruleParam = searchParams.get('rule')
  const selected: number | 'new' | null = ruleParam === 'new' ? 'new' : Number(ruleParam) || null
  const [panelDirty, setPanelDirty] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const setPanel = (value: number | 'new' | null, replace = false) =>
    setSearchParams(
      (prev) => {
        if (value === null) {
          prev.delete('rule')
        } else {
          prev.set('rule', String(value))
        }
        return prev
      },
      { replace },
    )

  /** 未保存の変更があれば D4 を出してから実行する */
  const guard = (action: () => void) => {
    if (panelDirty) {
      setPendingAction(() => action)
    } else {
      action()
    }
  }

  return (
    <div className={selected ? styles.withPanel : undefined}>
      <header className={styles.header}>
        <h1 className={styles.title}>繰り返しルール</h1>
        <button type="button" className={styles.newButton} onClick={() => guard(() => setPanel('new'))}>
          ＋ 新規ルール
        </button>
      </header>

      <RuleList selectedId={typeof selected === 'number' ? selected : null} onOpen={(id) => guard(() => setPanel(id))} />

      {selected && (
        <RuleEditPanel
          key={selected}
          ruleId={selected}
          onClose={() => guard(() => setPanel(null))}
          onCreated={(id) => setPanel(id, true)}
          onDeleted={() => setPanel(null)}
          onDirtyChange={setPanelDirty}
        />
      )}

      {pendingAction && (
        <ConfirmDialog
          message="変更を破棄しますか？"
          confirmLabel="破棄"
          cancelLabel="編集に戻る"
          danger
          onConfirm={() => {
            setPanelDirty(false)
            pendingAction()
            setPendingAction(null)
          }}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  )
}

function RuleList({ selectedId, onOpen }: { selectedId: number | null; onOpen: (id: number) => void }) {
  const { data, isPending, isError, refetch } = useRules()
  const setActive = useSetRuleActive()
  const { showToast } = useToast()

  if (isPending) {
    return <p className={styles.message}>読み込み中…</p>
  }
  if (isError) {
    return (
      <p className={styles.error} role="alert">
        読み込みに失敗しました
        <button type="button" className={styles.retry} onClick={() => refetch()}>
          再試行
        </button>
      </p>
    )
  }
  if (data.items.length === 0) {
    return <p className={styles.message}>繰り返しルールはありません</p>
  }

  const toggleActive = (rule: Rule, active: boolean) =>
    setActive.mutate(
      { id: rule.id, active },
      {
        onSuccess: () => showToast({ message: active ? `「${rule.title}」を再開しました` : `「${rule.title}」を停止しました` }),
        onError: () => showToast({ message: '切り替えられませんでした' }),
      },
    )

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.activeCol}>有効</th>
          <th>タイトル</th>
          <th>パターン</th>
          <th>次回</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((rule) => {
          const pendingActive =
            setActive.isPending && setActive.variables?.id === rule.id ? setActive.variables.active : rule.active
          return (
            <tr key={rule.id} className={rule.id === selectedId ? styles.selected : undefined}>
              <td className={styles.activeCol}>
                <input
                  type="checkbox"
                  role="switch"
                  className={styles.switch}
                  checked={pendingActive}
                  onChange={(e) => toggleActive(rule, e.target.checked)}
                  aria-label={`「${rule.title}」を有効にする`}
                />
              </td>
              <td>
                <button type="button" className={styles.ruleTitle} onClick={() => onOpen(rule.id)}>
                  {rule.title}
                </button>
              </td>
              <td className={styles.sub}>{describePattern(rule.pattern)}</td>
              <td className={styles.sub}>
                {rule.nextOccurrence ? formatDate(rule.nextOccurrence) : rule.active ? '—（終了）' : '—（停止中）'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
