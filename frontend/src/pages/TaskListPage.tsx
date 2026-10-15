import { PageTitle } from '../components/PageTitle.tsx'
import { QuickAdd } from '../components/QuickAdd.tsx'
import { TaskGroups } from '../components/TaskGroups.tsx'
import { TodayProgress } from '../components/TodayProgress.tsx'
import { useDoneTaskList, useOpenTaskList } from '../hooks/useTasks.ts'
import { useTaskPanel } from '../hooks/useTaskPanel.tsx'
import { addDays, formatDate, todayKey } from '../lib/date.ts'
import { groupItems } from '../lib/grouping.ts'
import { VIEWS, type ViewKey } from '../views.ts'
import styles from './TaskListPage.module.css'

type TaskListPageProps = {
  view: ViewKey
}

type ListProps = {
  selectedId: number | null
  onOpen: (id: number) => void
}

export function TaskListPage({ view }: TaskListPageProps) {
  const { selectedId, open: handleOpen, panel } = useTaskPanel()

  const today = todayKey()
  const viewDef = VIEWS.find((v) => v.key === view)!

  return (
    <div className={selectedId ? styles.withPanel : undefined}>
      <PageTitle label={viewDef.label} sub={viewDef.sub} extra={
          view === 'today' ? (
            <>
              <TodayProgress />
              {formatDate(today)}
            </>
          ) : undefined
        } />

      {view === 'today' && <QuickAdd dueDate={today} placeholder="タスクを追加（期限は今日）　例：明日 15時 歯医者 !高" />}
      {view === 'upcoming' && <QuickAdd dueDate={addDays(today, 1)} placeholder="タスクを追加（期限は明日）　例：金曜 15時 定例資料 !高" />}
      {view === 'no-due' && <QuickAdd dueDate={null} placeholder="タスクを追加（期限なし）　例：本棚の整理 !低" />}

      {view === 'done' ? (
        <DoneList selectedId={selectedId} onOpen={handleOpen} />
      ) : (
        <OpenList view={view} selectedId={selectedId} onOpen={handleOpen} />
      )}

      {panel}
    </div>
  )
}

function OpenList({ view, selectedId, onOpen }: ListProps & { view: Exclude<ViewKey, 'done'> }) {
  const { data, isPending, isError, refetch } = useOpenTaskList(view)

  if (isPending) {
    return <ListSkeleton />
  }
  if (isError) {
    return <ListError onRetry={() => refetch()} />
  }
  const groups = groupItems(view, data.items, todayKey())
  if (groups.length === 0) {
    return <p className={styles.empty}>{view === 'today' ? '今日やることはありません' : 'タスクはありません'}</p>
  }
  return <TaskGroups groups={groups} showCompletedTime={false} selectedId={selectedId} onOpen={onOpen} />
}

function DoneList({ selectedId, onOpen }: ListProps) {
  const { data, isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useDoneTaskList()

  if (isPending) {
    return <ListSkeleton />
  }
  if (isError) {
    return <ListError onRetry={() => refetch()} />
  }
  const items = data.pages.flatMap((page) => page.items)
  const groups = groupItems('done', items, todayKey())
  if (groups.length === 0) {
    return <p className={styles.empty}>タスクはありません</p>
  }
  return (
    <>
      <TaskGroups groups={groups} showCompletedTime selectedId={selectedId} onOpen={onOpen} />
      {hasNextPage && (
        <div className={styles.more}>
          <button
            type="button"
            className={styles.moreButton}
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? '読み込み中…' : 'さらに表示'}
          </button>
        </div>
      )}
    </>
  )
}

function ListSkeleton() {
  return (
    <div className={styles.skeleton} aria-label="読み込み中">
      <span />
      <span />
      <span />
    </div>
  )
}

function ListError({ onRetry }: { onRetry: () => void }) {
  return (
    <p className={styles.error} role="alert">
      読み込みに失敗しました
      <button type="button" className={styles.retry} onClick={onRetry}>
        再試行
      </button>
    </p>
  )
}
