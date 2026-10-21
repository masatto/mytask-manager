import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { PRIORITIES, PRIORITY_LABELS } from '../api/types.ts'
import styles from './RuleForm.module.css'
import { MAX_TEMPLATES, type RuleFormValues } from './ruleFormValues.ts'
import formStyles from './TaskEditForm.module.css'

type RuleTemplateListProps = {
  control: Control<RuleFormValues>
  register: UseFormRegister<RuleFormValues>
  errors: FieldErrors<RuleFormValues>['subtaskTemplates']
  /** 目安の欄を離れたとき（「90」を「1h30m」に整える） */
  onEstimateBlur: (name: `subtaskTemplates.${number}.estimate`, value: string) => void
}

/** サブタスクのひな形：タイトル・目安・優先度の行を追加・削除する（MAX_TEMPLATES 件まで） */
export function RuleTemplateList({ control, register, errors, onEstimateBlur }: RuleTemplateListProps) {
  const templates = useFieldArray({ control, name: 'subtaskTemplates' })

  return (
    <section className={styles.templates} aria-label="サブタスクのひな形">
      <h3 className={formStyles.subtasksHeading}>サブタスクのひな形</h3>
      <ul className={styles.templateList}>
        {templates.fields.map((field, index) => {
          const error = errors?.[index]
          return (
            <li key={field.id} className={styles.templateItem}>
              <input
                className={`${formStyles.input} ${styles.templateTitle}`}
                {...register(`subtaskTemplates.${index}.title`)}
                aria-label={`ひな形${index + 1}のタイトル`}
                aria-invalid={error?.title ? true : undefined}
              />
              <input
                className={`${formStyles.input} ${styles.templateEstimate}`}
                placeholder="目安"
                {...register(`subtaskTemplates.${index}.estimate`, {
                  onBlur: (e) => onEstimateBlur(`subtaskTemplates.${index}.estimate`, e.target.value),
                })}
                aria-label={`ひな形${index + 1}の目安時間`}
                aria-invalid={error?.estimate ? true : undefined}
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
              {error?.title && (
                <p className={`${formStyles.fieldError} ${styles.templateError}`}>{error.title.message}</p>
              )}
              {error?.estimate && (
                <p className={`${formStyles.fieldError} ${styles.templateError}`}>{error.estimate.message}</p>
              )}
            </li>
          )
        })}
      </ul>
      {templates.fields.length < MAX_TEMPLATES && (
        <button
          type="button"
          className={styles.addTemplate}
          onClick={() => templates.append({ title: '', priority: 'MEDIUM', estimate: '' })}
        >
          ＋ 追加
        </button>
      )}
    </section>
  )
}
