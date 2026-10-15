import { useState, type KeyboardEvent } from 'react'
import { PRIORITY_LABELS, type TaskCreateInput } from '../api/types.ts'
import { useCreateTask } from '../hooks/useTasks.ts'
import { formatDate, todayKey } from '../lib/date.ts'
import { parseQuickAdd, type ParsedQuickAdd } from '../lib/quickAddParser.ts'
import styles from './QuickAdd.module.css'

type QuickAddProps = {
  /** 期限を書かなかったときの期限。null なら期限なし */
  dueDate: string | null
  placeholder: string
  /** 指定するとサブタスクとして登録する */
  parentId?: number
  /** 詳細パネル内で使う小さい表示 */
  compact?: boolean
}

/** 読み取った内容と既定の期限から、登録する内容を決める */
function toInput(parsed: ParsedQuickAdd, defaultDueDate: string | null, parentId?: number): TaskCreateInput {
  // 時刻だけを書いたときは、既定の期限がなければ今日の時刻とみなす
  const dueDate = parsed.dueDate ?? defaultDueDate ?? (parsed.dueTime ? todayKey() : null)
  return {
    title: parsed.title,
    dueDate,
    ...(dueDate && parsed.dueTime ? { dueTime: parsed.dueTime } : {}),
    ...(parsed.priority ? { priority: parsed.priority } : {}),
    ...(parentId !== undefined ? { parentId } : {}),
  }
}

/** 期限・優先度を読み取ったときだけ、どう登録されるかを入力欄の下に出す */
function Preview({ parsed, input }: { parsed: ParsedQuickAdd; input: TaskCreateInput }) {
  if (parsed.dueDate === undefined && parsed.dueTime === undefined && parsed.priority === undefined) {
    return null
  }
  const parts = [
    input.dueDate ? `期限 ${formatDate(input.dueDate)}${input.dueTime ? ` ${input.dueTime}` : ''}` : '期限なし',
    parsed.priority ? `優先度 ${PRIORITY_LABELS[parsed.priority]}` : null,
  ].filter(Boolean)
  return (
    <p className={styles.preview} role="status" aria-label="読み取った内容">
      {parts.join(' ・ ')}
      {parsed.title ? <span className={styles.previewTitle}>「{parsed.title}」</span> : <span className={styles.previewWarn}>タイトルを入力してください</span>}
    </p>
  )
}

/**
 * タイトルを入力して Enter で登録する（screen-design 3.6）。
 * 「明日 15:00 歯医者 !高」のように書くと、期限・時刻・優先度も読み取る（lib/quickAddParser.ts）。
 * 詳細パネルの <form> の中でも使うため、<form> は使わずに Enter を直接扱う（form の入れ子は不正なHTML）。
 */
export function QuickAdd({ dueDate, placeholder, parentId, compact = false }: QuickAddProps) {
  const [text, setText] = useState('')
  const createTask = useCreateTask()
  const parsed = parseQuickAdd(text, todayKey())
  const input = toInput(parsed, dueDate, parentId)

  const submit = () => {
    if (!parsed.title || createTask.isPending) {
      return
    }
    // 一覧の再取得を待たずにすぐ空にして、続けて入力できるようにする。失敗したら入力を戻す
    const original = text
    setText('')
    createTask.mutate(input, { onError: () => setText(original) })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') {
      return
    }
    // 外側の form を送信させない。日本語入力の変換確定の Enter では登録しない
    e.preventDefault()
    if (!e.nativeEvent.isComposing) {
      submit()
    }
  }

  return (
    <div className={compact ? `${styles.wrapper} ${styles.compactWrapper}` : styles.wrapper}>
      <div className={compact ? `${styles.form} ${styles.compact}` : styles.form}>
        <span className={styles.plus} aria-hidden="true">
          ＋
        </span>
        <input
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={parentId === undefined ? 'タスクを追加' : 'サブタスクを追加'}
          maxLength={200}
          enterKeyHint="done"
          data-hotkey={compact ? undefined : 'quick-add'}
        />
        {createTask.isError && <span className={styles.error}>登録できませんでした</span>}
      </div>
      <Preview parsed={parsed} input={input} />
    </div>
  )
}
