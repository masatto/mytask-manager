import { useMutation } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ApiRequestError } from '../api/client.ts'
import { createTaskFromRule } from '../api/rules.ts'
import type { Rule } from '../api/types.ts'
import { useInvalidateTasks } from '../hooks/useTasks.ts'
import { todayKey } from '../lib/date.ts'
import { useToast } from '../toast/useToast.ts'
import styles from './ConfirmDialog.module.css'
import dialogStyles from './CreateFromRuleDialog.module.css'
import formStyles from './TaskEditForm.module.css'

/** 作ったタスクが出るビュー（期限なし → いつか、今日以前 → 今日、それより先 → これから） */
function viewPathFor(dueDate: string | null): string {
  if (dueDate === null) {
    return '/no-due'
  }
  return dueDate <= todayKey() ? '/today' : '/upcoming'
}

type CreateFromRuleDialogProps = {
  rule: Rule
  onClose: () => void
}

/**
 * ルールをひな形にしてタスクを作るダイアログ（screen-design 8.6）。作るたびに変わるタスク名と期限だけを入力する。
 * サブタスク・目安・優先度・エリア・メモはルールのものをそのまま使う。
 */
export function CreateFromRuleDialog({ rule, onClose }: CreateFromRuleDialogProps) {
  const [title, setTitle] = useState(rule.title)
  const [dueDate, setDueDate] = useState(todayKey())
  const [dueTime, setDueTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  const invalidate = useInvalidateTasks()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const create = useMutation({
    mutationFn: () =>
      createTaskFromRule(rule.id, {
        title: title.trim(),
        dueDate: dueDate || null,
        dueTime: dueDate && dueTime ? dueTime : null,
      }),
    onSuccess: (created) => {
      onClose()
      showToast({
        message: `「${created.title}」を作成しました`,
        action: { label: '開く', onClick: () => navigate(`${viewPathFor(created.dueDate)}?task=${created.id}`) },
      })
    },
    onError: (e) =>
      setError(e instanceof ApiRequestError ? (e.fieldErrors[0]?.message ?? e.message) : '作成できませんでした'),
    onSettled: invalidate,
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (title.trim() !== '' && !create.isPending) {
      create.mutate()
    }
  }

  const subtasks = rule.subtaskTemplates.map((t) => t.title).join('・')

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <form
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`「${rule.title}」からタスクを作成`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <p className={styles.message}>「{rule.title}」からタスクを作成</p>
        {subtasks && <p className={styles.detail}>サブタスク：{subtasks}</p>}
        <div className={dialogStyles.fields}>
          <label className={formStyles.memoLabel} htmlFor="create-from-rule-title">
            タスク名
          </label>
          <input
            id="create-from-rule-title"
            className={`${formStyles.input} ${dialogStyles.title}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            autoFocus
          />
          <label className={formStyles.memoLabel} htmlFor="create-from-rule-due">
            期限
          </label>
          <div className={formStyles.dueRow}>
            <input
              id="create-from-rule-due"
              type="date"
              className={formStyles.input}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <input
              type="time"
              className={formStyles.input}
              aria-label="期限時刻"
              value={dueTime}
              disabled={!dueDate}
              onChange={(e) => setDueTime(e.target.value)}
            />
          </div>
        </div>
        {error && (
          <p className={formStyles.fieldError} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className={styles.confirm} disabled={title.trim() === '' || create.isPending}>
            作成
          </button>
        </div>
      </form>
    </div>
  )
}
