/** api-design 3.1 に対応する型 */

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW'
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

export type Task = {
  id: number
  title: string
  memo: string | null
  dueDate: string | null
  dueTime: string | null
  priority: Priority
  status: TaskStatus
  completedAt: string | null
  overdue: boolean
  parentId: number | null
  recurrence: { ruleId: number | null; ruleTitle: string | null; occurrenceDate: string } | null
  createdAt: string
  updatedAt: string
}

export type TaskDetail = Task & {
  parent?: { id: number; title: string }
  subtasks: Task[]
}

export type TaskListItem = {
  task: Task
  contextOnly: boolean
  subtasks: Task[]
  progress: { done: number; total: number }
  viewDate: string | null
  viewTime: string | null
  viewOverdue: boolean
}

export type TaskListResponse = {
  items: TaskListItem[]
  hasMore: boolean
}

export type TaskCounts = {
  today: number
  overdue: number
  upcoming: number
  noDue: number
}

export type StatusChange = {
  id: number
  previousStatus: TaskStatus
  status: TaskStatus
}

export type TaskCreateInput = {
  title: string
  memo?: string | null
  dueDate?: string | null
  dueTime?: string | null
  priority?: Priority
}

export type TaskUpdateInput = {
  title: string
  memo: string | null
  dueDate: string | null
  dueTime: string | null
  priority: Priority
  status: TaskStatus
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: '未着手',
  IN_PROGRESS: '進行中',
  DONE: '完了',
}
