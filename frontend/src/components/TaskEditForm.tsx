import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ApiRequestError } from '../api/client.ts'
import { changeTaskStatus } from '../api/tasks.ts'
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Priority,
  type Task,
  type TaskDetail,
  type TaskStatus,
  type TaskUpdateInput,
} from '../api/types.ts'
import { useAreas } from '../areas/useAreas.ts'
import { AreaRadioGroup } from '../areas/AreaRadioGroup.tsx'
import { fromAreaField, toAreaField } from '../areas/areaField.ts'
import { isChecked, useToggleComplete } from '../hooks/useToggleComplete.tsx'
import { useDeleteTask, useDuplicateTask, useUpdateTask } from '../hooks/useTasks.ts'
import { addDays, formatDate, formatDateTime, nextMonday, todayKey } from '../lib/date.ts'
import { estimateMinutesOf, estimateText, formatEstimate, parseEstimate, sumEstimates } from '../lib/estimate.ts'
import { useToast } from '../toast/useToast.ts'
import { ConfirmDialog } from './ConfirmDialog.tsx'
import { PriorityMark } from './PriorityMark.tsx'
import { QuickAdd } from './QuickAdd.tsx'
import styles from './TaskEditForm.module.css'

const PRIORITIES: Priority[] = ['HIGH', 'MEDIUM', 'LOW']
const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE']

const schema = z
  .object({
    title: z.string().trim().min(1, 'タイトルは必須です').max(200, 'タイトルは200文字以内で入力してください'),
    memo: z.string().max(10000, 'メモは10000文字以内で入力してください'),
    dueDate: z.string(),
    // 日付が空のときは入力欄を無効にするので、値が来ないことがある
    dueTime: z.string().optional(),
    priority: z.enum(PRIORITIES),
    status: z.enum(STATUSES),
    /** '' は未分類 */
    areaId: z.string(),
    /** 「90」「1h30m」などの入力。保存時に分へ直す（'' は未設定） */
    estimate: estimateText,
  })
  .refine((v) => !v.dueTime || v.dueDate !== '', {
    path: ['dueTime'],
    message: '時刻だけの期限は設定できません。日付も入力してください',
  })

type FormValues = z.input<typeof schema>

/** メモに書かれた URL（http/https）。重複を除いて最大5件。クリックで開けるよう、メモの下に並べる */
const URL_PATTERN = /https?:\/\/[^\s<>"'）」』】]+/g
function extractLinks(memo: string | undefined): string[] {
  return [...new Set(memo?.match(URL_PATTERN) ?? [])].slice(0, 5)
}
type FormOutput = z.output<typeof schema>

function toFormValues(task: TaskDetail): FormValues {
  return {
    title: task.title,
    memo: task.memo ?? '',
    dueDate: task.dueDate ?? '',
    dueTime: task.dueTime ?? '',
    priority: task.priority,
    status: task.status,
    areaId: toAreaField(task.areaId),
    estimate: formatEstimate(task.estimateMinutes),
  }
}

function toUpdateInput(values: FormOutput): TaskUpdateInput {
  return {
    title: values.title,
    memo: values.memo === '' ? null : values.memo,
    dueDate: values.dueDate || null,
    dueTime: values.dueDate && values.dueTime ? values.dueTime : null,
    priority: values.priority,
    status: values.status,
    areaId: fromAreaField(values.areaId),
    estimateMinutes: estimateMinutesOf(values.estimate),
  }
}

type TaskEditFormProps = {
  task: TaskDetail
  onClose: () => void
  onDeleted: () => void
  onDirtyChange: (dirty: boolean) => void
  onOpenTask: (id: number) => void
  /** 生成元の繰り返しルールを開く */
  onOpenRule: (ruleId: number) => void
}

export function TaskEditForm({
  task,
  onClose,
  onDeleted,
  onDirtyChange,
  onOpenTask,
  onOpenRule,
}: TaskEditFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    resetField,
    setValue,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(task),
  })
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { toggle, pending, confirmDialog } = useToggleComplete()
  const { showToast } = useToast()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // D1：保存でステータスを完了にしようとしたが、未完了のサブタスクが残っている
  const [confirmingComplete, setConfirmingComplete] = useState<FormOutput | null>(null)

  const subtasks = task.subtasks ?? []
  const { areas } = useAreas()
  const incompleteSubtasks = subtasks.filter((s) => s.status !== 'DONE').length
  const subtaskEstimate = sumEstimates(subtasks)

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  // 一覧のチェックボックスなどでサーバー側の値が変わったら、フォームに反映する
  useEffect(() => {
    if (isDirty) {
      resetField('status', { defaultValue: task.status })
    } else {
      reset(toFormValues(task))
    }
    // task が更新されたときだけ同期する（編集中の値で上書きしないため isDirty は依存に入れない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task])

  const dueDate = watch('dueDate')
  const ownEstimate = estimateMinutesOf(watch('estimate'))
  const overEstimate = ownEstimate !== null && subtaskEstimate !== null && subtaskEstimate > ownEstimate
  const memoLinks = extractLinks(watch('memo'))
  const duplicateTask = useDuplicateTask()

  const handleDuplicate = async () => {
    try {
      const copy = await duplicateTask.mutateAsync(task)
      showToast({ message: '複製しました' })
      onOpenTask(copy.id)
    } catch {
      showToast({ message: '複製できませんでした' })
    }
  }

  const save = (values: FormOutput) => {
    updateTask.mutate(
      { id: task.id, input: toUpdateInput(values) },
      {
        onSuccess: (updated) => {
          reset(toFormValues({ ...task, ...updated }))
          showToast({ message: '保存しました' })
        },
        onError: (error) => {
          if (error instanceof ApiRequestError && error.fieldErrors.length > 0) {
            for (const fe of error.fieldErrors) {
              const field = fe.field === 'estimateMinutes' ? 'estimate' : fe.field
              setError(field as keyof FormValues, { message: fe.message })
            }
          } else {
            showToast({ message: '保存できませんでした' })
          }
        },
      },
    )
  }

  const onSubmit = (values: FormOutput) => {
    if (values.status === 'DONE' && task.status !== 'DONE' && incompleteSubtasks > 0) {
      setConfirmingComplete(values)
      return
    }
    save(values)
  }

  /** D1 で OK：サブタスクごと一括完了してから、残りの項目を保存する（api-design 3.6） */
  const completeAllAndSave = async (values: FormOutput) => {
    setConfirmingComplete(null)
    try {
      await changeTaskStatus(task.id, 'DONE', true)
    } catch {
      showToast({ message: '保存できませんでした' })
      return
    }
    save(values)
  }

  const handleDelete = async () => {
    setConfirmingDelete(false)
    // 削除後は詳細データが消えてこのフォームがすぐ外れることがある。mutate() のコールバックは外れると
    // 呼ばれないので、外れても必ず完了する mutateAsync で待つ
    try {
      await deleteTask.mutateAsync(task.id)
    } catch {
      showToast({ message: '削除できませんでした' })
      return
    }
    onDirtyChange(false)
    onDeleted()
    showToast({ message: '削除しました' })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={styles.toolbar}>
        <button type="button" className={styles.iconButton} onClick={onClose} aria-label="閉じる" data-hotkey="close-panel">
          ×
        </button>
        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.textButton}
            onClick={handleDuplicate}
            disabled={duplicateTask.isPending}
          >
            複製
          </button>
          <button type="button" className={styles.deleteButton} onClick={() => setConfirmingDelete(true)}>
            削除
          </button>
        </div>
      </div>

      {task.parent && (
        <button type="button" className={styles.parentLink} onClick={() => onOpenTask(task.parent!.id)}>
          ← {task.parent.title}
        </button>
      )}

      <div className={styles.titleRow}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={isChecked(task, pending)}
          onChange={(e) => toggle(task, e.target.checked)}
          aria-label={`「${task.title}」を完了にする`}
        />
        <input
          className={styles.titleInput}
          {...register('title')}
          aria-label="タイトル"
          aria-invalid={errors.title ? true : undefined}
        />
      </div>
      {errors.title && <p className={styles.fieldError}>{errors.title.message}</p>}

      <dl className={styles.fields}>
        {/* サブタスクは親と同じエリアに入るので、親のときだけ選べる */}
        {!task.parent && areas.length > 0 && (
          <>
            <dt>エリア</dt>
            <dd>
              <AreaRadioGroup registration={register('areaId')} />
              {errors.areaId && <p className={styles.fieldError}>{errors.areaId.message}</p>}
            </dd>
          </>
        )}

        <dt>
          <label htmlFor="task-status">ステータス</label>
        </dt>
        <dd>
          <select id="task-status" className={styles.select} {...register('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </dd>

        <dt>優先度</dt>
        <dd>
          <div className={styles.radioGroup} role="radiogroup" aria-label="優先度">
            {PRIORITIES.map((p) => (
              <label key={p} className={styles.radio}>
                <input type="radio" value={p} {...register('priority')} />
                {PRIORITY_LABELS[p]}
              </label>
            ))}
          </div>
        </dd>

        <dt>
          <label htmlFor="task-due-date">期限</label>
        </dt>
        <dd>
          <div className={styles.dueRow}>
            <input
              id="task-due-date"
              type="date"
              className={styles.input}
              {...register('dueDate', {
                onChange: (e) => {
                  if (!e.target.value) {
                    setValue('dueTime', '', { shouldDirty: true })
                  }
                },
              })}
            />
            <input
              type="time"
              className={styles.input}
              aria-label="期限時刻"
              disabled={!dueDate}
              {...register('dueTime')}
            />
            <button
              type="button"
              className={styles.textButton}
              onClick={() => {
                setValue('dueDate', '', { shouldDirty: true })
                setValue('dueTime', '', { shouldDirty: true })
              }}
            >
              クリア
            </button>
          </div>
          <div className={styles.quickDates} role="group" aria-label="期限をすばやく設定">
            {[
              { label: '今日', date: todayKey() },
              { label: '明日', date: addDays(todayKey(), 1) },
              { label: '来週月曜', date: nextMonday(todayKey()) },
            ].map(({ label, date }) => (
              <button
                key={label}
                type="button"
                className={styles.quickDate}
                onClick={() => setValue('dueDate', date, { shouldDirty: true })}
              >
                {label}
              </button>
            ))}
          </div>
          {errors.dueTime && <p className={styles.fieldError}>{errors.dueTime.message}</p>}
        </dd>

        <dt>
          <label htmlFor="task-estimate">目安時間</label>
        </dt>
        <dd>
          <div className={styles.dueRow}>
            <input
              id="task-estimate"
              className={`${styles.input} ${styles.estimateInput}`}
              placeholder="例：90、1h30m"
              aria-invalid={errors.estimate ? true : undefined}
              {...register('estimate', {
                // 「90」と打って離れたら「1h30m」に整える（読めない入力はそのまま残してエラーを出す）
                onBlur: (e) => {
                  const parsed = parseEstimate(e.target.value)
                  if (parsed.ok) {
                    setValue('estimate', formatEstimate(parsed.minutes), { shouldValidate: true })
                  }
                },
              })}
            />
            {subtaskEstimate !== null && (
              <span
                className={overEstimate ? `${styles.estimateSum} ${styles.estimateOver}` : styles.estimateSum}
                title={overEstimate ? 'サブタスクの目安の合計が、このタスクの目安を超えています' : undefined}
              >
                サブタスク合計 {formatEstimate(subtaskEstimate)}
                {overEstimate && `（${formatEstimate(subtaskEstimate - ownEstimate!)} 超過）`}
              </span>
            )}
          </div>
          {errors.estimate && <p className={styles.fieldError}>{errors.estimate.message}</p>}
        </dd>

        {task.recurrence && (
          <>
            <dt>繰り返し</dt>
            <dd className={styles.readonly}>
              {task.recurrence.ruleId !== null ? (
                <>
                  {task.recurrence.ruleTitle}（{formatDate(task.recurrence.occurrenceDate)}分）
                  <button
                    type="button"
                    className={styles.ruleLink}
                    onClick={() => onOpenRule(task.recurrence!.ruleId!)}
                  >
                    → ルールを開く
                  </button>
                </>
              ) : (
                <>削除されたルールから生成（{formatDate(task.recurrence.occurrenceDate)}分）</>
              )}
            </dd>
          </>
        )}
      </dl>

      <label className={styles.memoLabel} htmlFor="task-memo">
        メモ
      </label>
      <textarea id="task-memo" className={styles.memo} rows={5} {...register('memo')} />
      {errors.memo && <p className={styles.fieldError}>{errors.memo.message}</p>}
      {memoLinks.length > 0 && (
        <ul className={styles.memoLinks} aria-label="メモのリンク">
          {memoLinks.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
                {url.replace(/^https?:\/\//, '')}
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* サブタスクの下にはサブタスクを作れないので、親のときだけ出す（1階層の制約） */}
      {!task.parent && (
        <section className={styles.subtasks} aria-label="サブタスク">
          <h3 className={styles.subtasksHeading}>
            サブタスク
            {subtasks.length > 0 && (
              <span className={styles.subtasksCount}>
                {subtasks.length - incompleteSubtasks}/{subtasks.length}
              </span>
            )}
          </h3>
          <ul className={styles.subtaskList}>
            {subtasks.map((sub) => (
              <SubtaskItem
                key={sub.id}
                task={sub}
                checked={isChecked(sub, pending)}
                onToggle={toggle}
                onOpen={onOpenTask}
              />
            ))}
          </ul>
          <QuickAdd dueDate={null} parentId={task.id} placeholder="サブタスクを追加（例：明日 指摘1の修正）" compact />
        </section>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onClose}>
          キャンセル
        </button>
        <button type="submit" className={styles.primary} disabled={!isDirty || updateTask.isPending}>
          {updateTask.isPending ? '保存中…' : '保存'}
        </button>
      </div>

      <p className={styles.meta}>
        作成 {formatDateTime(task.createdAt)} ・ 更新 {formatDateTime(task.updatedAt)}
      </p>

      {confirmingDelete && (
        <ConfirmDialog
          message={
            subtasks.length > 0
              ? `サブタスク${subtasks.length}件も削除されます。削除しますか？`
              : 'このタスクを削除しますか？'
          }
          confirmLabel="削除"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
      {confirmingComplete && (
        <ConfirmDialog
          message={`未完了のサブタスクが${incompleteSubtasks}件あります。すべて完了にしますか？`}
          confirmLabel="すべて完了"
          onConfirm={() => completeAllAndSave(confirmingComplete)}
          onCancel={() => setConfirmingComplete(null)}
        />
      )}
      {confirmDialog}
    </form>
  )
}

type SubtaskItemProps = {
  task: Task
  checked: boolean
  onToggle: (task: Task, done: boolean) => void
  onOpen: (id: number) => void
}

function SubtaskItem({ task, checked, onToggle, onOpen }: SubtaskItemProps) {
  const due = task.dueDate ? [formatDate(task.dueDate), task.dueTime].filter(Boolean).join(' ') : ''
  return (
    <li className={styles.subtaskItem}>
      <input
        type="checkbox"
        className={styles.subtaskCheckbox}
        checked={checked}
        onChange={(e) => onToggle(task, e.target.checked)}
        aria-label={`「${task.title}」を完了にする`}
      />
      <button
        type="button"
        className={checked ? `${styles.subtaskTitle} ${styles.subtaskDone}` : styles.subtaskTitle}
        onClick={() => onOpen(task.id)}
      >
        {task.title}
      </button>
      <PriorityMark priority={task.priority} />
      {task.estimateMinutes != null && (
        <span className={styles.subtaskEstimate} aria-label={`目安 ${formatEstimate(task.estimateMinutes)}`}>
          {formatEstimate(task.estimateMinutes)}
        </span>
      )}
      {due && <span className={task.overdue ? `${styles.subtaskDue} ${styles.overdue}` : styles.subtaskDue}>{due}</span>}
    </li>
  )
}
