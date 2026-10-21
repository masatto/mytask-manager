import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ApiRequestError } from '../api/client.ts'
import { changeTaskStatus } from '../api/tasks.ts'
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS, type TaskDetail } from '../api/types.ts'
import { useAreas } from '../areas/useAreas.ts'
import { AreaRadioGroup } from '../areas/AreaRadioGroup.tsx'
import { isChecked, useToggleComplete } from '../hooks/useToggleComplete.tsx'
import { useDeleteTask, useDuplicateTask, useUpdateTask } from '../hooks/useTasks.ts'
import { formatDate, formatDateTime } from '../lib/date.ts'
import { useToast } from '../toast/useToast.ts'
import { ConfirmDialog } from './ConfirmDialog.tsx'
import { SubtaskList } from './SubtaskList.tsx'
import { TaskDueField } from './TaskDueField.tsx'
import styles from './TaskEditForm.module.css'
import { TaskEstimateField } from './TaskEstimateField.tsx'
import { TaskMemoField } from './TaskMemoField.tsx'
import {
  taskFormSchema,
  toFormField,
  toFormValues,
  toUpdateInput,
  type TaskFormOutput,
  type TaskFormValues,
} from './taskEditFormValues.ts'

type TaskEditFormProps = {
  task: TaskDetail
  onClose: () => void
  onDeleted: () => void
  onDirtyChange: (dirty: boolean) => void
  onOpenTask: (id: number) => void
  /** 生成元の繰り返しルールを開く */
  onOpenRule: (ruleId: number) => void
}

/**
 * タスク詳細パネル（S2）の編集フォーム。「保存」ボタンで保存する（自動保存はしない）。
 * 入力欄の部品は Task*Field / SubtaskList、値の変換は taskEditFormValues.ts。
 */
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
  } = useForm<TaskFormValues, unknown, TaskFormOutput>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: toFormValues(task),
  })
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const duplicateTask = useDuplicateTask()
  const { toggle, pending, confirmDialog } = useToggleComplete()
  const { showToast } = useToast()
  const { areas } = useAreas()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // D1：保存でステータスを完了にしようとしたが、未完了のサブタスクが残っている
  const [confirmingComplete, setConfirmingComplete] = useState<TaskFormOutput | null>(null)

  const subtasks = task.subtasks ?? []
  const incompleteSubtasks = subtasks.filter((s) => s.status !== 'DONE').length

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

  const handleDuplicate = async () => {
    try {
      const copy = await duplicateTask.mutateAsync(task)
      showToast({ message: '複製しました' })
      onOpenTask(copy.id)
    } catch {
      showToast({ message: '複製できませんでした' })
    }
  }

  const save = (values: TaskFormOutput) => {
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
              setError(toFormField(fe.field), { message: fe.message })
            }
          } else {
            showToast({ message: '保存できませんでした' })
          }
        },
      },
    )
  }

  const onSubmit = (values: TaskFormOutput) => {
    if (values.status === 'DONE' && task.status !== 'DONE' && incompleteSubtasks > 0) {
      setConfirmingComplete(values)
      return
    }
    save(values)
  }

  /** D1 で OK：サブタスクごと一括完了してから、残りの項目を保存する（api-design 3.6） */
  const completeAllAndSave = async (values: TaskFormOutput) => {
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
          <TaskDueField
            register={register}
            setValue={setValue}
            dueDate={watch('dueDate')}
            error={errors.dueTime?.message}
          />
        </dd>

        <dt>
          <label htmlFor="task-estimate">目安時間</label>
        </dt>
        <dd>
          <TaskEstimateField
            register={register}
            setValue={setValue}
            estimate={watch('estimate')}
            subtasks={subtasks}
            error={errors.estimate?.message}
          />
        </dd>

        {task.recurrence && (
          <>
            <dt>繰り返し</dt>
            <dd className={styles.readonly}>
              <RecurrenceInfo recurrence={task.recurrence} onOpenRule={onOpenRule} />
            </dd>
          </>
        )}
      </dl>

      <TaskMemoField register={register} memo={watch('memo')} error={errors.memo?.message} />

      {/* サブタスクの下にはサブタスクを作れないので、親のときだけ出す（1階層の制約） */}
      {!task.parent && (
        <SubtaskList
          parentId={task.id}
          subtasks={subtasks}
          isChecked={(sub) => isChecked(sub, pending)}
          onToggle={toggle}
          onOpen={onOpenTask}
        />
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

type RecurrenceInfoProps = {
  recurrence: NonNullable<TaskDetail['recurrence']>
  onOpenRule: (ruleId: number) => void
}

/** 生成元の繰り返しルール。ルールが削除済みなら、その旨だけを出す */
function RecurrenceInfo({ recurrence, onOpenRule }: RecurrenceInfoProps) {
  const occurrence = formatDate(recurrence.occurrenceDate)
  if (recurrence.ruleId === null) {
    return <>削除されたルールから生成（{occurrence}分）</>
  }
  const ruleId = recurrence.ruleId
  return (
    <>
      {recurrence.ruleTitle}（{occurrence}分）
      <button type="button" className={styles.ruleLink} onClick={() => onOpenRule(ruleId)}>
        → ルールを開く
      </button>
    </>
  )
}
