import { useNavigate, useSearchParams } from 'react-router'
import { QuickAdd } from '../components/QuickAdd.tsx'
import { TaskDetailPanel } from '../components/TaskDetailPanel.tsx'
import { TaskGroups } from '../components/TaskGroups.tsx'
import { useDoneTaskList, useOpenTaskList } from '../hooks/useTasks.ts'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard.tsx'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const selectedId = Number(searchParams.get('task')) || null
  // 詳細パネルに未保存の変更があれば、パネルの切り替えやページ移動の前に D4 を出す
  const { setDirty, dialog: discardDialog } = useUnsavedChangesGuard()

  const today = todayKey()
  const label = VIEWS.find((v) => v.key === view)?.label

  const openPanel = (id: number) =>
    setSearchParams((prev) => {
      prev.set('task', String(id))
      return prev
    })
  const closePanel = () =>
    setSearchParams((prev) => {
      prev.delete('task')
      return prev
    })

  const handleOpen = (id: number) => {
    if (id !== selectedId) {
      openPanel(id)
    }
  }

  return (
    <div className={selectedId ? styles.withPanel : undefined}>
      <header className={styles.header}>
        <h1 className={styles.title}>{label}</h1>
        {view === 'today' && <span className={styles.date}>{formatDate(today)}</span>}
      </header>

      {view === 'today' && <QuickAdd dueDate={today} placeholder="タスクを追加（Enterで登録・期限は今日）" />}
      {view === 'upcoming' && <QuickAdd dueDate={addDays(today, 1)} placeholder="タスクを追加（Enterで登録・期限は明日）" />}
      {view === 'no-due' && <QuickAdd dueDate={null} placeholder="タスクを追加（Enterで登録・期限なし）" />}

      {view === 'done' ? (
        <DoneList selectedId={selectedId} onOpen={handleOpen} />
      ) : (
        <OpenList view={view} selectedId={selectedId} onOpen={handleOpen} />
      )}

      {selectedId && (
        <TaskDetailPanel
          key={selectedId}
          taskId={selectedId}
          onClose={closePanel}
          onDeleted={closePanel}
          onOpenTask={handleOpen}
          onOpenRule={(ruleId) => navigate(`/rules?rule=${ruleId}`)}
          onDirtyChange={setDirty}
        />
      )}

      {discardDialog}
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
