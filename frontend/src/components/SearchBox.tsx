import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import styles from './SearchBox.module.css'

/** サイドバーの検索欄。Enter で /search?q=… に移動する（ショートカット：/） */
export function SearchBox() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const currentQ = location.pathname === '/search' ? (searchParams.get('q') ?? '') : ''
  const [value, setValue] = useState(currentQ)
  const [syncedQ, setSyncedQ] = useState(currentQ)

  // URL の検索語が変わったとき（検索した・戻る/進む・ほかの画面へ移動）は、入力欄をそれに合わせる
  if (syncedQ !== currentQ) {
    setSyncedQ(currentQ)
    setValue(currentQ)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const q = value.trim()
    if (q) {
      navigate(`/search?${new URLSearchParams({ q })}`)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 日本語入力の変換確定の Enter では検索しない
    if (e.key === 'Enter' && e.nativeEvent.isComposing) {
      e.preventDefault()
    }
    if (e.key === 'Escape') {
      e.currentTarget.blur()
    }
  }

  return (
    <form role="search" className={styles.form} onSubmit={handleSubmit}>
      <input
        type="search"
        className={styles.input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="検索（/）"
        aria-label="タスクを検索"
        maxLength={100}
        data-hotkey="search"
      />
    </form>
  )
}
