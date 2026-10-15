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
  /** 親のときだけ値を持つ */
  subtasks?: Task[]
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
  parentId?: number
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

/** api-design 4章：繰り返しルール */

export type PatternType = 'DAILY' | 'WEEKLY' | 'MONTHLY'
export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'

export type Pattern = {
  type: PatternType
  daysOfWeek: Weekday[] | null
  /** 1〜31、または -1（末日） */
  dayOfMonth: number | null
}

export type SubtaskTemplate = { title: string; priority: Priority }

export type RuleInput = {
  title: string
  memo: string | null
  priority: Priority
  dueTime: string | null
  pattern: Pattern
  startDate: string
  endDate: string | null
  active: boolean
  subtaskTemplates: SubtaskTemplate[]
}

export type Rule = RuleInput & {
  id: number
  nextOccurrence: string | null
  lastGeneratedDate: string | null
  createdAt: string
  updatedAt: string
}
