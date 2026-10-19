import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { areaKeys } from '../api/areas.ts'
import {
  createTask,
  deleteTask,
  fetchTask,
  fetchDoneToday,
  fetchTaskCounts,
  fetchTaskList,
  searchTasks,
  taskKeys,
  updateTask,
  DONE_PAGE_SIZE,
} from '../api/tasks.ts'
import type { TaskCreateInput, TaskDetail, TaskUpdateInput } from '../api/types.ts'
import { useAreas } from '../areas/useAreas.ts'
import type { ViewKey } from '../views.ts'

/** 未完了ビュー（今日・今後・期限なし）の一覧 */
export function useOpenTaskList(view: Exclude<ViewKey, 'done'>) {
  const { areaId } = useAreas()
  return useQuery({
    queryKey: taskKeys.list(view, areaId),
    queryFn: () => fetchTaskList(view, areaId),
  })
}

/** 完了済みビューの一覧（「さらに表示」で100件ずつ追加） */
export function useDoneTaskList() {
  const { areaId } = useAreas()
  return useInfiniteQuery({
    queryKey: taskKeys.list('done', areaId),
    queryFn: ({ pageParam }) => fetchTaskList('done', areaId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastOffset) =>
      lastPage.hasMore ? lastOffset + DONE_PAGE_SIZE : undefined,
  })
}

export function useTaskSearch(q: string) {
  const { areaId } = useAreas()
  return useQuery({
    queryKey: taskKeys.search(q, areaId),
    queryFn: () => searchTasks(q, areaId),
    enabled: q.trim() !== '',
  })
}

export function useDoneTodayList() {
  const { areaId } = useAreas()
  return useQuery({ queryKey: taskKeys.doneToday(areaId), queryFn: () => fetchDoneToday(areaId) })
}

export function useTaskCounts() {
  const { areaId } = useAreas()
  return useQuery({
    queryKey: taskKeys.counts(areaId),
    queryFn: () => fetchTaskCounts(areaId),
  })
}

export function useTask(id: number) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => fetchTask(id),
    retry: false,
  })
}

/**
 * タスクの変更は一覧・件数・詳細のすべてに影響するので、まとめて再取得する。
 * エリアごとのタスク数（削除の確認に使う）も変わるので、エリアも取り直す
 */
export function useInvalidateTasks() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: taskKeys.all }),
      queryClient.invalidateQueries({ queryKey: areaKeys.all }),
    ])
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
        ...(task.parentId !== null ? { parentId: task.parentId } : { areaId: task.areaId }),
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
