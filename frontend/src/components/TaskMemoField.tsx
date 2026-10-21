import type { UseFormRegister } from 'react-hook-form'
import styles from './TaskEditForm.module.css'
import type { TaskFormValues } from './taskEditFormValues.ts'

/** メモに書かれた URL（http/https）。重複を除いて最大5件 */
const URL_PATTERN = /https?:\/\/[^\s<>"'）」』】]+/g
const MAX_LINKS = 5

function extractLinks(memo: string): string[] {
  return [...new Set(memo.match(URL_PATTERN) ?? [])].slice(0, MAX_LINKS)
}

type TaskMemoFieldProps = {
  register: UseFormRegister<TaskFormValues>
  /** 入力中のメモ（リンクを取り出す） */
  memo: string
  error: string | undefined
}

/** メモと、メモ中の URL のリンク（クリックで開けるよう、メモの下に並べる） */
export function TaskMemoField({ register, memo, error }: TaskMemoFieldProps) {
  const links = extractLinks(memo)
  return (
    <>
      <label className={styles.memoLabel} htmlFor="task-memo">
        メモ
      </label>
      <textarea id="task-memo" className={styles.memo} rows={5} {...register('memo')} />
      {error && <p className={styles.fieldError}>{error}</p>}
      {links.length > 0 && (
        <ul className={styles.memoLinks} aria-label="メモのリンク">
          {links.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
                {url.replace(/^https?:\/\//, '')}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
