import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changeTaskStatus,
  createTask,
  deleteTask,
  fetchTask,
  fetchTaskCounts,
  fetchTaskList,
  restoreTaskStatuses,
  taskKeys,
  updateTask,
  DONE_PAGE_SIZE,
} from '../api/tasks.ts'
import type { Task, TaskCreateInput, TaskStatus, TaskUpdateInput } from '../api/types.ts'
import { useToast } from '../toast/useToast.ts'
import type { ViewKey } from '../views.ts'

/** 未完了ビュー（今日・今後・期限なし）の一覧 */
export function useOpenTaskList(view: Exclude<ViewKey, 'done'>) {
  return useQuery({
    queryKey: taskKeys.list(view),
    queryFn: () => fetchTaskList(view),
  })
}

/** 完了済みビューの一覧（「さらに表示」で100件ずつ追加） */
export function useDoneTaskList() {
  return useInfiniteQuery({
    queryKey: taskKeys.list('done'),
    queryFn: ({ pageParam }) => fetchTaskList('done', pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastOffset) =>
      lastPage.hasMore ? lastOffset + DONE_PAGE_SIZE : undefined,
  })
}

export function useTaskCounts() {
  return useQuery({
    queryKey: taskKeys.counts(),
    queryFn: fetchTaskCounts,
  })
}

export function useTask(id: number) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => fetchTask(id),
    retry: false,
  })
}

/** タスクの変更は一覧・件数・詳細のすべてに影響するので、まとめて再取得する */
function useInvalidateTasks() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: taskKeys.all })
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: TaskCreateInput) => createTask(input),
    onSuccess: invalidate,
  })
}

export function useUpdateTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: TaskUpdateInput }) => updateTask(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: (_data, id) => {
      // 削除済みの詳細を再取得すると 404 になるので、先にキャッシュから消す
      queryClient.removeQueries({ queryKey: taskKeys.detail(id) })
      return queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

/**
 * チェックボックスによる完了・未完了の切り替え。
 * 変更後に「元に戻す」付きのトーストを出す（screen-design 3.1）。
 */
export function useToggleComplete() {
  const invalidate = useInvalidateTasks()
  const { showToast } = useToast()

  const restore = useMutation({
    mutationFn: restoreTaskStatuses,
    onSettled: invalidate,
    onError: () => showToast({ message: '元に戻せませんでした' }),
  })

  const change = useMutation({
    mutationFn: ({ task, status }: { task: Task; status: TaskStatus }) => changeTaskStatus(task.id, status),
    onSuccess: ({ changed }, { status }) => {
      if (changed.length === 0) {
        return
      }
      showToast({
        message: status === 'DONE' ? '完了にしました' : '未完了に戻しました',
        action: {
          label: '元に戻す',
          onClick: () => restore.mutate(changed.map((c) => ({ id: c.id, status: c.previousStatus }))),
        },
      })
    },
    onError: () => showToast({ message: 'ステータスを変更できませんでした' }),
    onSettled: invalidate,
  })

  return {
    toggle: (task: Task, done: boolean) => change.mutate({ task, status: done ? 'DONE' : 'TODO' }),
    /** 送信中のタスクID と変更先（チェック状態を先に反映するため） */
    pending: change.isPending ? change.variables : undefined,
  }
}
