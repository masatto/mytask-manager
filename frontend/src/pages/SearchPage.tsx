import { useSearchParams } from 'react-router'
import { PageTitle } from '../components/PageTitle.tsx'
import { TaskGroups } from '../components/TaskGroups.tsx'
import { useTaskPanel } from '../hooks/useTaskPanel.tsx'
import { useTaskSearch } from '../hooks/useTasks.ts'
import { PAGE_TITLES } from '../views.ts'
import styles from './TaskListPage.module.css'

/** 検索結果（/search?q=…）。タイトル・メモの部分一致で、完了済みも含む */
export function SearchPage() {
  const [searchParams] = useSearchParams()
  const q = (searchParams.get('q') ?? '').trim()
  const { selectedId, open, panel } = useTaskPanel()
  const { data, isPending, isError, refetch } = useTaskSearch(q)

  return (
    <div className={selectedId ? styles.withPanel : undefined}>
      <PageTitle {...PAGE_TITLES.search} extra={q ? `「${q}」` : undefined} />

      {q === '' ? (
        <p className={styles.empty}>サイドバーの検索欄に語を入れて Enter を押してください</p>
      ) : isPending ? (
        <p className={styles.empty}>検索中…</p>
      ) : isError ? (
        <p className={styles.error} role="alert">
          検索に失敗しました
          <button type="button" className={styles.retry} onClick={() => refetch()}>
            再試行
          </button>
        </p>
      ) : data.items.length === 0 ? (
        <p className={styles.empty}>「{q}」に一致するタスクはありません</p>
      ) : (
        <>
          <p className={styles.resultCount}>
            {data.hasMore ? `${data.items.length}件以上見つかりました。語を足して絞り込んでください` : `${data.items.length}件`}
          </p>
          <TaskGroups
            groups={[{ key: 'results', label: null, emphasized: false, date: null, items: data.items }]}
            showCompletedTime={false}
            selectedId={selectedId}
            onOpen={open}
          />
        </>
      )}

      {panel}
    </div>
  )
}
