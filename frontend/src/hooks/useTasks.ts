import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTask,
  deleteTask,
  fetchTask,
  fetchTaskCounts,
  fetchTaskList,
  searchTasks,
  taskKeys,
  updateTask,
  DONE_PAGE_SIZE,
} from '../api/tasks.ts'
import type { TaskCreateInput, TaskDetail, TaskUpdateInput } from '../api/types.ts'
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

export function useTaskSearch(q: string) {
  return useQuery({
    queryKey: taskKeys.search(q),
    queryFn: () => searchTasks(q),
    enabled: q.trim() !== '',
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
export function useInvalidateTasks() {
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

/**
 * タスクを複製する。タイトルに「（コピー）」を付け、期限・優先度・メモとサブタスクも写す。
 * ステータスは未着手から始め、繰り返しの関係は写さない。作ったタスクを返す。
 */
export function useDuplicateTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: async (task: TaskDetail) => {
      const copy = await createTask({
        title: `${task.title}（コピー）`.slice(0, 200),
        memo: task.memo,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        priority: task.priority,
        ...(task.parentId !== null ? { parentId: task.parentId } : {}),
      })
      for (const sub of task.subtasks ?? []) {
        await createTask({
          title: sub.title,
          memo: sub.memo,
          dueDate: sub.dueDate,
          dueTime: sub.dueTime,
          priority: sub.priority,
          parentId: copy.id,
        })
      }
      return copy
    },
    onSettled: invalidate,
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
