import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { ApiRequestError } from '../api/client.ts'
import { PRIORITIES, PRIORITY_LABELS, type Rule } from '../api/types.ts'
import { useAreas } from '../areas/useAreas.ts'
import { AreaRadioGroup } from '../areas/AreaRadioGroup.tsx'
import { useCreateRule, useDeleteRule, useRulePreview, useUpdateRule } from '../hooks/useRules.ts'
import { formatDate } from '../lib/date.ts'
import { tidyEstimateText } from '../lib/estimate.ts'
import { useToast } from '../toast/useToast.ts'
import { ConfirmDialog } from './ConfirmDialog.tsx'
import styles from './RuleForm.module.css'
import { RulePatternFields } from './RulePatternFields.tsx'
import { RuleTemplateList } from './RuleTemplateList.tsx'
import {
  ruleFormSchema,
  toFormField,
  toFormValues,
  toInput,
  toPreviewInput,
  type RuleFormOutput,
  type RuleFormValues,
} from './ruleFormValues.ts'
import formStyles from './TaskEditForm.module.css'

type RuleFormProps = {
  /** null なら新規作成 */
  rule: Rule | null
  onClose: () => void
  onCreated: (id: number) => void
  onDeleted: () => void
  onDirtyChange: (dirty: boolean) => void
}

/**
 * 繰り返しルール編集パネル（S4）のフォーム。保存した変更は次回の生成分から反映される。
 * パターンの欄は RulePatternFields、ひな形は RuleTemplateList、値の変換は ruleFormValues.ts。
 */
export function RuleForm({ rule, onClose, onCreated, onDeleted, onDirtyChange }: RuleFormProps) {
  const { areas, areaId: selectedAreaId } = useAreas()
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isDirty },
  } = useForm<RuleFormValues, unknown, RuleFormOutput>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: toFormValues(rule, selectedAreaId),
  })
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
  const previewInput = toPreviewInput({ patternType, daysOfWeek, dayOfMonth, startDate, endDate })
  const preview = useRulePreview(previewInput)

  const handleError = (error: Error) => {
    if (error instanceof ApiRequestError && error.fieldErrors.length > 0) {
      for (const fe of error.fieldErrors) {
        setError(toFormField(fe.field), { message: fe.message })
      }
    } else {
      showToast({ message: '保存できませんでした' })
    }
  }

  const onSubmit = (values: RuleFormOutput) => {
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

  const handleDelete = async () => {
    if (!rule) {
      return
    }
    setConfirmingDelete(false)
    // 削除後はルールの詳細データが消えてこのフォームがすぐ外れることがあるので、mutateAsync で待つ
    try {
      await deleteRule.mutateAsync(rule.id)
    } catch {
      showToast({ message: '削除できませんでした' })
      return
    }
    onDirtyChange(false)
    onDeleted()
    showToast({ message: 'ルールを削除しました' })
  }

  /** 「90」と打って離れたら「1h30m」に整える（読めない入力はそのまま残してエラーを出す） */
  const tidyEstimate = (name: 'estimate' | `subtaskTemplates.${number}.estimate`, value: string) => {
    const tidy = tidyEstimateText(value)
    if (tidy !== null) {
      setValue(name, tidy, { shouldValidate: true })
    }
  }

  const saving = createRule.isPending || updateRule.isPending

  return (
    <form className={formStyles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={formStyles.toolbar}>
        <button type="button" className={formStyles.iconButton} onClick={onClose} aria-label="閉じる" data-hotkey="close-panel">
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

        {areas.length > 0 && (
          <>
            <dt>エリア</dt>
            <dd>
              <AreaRadioGroup registration={register('areaId')} />
              {errors.areaId && <p className={formStyles.fieldError}>{errors.areaId.message}</p>}
            </dd>
          </>
        )}

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
          <label htmlFor="rule-estimate">目安時間</label>
        </dt>
        <dd className={styles.inline}>
          <input
            id="rule-estimate"
            className={`${formStyles.input} ${formStyles.estimateInput}`}
            placeholder="例：20、1h30m"
            aria-invalid={errors.estimate ? true : undefined}
            {...register('estimate', { onBlur: (e) => tidyEstimate('estimate', e.target.value) })}
          />
          <span className={styles.hint}>（任意）</span>
          {errors.estimate && <p className={formStyles.fieldError}>{errors.estimate.message}</p>}
        </dd>

        <dt>
          <label htmlFor="rule-due-time">期限時刻</label>
        </dt>
        <dd className={styles.inline}>
          <input id="rule-due-time" type="time" className={formStyles.input} {...register('dueTime')} />
          <span className={styles.hint}>（任意）</span>
        </dd>

        <RulePatternFields register={register} errors={errors} patternType={patternType} />

        {/* 手動のルールは自動で作らないので、期間を持たない（開始日は内部的に今日のまま） */}
        {patternType !== 'MANUAL' && (
          <>
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
          </>
        )}
      </dl>

      <label className={formStyles.memoLabel} htmlFor="rule-memo">
        メモ
      </label>
      <textarea id="rule-memo" className={formStyles.memo} rows={3} {...register('memo')} />

      <RuleTemplateList
        control={control}
        register={register}
        errors={errors.subtaskTemplates}
        onEstimateBlur={tidyEstimate}
      />

      {patternType !== 'MANUAL' && (
        <section className={styles.preview} aria-label="次回の生成予定">
          <h3 className={formStyles.subtasksHeading}>次回の生成予定</h3>
          <p className={styles.previewDates}>{previewText(previewInput !== null, preview)}</p>
        </section>
      )}

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

/** 次回の生成予定の表示文。入力が途中なら「—」 */
function previewText(ready: boolean, preview: ReturnType<typeof useRulePreview>): string {
  if (!ready) {
    return '—'
  }
  if (preview.data) {
    return preview.data.occurrences.length > 0 ? preview.data.occurrences.map(formatDate).join('、') : '生成予定はありません'
  }
  return preview.isError ? '計算できませんでした' : '計算中…'
}
