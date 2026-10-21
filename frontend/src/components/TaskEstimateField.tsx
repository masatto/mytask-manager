import type { UseFormRegister, UseFormSetValue } from 'react-hook-form'
import type { Task } from '../api/types.ts'
import { estimateMinutesOf, estimateOverrun, formatEstimate, sumEstimates, tidyEstimateText } from '../lib/estimate.ts'
import styles from './TaskEditForm.module.css'
import type { TaskFormValues } from './taskEditFormValues.ts'

type TaskEstimateFieldProps = {
  register: UseFormRegister<TaskFormValues>
  setValue: UseFormSetValue<TaskFormValues>
  /** 入力中の値。保存前でも、打ち直すとすぐ超過の表示が変わるように使う */
  estimate: string
  subtasks: Task[]
  error: string | undefined
}

/** 目安時間：入力欄と、サブタスクの目安の合計（親の目安を超えていれば超過分） */
export function TaskEstimateField({ register, setValue, estimate, subtasks, error }: TaskEstimateFieldProps) {
  const subtaskTotal = sumEstimates(subtasks)
  const over = estimateOverrun(estimateMinutesOf(estimate), subtaskTotal)

  return (
    <>
      <div className={styles.dueRow}>
        <input
          id="task-estimate"
          className={`${styles.input} ${styles.estimateInput}`}
          placeholder="例：90、1h30m"
          aria-invalid={error ? true : undefined}
          {...register('estimate', {
            // 「90」と打って離れたら「1h30m」に整える（読めない入力はそのまま残してエラーを出す）
            onBlur: (e) => {
              const tidy = tidyEstimateText(e.target.value)
              if (tidy !== null) {
                setValue('estimate', tidy, { shouldValidate: true })
              }
            },
          })}
        />
        {subtaskTotal !== null && (
          <span
            className={over !== null ? `${styles.estimateSum} ${styles.estimateOver}` : styles.estimateSum}
            title={over !== null ? 'サブタスクの目安の合計が、このタスクの目安を超えています' : undefined}
          >
            サブタスク合計 {formatEstimate(subtaskTotal)}
            {over !== null && `（${formatEstimate(over)} 超過）`}
          </span>
        )}
      </div>
      {error && <p className={styles.fieldError}>{error}</p>}
    </>
  )
}
