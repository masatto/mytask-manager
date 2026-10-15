import { useState, type KeyboardEvent } from 'react'
import { useCreateTask } from '../hooks/useTasks.ts'
import styles from './QuickAdd.module.css'

type QuickAddProps = {
  /** 登録するタスクの期限。null なら期限なし */
  dueDate: string | null
  placeholder: string
  /** 指定するとサブタスクとして登録する */
  parentId?: number
  /** 詳細パネル内で使う小さい表示 */
  compact?: boolean
}

/**
 * タイトルだけ入力して Enter で登録する（screen-design 3.6）。
 * 詳細パネルの <form> の中でも使うため、<form> は使わずに Enter を直接扱う（form の入れ子は不正なHTML）。
 */
export function QuickAdd({ dueDate, placeholder, parentId, compact = false }: QuickAddProps) {
  const [title, setTitle] = useState('')
  const createTask = useCreateTask()

  const submit = () => {
    const trimmed = title.trim()
    if (!trimmed || createTask.isPending) {
      return
    }
    // 一覧の再取得を待たずにすぐ空にして、続けて入力できるようにする。失敗したら入力を戻す
    setTitle('')
    createTask.mutate(
      parentId === undefined ? { title: trimmed, dueDate } : { title: trimmed, dueDate, parentId },
      { onError: () => setTitle(trimmed) },
    )
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
    <div className={compact ? `${styles.form} ${styles.compact}` : styles.form}>
      <span className={styles.plus} aria-hidden="true">
        ＋
      </span>
      <input
        className={styles.input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={parentId === undefined ? 'タスクを追加' : 'サブタスクを追加'}
        maxLength={200}
        enterKeyHint="done"
        data-hotkey={compact ? undefined : 'quick-add'}
      />
      {createTask.isError && <span className={styles.error}>登録できませんでした</span>}
    </div>
  )
}
