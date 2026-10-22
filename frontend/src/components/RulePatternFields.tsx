import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import type { PatternType, Weekday } from '../api/types.ts'
import { LAST_DAY, WEEKDAYS, WEEKDAY_LABELS } from '../lib/recurrence.ts'
import styles from './RuleForm.module.css'
import type { RuleFormValues } from './ruleFormValues.ts'
import formStyles from './TaskEditForm.module.css'

const PATTERN_OPTIONS = [
  { value: 'WEEKLY', label: '毎週' },
  { value: 'DAILY', label: '毎日' },
  { value: 'MONTHLY', label: '毎月' },
  { value: 'MANUAL', label: '手動' },
] as const

type RulePatternFieldsProps = {
  register: UseFormRegister<RuleFormValues>
  errors: FieldErrors<RuleFormValues>
  /** 選んでいるパターン。毎週なら曜日、毎月なら日付の欄を出す */
  patternType: PatternType
}

/** 繰り返しのパターン（毎週・毎日・毎月）と、パターンごとの曜日・日付（dl の中に置く dt / dd） */
export function RulePatternFields({ register, errors, patternType }: RulePatternFieldsProps) {
  return (
    <>
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

      {patternType === 'MANUAL' && (
        <dd className={styles.hint}>
          自動では作りません。繰り返しルールの一覧の「作成」で、タスク名と期限を入れて、必要なときに作ります
        </dd>
      )}

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
    </>
  )
}
