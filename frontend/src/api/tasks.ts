import type { ViewKey } from '../views.ts'
import { apiFetch } from './client.ts'
import type {
  StatusChange,
  TaskCounts,
  TaskCreateInput,
  TaskDetail,
  TaskListResponse,
  TaskStatus,
  TaskUpdateInput,
  Task,
} from './types.ts'

export const DONE_PAGE_SIZE = 100

export const taskKeys = {
  all: ['tasks'] as const,
  list: (view: ViewKey) => ['tasks', 'list', view] as const,
  counts: () => ['tasks', 'counts'] as const,
  doneToday: () => ['tasks', 'list', 'done-today'] as const,
  detail: (id: number) => ['tasks', 'detail', id] as const,
  search: (q: string) => ['tasks', 'search', q] as const,
}

export function fetchTaskList(view: ViewKey, offset = 0): Promise<TaskListResponse> {
  const params = new URLSearchParams({ view })
  if (view === 'done') {
    params.set('offset', String(offset))
    params.set('limit', String(DONE_PAGE_SIZE))
  }
  return apiFetch(`/tasks?${params}`)
}

/** タイトル・メモの部分一致検索。完了済みも含み、最大100行 */
export function searchTasks(q: string): Promise<TaskListResponse> {
  return apiFetch(`/tasks/search?${new URLSearchParams({ q })}`)
}

/** 今日完了にした親タスク（Today の「今日完了」。件数は counts.doneToday と同じ） */
export function fetchDoneToday(): Promise<TaskListResponse> {
  return apiFetch('/tasks?view=done-today')
}

export function fetchTaskCounts(): Promise<TaskCounts> {
  return apiFetch('/tasks/counts')
}

export function fetchTask(id: number): Promise<TaskDetail> {
  return apiFetch(`/tasks/${id}`)
}

export function createTask(input: TaskCreateInput): Promise<Task> {
  return apiFetch('/tasks', { method: 'POST', body: JSON.stringify(input) })
}

export function updateTask(id: number, input: TaskUpdateInput): Promise<Task> {
  return apiFetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function changeTaskStatus(
  id: number,
  status: TaskStatus,
  completeSubtasks = false,
): Promise<{ changed: StatusChange[] }> {
  const body = completeSubtasks ? { status, completeSubtasks } : { status }
  return apiFetch(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function restoreTaskStatuses(changes: { id: number; status: TaskStatus }[]): Promise<void> {
  return apiFetch('/tasks/statuses', { method: 'PATCH', body: JSON.stringify({ changes }) })
}

export function deleteTask(id: number): Promise<void> {
  return apiFetch(`/tasks/${id}`, { method: 'DELETE' })
}
