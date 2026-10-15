import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { ApiRequestError } from '../api/client.ts'
import type { RulePreviewInput } from '../api/rules.ts'
import { PRIORITY_LABELS, type Priority, type Rule, type RuleInput, type Weekday } from '../api/types.ts'
import { useCreateRule, useDeleteRule, useRulePreview, useUpdateRule } from '../hooks/useRules.ts'
import { formatDate, todayKey } from '../lib/date.ts'
import { LAST_DAY, WEEKDAYS, WEEKDAY_LABELS, weekdayOf } from '../lib/recurrence.ts'
import { useToast } from '../toast/useToast.ts'
import { ConfirmDialog } from './ConfirmDialog.tsx'
import formStyles from './TaskEditForm.module.css'
import styles from './RuleForm.module.css'

const PRIORITIES: Priority[] = ['HIGH', 'MEDIUM', 'LOW']
const MAX_TEMPLATES = 20

const PATTERN_OPTIONS = [
  { value: 'WEEKLY', label: '毎週' },
  { value: 'DAILY', label: '毎日' },
  { value: 'MONTHLY', label: '毎月' },
] as const

const schema = z
  .object({
    title: z.string().trim().min(1, 'タイトルは必須です').max(200, 'タイトルは200文字以内で入力してください'),
    memo: z.string().max(10000, 'メモは10000文字以内で入力してください'),
    priority: z.enum(PRIORITIES),
    dueTime: z.string(),
    patternType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    daysOfWeek: z.array(z.enum(WEEKDAYS)),
    /** select の値なので文字列。'-1' は末日 */
    dayOfMonth: z.string(),
    startDate: z.string().min(1, '開始日は必須です'),
    endDate: z.string(),
    subtaskTemplates: z
      .array(
        z.object({
          title: z.string().trim().min(1, 'タイトルを入力してください').max(200, '200文字以内で入力してください'),
          priority: z.enum(PRIORITIES),
        }),
      )
      .max(MAX_TEMPLATES, `サブタスクのひな形は${MAX_TEMPLATES}件までです`),
  })
  .superRefine((v, ctx) => {
    if (v.patternType === 'WEEKLY' && v.daysOfWeek.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['daysOfWeek'], message: '曜日を1つ以上選んでください' })
    }
    if (v.endDate !== '' && v.startDate !== '' && v.endDate < v.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: '終了日は開始日以降にしてください' })
    }
  })

type FormValues = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function toFormValues(rule: Rule | null): FormValues {
  if (!rule) {
    // 新規作成の初期値：今日を起点に、毎週・今日の曜日
    const today = todayKey()
    const now = new Date()
    return {
      title: '',
      memo: '',
      priority: 'MEDIUM',
      dueTime: '',
      patternType: 'WEEKLY',
      daysOfWeek: [weekdayOf(now)],
      dayOfMonth: String(now.getDate()),
      startDate: today,
      endDate: '',
      subtaskTemplates: [],
    }
  }
  return {
    title: rule.title,
    memo: rule.memo ?? '',
    priority: rule.priority,
    dueTime: rule.dueTime ?? '',
    patternType: rule.pattern.type,
    daysOfWeek: rule.pattern.daysOfWeek ?? [weekdayOf(new Date())],
    dayOfMonth: String(rule.pattern.dayOfMonth ?? new Date().getDate()),
    startDate: rule.startDate,
    endDate: rule.endDate ?? '',
    subtaskTemplates: rule.subtaskTemplates,
  }
}

function toPattern(v: Pick<FormValues, 'patternType' | 'daysOfWeek' | 'dayOfMonth'>): RuleInput['pattern'] {
  return {
    type: v.patternType,
    daysOfWeek: v.patternType === 'WEEKLY' ? WEEKDAYS.filter((d) => v.daysOfWeek.includes(d)) : null,
    dayOfMonth: v.patternType === 'MONTHLY' ? Number(v.dayOfMonth) : null,
  }
}

function toInput(v: FormOutput, active: boolean): RuleInput {
  return {
    title: v.title,
    memo: v.memo === '' ? null : v.memo,
    priority: v.priority,
    dueTime: v.dueTime === '' ? null : v.dueTime,
    pattern: toPattern(v),
    startDate: v.startDate,
    endDate: v.endDate === '' ? null : v.endDate,
    active,
    subtaskTemplates: v.subtaskTemplates,
  }
}

type RuleFormProps = {
  /** null なら新規作成 */
  rule: Rule | null
  onClose: () => void
  onCreated: (id: number) => void
  onDeleted: () => void
  onDirtyChange: (dirty: boolean) => void
}

export function RuleForm({ rule, onClose, onCreated, onDeleted, onDirtyChange }: RuleFormProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(rule),
  })
  const templates = useFieldArray({ control, name: 'subtaskTemplates' })
  const createRule = useCreateRule()
  const updateRule = useUpdateRule()
  const deleteRule = useDeleteRule()
  const { showToast } = useToast()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // 新規作成はまだ何も保存されていないので、開いた時点では変更なしとして扱う
  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  const [patternType, daysOfWeek, dayOfMonth, startDate, endDate] = useWatch({
    control,
    name: ['patternType', 'daysOfWeek', 'dayOfMonth', 'startDate', 'endDate'],
  })
  const previewInput: RulePreviewInput | null =
    startDate === '' ||
    (patternType === 'WEEKLY' && daysOfWeek.length === 0) ||
    (endDate !== '' && endDate < startDate)
      ? null
      : {
          pattern: toPattern({ patternType, daysOfWeek, dayOfMonth }),
          startDate,
          endDate: endDate === '' ? null : endDate,
        }
  const preview = useRulePreview(previewInput)

  const handleError = (error: Error) => {
    if (error instanceof ApiRequestError && error.fieldErrors.length > 0) {
      for (const fe of error.fieldErrors) {
        // サーバーの pattern.daysOfWeek / pattern.dayOfMonth はフォームの daysOfWeek / dayOfMonth に対応する
        setError(fe.field.replace(/^pattern\./, '') as keyof FormValues, { message: fe.message })
      }
    } else {
      showToast({ message: '保存できませんでした' })
    }
  }

  const onSubmit = (values: FormOutput) => {
    if (rule === null) {
      createRule.mutate(toInput(values, true), {
        onSuccess: (created) => {
          onDirtyChange(false)
          showToast({ message: 'ルールを作成しました' })
          onCreated(created.id)
        },
        onError: handleError,
      })
    } else {
      updateRule.mutate(
        { id: rule.id, input: toInput(values, rule.active) },
        {
          onSuccess: (updated) => {
            reset(toFormValues(updated))
            showToast({ message: '保存しました（変更は次回の生成分から反映されます）' })
          },
          onError: handleError,
        },
      )
    }
  }

  const handleDelete = () => {
    if (!rule) {
      return
    }
    deleteRule.mutate(rule.id, {
      onSuccess: () => {
        onDirtyChange(false)
        onDeleted()
        showToast({ message: 'ルールを削除しました' })
      },
      onError: () => showToast({ message: '削除できませんでした' }),
    })
    setConfirmingDelete(false)
  }

  const saving = createRule.isPending || updateRule.isPending

  return (
    <form className={formStyles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={formStyles.toolbar}>
        <button type="button" className={formStyles.iconButton} onClick={onClose} aria-label="閉じる">
          ×
        </button>
        {rule && (
          <button type="button" className={formStyles.deleteButton} onClick={() => setConfirmingDelete(true)}>
            ルールを削除
          </button>
        )}
      </div>

      <h2 className={styles.heading}>{rule ? 'ルールを編集' : '新しいルール'}</h2>

      <dl className={formStyles.fields}>
        <dt>
          <label htmlFor="rule-title">タイトル</label>
        </dt>
        <dd>
          <input
            id="rule-title"
            className={`${formStyles.input} ${styles.wide}`}
            {...register('title')}
            aria-invalid={errors.title ? true : undefined}
          />
          {errors.title && <p className={formStyles.fieldError}>{errors.title.message}</p>}
        </dd>

        <dt>優先度</dt>
        <dd>
          <div className={formStyles.radioGroup} role="radiogroup" aria-label="優先度">
            {PRIORITIES.map((p) => (
              <label key={p} className={formStyles.radio}>
                <input type="radio" value={p} {...register('priority')} />
                {PRIORITY_LABELS[p]}
              </label>
            ))}
          </div>
        </dd>

        <dt>
          <label htmlFor="rule-due-time">期限時刻</label>
        </dt>
        <dd className={styles.inline}>
          <input id="rule-due-time" type="time" className={formStyles.input} {...register('dueTime')} />
          <span className={styles.hint}>（任意）</span>
        </dd>

        <dt>パターン</dt>
        <dd>
          <div className={formStyles.radioGroup} role="radiogroup" aria-label="パターン">
            {PATTERN_OPTIONS.map((o) => (
              <label key={o.value} className={formStyles.radio}>
                <input type="radio" value={o.value} {...register('patternType')} />
                {o.label}
              </label>
            ))}
          </div>
        </dd>

        {patternType === 'WEEKLY' && (
          <>
            <dt>曜日</dt>
            <dd>
              <div className={styles.weekdays} role="group" aria-label="曜日">
                {WEEKDAYS.map((d: Weekday) => (
                  <label key={d} className={styles.weekday}>
                    <input type="checkbox" value={d} {...register('daysOfWeek')} />
                    <span>{WEEKDAY_LABELS[d]}</span>
                  </label>
                ))}
              </div>
              {errors.daysOfWeek && <p className={formStyles.fieldError}>{errors.daysOfWeek.message}</p>}
            </dd>
          </>
        )}

        {patternType === 'MONTHLY' && (
          <>
            <dt>
              <label htmlFor="rule-day-of-month">日付</label>
            </dt>
            <dd className={styles.inline}>
              <select id="rule-day-of-month" className={formStyles.select} {...register('dayOfMonth')}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={String(day)}>
                    {day}日
                  </option>
                ))}
                <option value={String(LAST_DAY)}>末日</option>
              </select>
              <span className={styles.hint}>その月にない日付は月末になります</span>
              {errors.dayOfMonth && <p className={formStyles.fieldError}>{errors.dayOfMonth.message}</p>}
            </dd>
          </>
        )}

        <dt>
          <label htmlFor="rule-start-date">開始日</label>
        </dt>
        <dd>
          <input id="rule-start-date" type="date" className={formStyles.input} {...register('startDate')} />
          {errors.startDate && <p className={formStyles.fieldError}>{errors.startDate.message}</p>}
        </dd>

        <dt>
          <label htmlFor="rule-end-date">終了日</label>
        </dt>
        <dd className={styles.inline}>
          <input id="rule-end-date" type="date" className={formStyles.input} {...register('endDate')} />
          <span className={styles.hint}>（任意）</span>
          {errors.endDate && <p className={formStyles.fieldError}>{errors.endDate.message}</p>}
        </dd>
      </dl>

      <label className={formStyles.memoLabel} htmlFor="rule-memo">
        メモ
      </label>
      <textarea id="rule-memo" className={formStyles.memo} rows={3} {...register('memo')} />

      <section className={styles.templates} aria-label="サブタスクのひな形">
        <h3 className={formStyles.subtasksHeading}>サブタスクのひな形</h3>
        <ul className={styles.templateList}>
          {templates.fields.map((field, index) => (
            <li key={field.id} className={styles.templateItem}>
              <input
                className={`${formStyles.input} ${styles.templateTitle}`}
                {...register(`subtaskTemplates.${index}.title`)}
                aria-label={`ひな形${index + 1}のタイトル`}
                aria-invalid={errors.subtaskTemplates?.[index]?.title ? true : undefined}
              />
              <select
                className={formStyles.select}
                {...register(`subtaskTemplates.${index}.priority`)}
                aria-label={`ひな形${index + 1}の優先度`}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={formStyles.textButton}
                onClick={() => templates.remove(index)}
                aria-label={`ひな形${index + 1}を削除`}
              >
                ×
              </button>
              {errors.subtaskTemplates?.[index]?.title && (
                <p className={`${formStyles.fieldError} ${styles.templateError}`}>
                  {errors.subtaskTemplates[index].title.message}
                </p>
              )}
            </li>
          ))}
        </ul>
        {templates.fields.length < MAX_TEMPLATES && (
          <button
            type="button"
            className={styles.addTemplate}
            onClick={() => templates.append({ title: '', priority: 'MEDIUM' })}
          >
            ＋ 追加
          </button>
        )}
      </section>

      <section className={styles.preview} aria-label="次回の生成予定">
        <h3 className={formStyles.subtasksHeading}>次回の生成予定</h3>
        <p className={styles.previewDates}>
          {previewInput === null
            ? '—'
            : preview.data
              ? preview.data.occurrences.length > 0
                ? preview.data.occurrences.map(formatDate).join('、')
                : '生成予定はありません'
              : preview.isError
                ? '計算できませんでした'
                : '計算中…'}
        </p>
      </section>

      <div className={formStyles.actions}>
        <button type="button" className={formStyles.secondary} onClick={onClose}>
          キャンセル
        </button>
        <button type="submit" className={formStyles.primary} disabled={(rule !== null && !isDirty) || saving}>
          {saving ? '保存中…' : rule ? '保存' : '作成'}
        </button>
      </div>

      {confirmingDelete && rule && (
        <ConfirmDialog
          message={`ルール「${rule.title}」を削除しますか？生成済みのタスクは残ります。`}
          confirmLabel="削除"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </form>
  )
}
