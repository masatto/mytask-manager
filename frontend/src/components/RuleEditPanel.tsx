import { ApiRequestError } from '../api/client.ts'
import { useRule } from '../hooks/useRules.ts'
import { RuleForm } from './RuleForm.tsx'
import styles from './TaskDetailPanel.module.css'

type RuleEditPanelProps = {
  ruleId: number | 'new'
  onClose: () => void
  onCreated: (id: number) => void
  onDeleted: () => void
  onDirtyChange: (dirty: boolean) => void
}

/** S4 繰り返しルール編集パネル */
export function RuleEditPanel({ ruleId, ...props }: RuleEditPanelProps) {
  return (
    <aside className={styles.panel} aria-label="繰り返しルールの編集">
      {ruleId === 'new' ? <RuleForm rule={null} {...props} /> : <ExistingRule ruleId={ruleId} {...props} />}
    </aside>
  )
}

function ExistingRule({ ruleId, ...props }: Omit<RuleEditPanelProps, 'ruleId'> & { ruleId: number }) {
  const { data: rule, isPending, isError, error } = useRule(ruleId)

  if (rule) {
    return <RuleForm key={rule.id} rule={rule} {...props} />
  }
  return (
    <>
      <div className={styles.header}>
        <button type="button" className={styles.close} onClick={props.onClose} aria-label="閉じる" data-hotkey="close-panel">
          ×
        </button>
      </div>
      <p className={styles.message}>
        {isPending
          ? '読み込み中…'
          : isError && error instanceof ApiRequestError && error.status === 404
            ? 'ルールが見つかりません'
            : '読み込みに失敗しました'}
      </p>
    </>
  )
}
