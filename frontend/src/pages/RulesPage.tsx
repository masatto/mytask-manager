import { useSearchParams } from 'react-router'
import type { Rule } from '../api/types.ts'
import { AreaBadge } from '../areas/AreaBadge.tsx'
import { useAreas } from '../areas/useAreas.ts'
import { PageTitle } from '../components/PageTitle.tsx'
import { RuleEditPanel } from '../components/RuleEditPanel.tsx'
import { useRules, useSetRuleActive } from '../hooks/useRules.ts'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard.tsx'
import { formatDate } from '../lib/date.ts'
import { describePattern } from '../lib/recurrence.ts'
import { useToast } from '../toast/useToast.ts'
import { PAGE_TITLES } from '../views.ts'
import styles from './RulesPage.module.css'

/** S3 繰り返しルール一覧。?rule={id}（新規は ?rule=new）で S4 の編集パネルを開く */
export function RulesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const ruleParam = searchParams.get('rule')
  const selected: number | 'new' | null = ruleParam === 'new' ? 'new' : Number(ruleParam) || null
  // 編集パネルに未保存の変更があれば、パネルの切り替えやページ移動の前に D4 を出す
  const { setDirty, dialog: discardDialog } = useUnsavedChangesGuard()

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

  return (
    <div className={selected ? styles.withPanel : undefined}>
      <PageTitle
        {...PAGE_TITLES.rules}
        extra={
          <button type="button" className={styles.newButton} onClick={() => setPanel('new')}>
            ＋ 新規ルール
          </button>
        }
      />

      <RuleList selectedId={typeof selected === 'number' ? selected : null} onOpen={(id) => setPanel(id)} />

      {selected && (
        <RuleEditPanel
          key={selected}
          ruleId={selected}
          onClose={() => setPanel(null)}
          onCreated={(id) => setPanel(id, true)}
          onDeleted={() => setPanel(null)}
          onDirtyChange={setDirty}
        />
      )}

      {discardDialog}
    </div>
  )
}

function RuleList({ selectedId, onOpen }: { selectedId: number | null; onOpen: (id: number) => void }) {
  const { data, isPending, isError, refetch } = useRules()
  const setActive = useSetRuleActive()
  const { showToast } = useToast()
  const { areas, areaId } = useAreas()

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
          const area = areaId === null ? areas.find((a) => a.id === rule.areaId) : undefined
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
                <div className={styles.titleCell}>
                  {area && <AreaBadge area={area} />}
                  <button type="button" className={styles.ruleTitle} onClick={() => onOpen(rule.id)}>
                    {rule.title}
                  </button>
                </div>
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
