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
  detail: (id: number) => ['tasks', 'detail', id] as const,
}

export function fetchTaskList(view: ViewKey, offset = 0): Promise<TaskListResponse> {
  const params = new URLSearchParams({ view })
  if (view === 'done') {
    params.set('offset', String(offset))
    params.set('limit', String(DONE_PAGE_SIZE))
  }
  return apiFetch(`/tasks?${params}`)
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

export function changeTaskStatus(id: number, status: TaskStatus): Promise<{ changed: StatusChange[] }> {
  return apiFetch(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export function restoreTaskStatuses(changes: { id: number; status: TaskStatus }[]): Promise<void> {
  return apiFetch('/tasks/statuses', { method: 'PATCH', body: JSON.stringify({ changes }) })
}

export function deleteTask(id: number): Promise<void> {
  return apiFetch(`/tasks/${id}`, { method: 'DELETE' })
}
