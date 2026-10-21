import type { UseFormRegister, UseFormSetValue } from 'react-hook-form'
import { addDays, nextMonday, todayKey } from '../lib/date.ts'
import styles from './TaskEditForm.module.css'
import type { TaskFormValues } from './taskEditFormValues.ts'

type TaskDueFieldProps = {
  register: UseFormRegister<TaskFormValues>
  setValue: UseFormSetValue<TaskFormValues>
  /** 入力中の期限日（空なら時刻の欄を無効にする） */
  dueDate: string
  error: string | undefined
}

/** 期限：日付・時刻・クリアと、「今日」「明日」「来週月曜」のすばやい設定 */
export function TaskDueField({ register, setValue, dueDate, error }: TaskDueFieldProps) {
  const quickDates = [
    { label: '今日', date: todayKey() },
    { label: '明日', date: addDays(todayKey(), 1) },
    { label: '来週月曜', date: nextMonday(todayKey()) },
  ]

  return (
    <>
      <div className={styles.dueRow}>
        <input
          id="task-due-date"
          type="date"
          className={styles.input}
          {...register('dueDate', {
            // 日付を消したら時刻も消す（時刻だけの期限は持てない）
            onChange: (e) => {
              if (!e.target.value) {
                setValue('dueTime', '', { shouldDirty: true })
              }
            },
          })}
        />
        <input type="time" className={styles.input} aria-label="期限時刻" disabled={!dueDate} {...register('dueTime')} />
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
        {quickDates.map(({ label, date }) => (
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
      {error && <p className={styles.fieldError}>{error}</p>}
    </>
  )
}
