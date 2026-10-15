import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useCreateTask } from '../hooks/useTasks.ts'
import styles from './QuickAdd.module.css'

type QuickAddProps = {
  /** 登録するタスクの期限。null なら期限なし */
  dueDate: string | null
  dueHint: string
}

/** タイトルだけ入力して Enter で登録する（screen-design 3.6） */
export function QuickAdd({ dueDate, dueHint }: QuickAddProps) {
  const [title, setTitle] = useState('')
  const createTask = useCreateTask()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || createTask.isPending) {
      return
    }
    // 一覧の再取得を待たずにすぐ空にして、続けて入力できるようにする。失敗したら入力を戻す
    setTitle('')
    createTask.mutate({ title: trimmed, dueDate }, { onError: () => setTitle(trimmed) })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 日本語入力の変換確定の Enter で登録しないようにする
    if (e.key === 'Enter' && e.nativeEvent.isComposing) {
      e.preventDefault()
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <span className={styles.plus} aria-hidden="true">
        ＋
      </span>
      <input
        className={styles.input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`タスクを追加（Enterで登録・${dueHint}）`}
        aria-label="タスクを追加"
        maxLength={200}
      />
      {createTask.isError && <span className={styles.error}>登録できませんでした</span>}
    </form>
  )
}
