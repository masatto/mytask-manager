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
  /** エリア（null は未分類）。サブタスクは親と同じ */
  areaId: number | null
  /** 目安時間（分。null は未設定） */
  estimateMinutes: number | null
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
  /** 今日完了にした親タスクの数 */
  doneToday: number
  /** 今日ビューに残っている作業の目安の合計（分）。目安が1つもなければ null（古いバックエンドでは無い） */
  todayEstimateMinutes?: number | null
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
  /** サブタスクでは使わない（親のエリアに入る） */
  areaId?: number | null
  estimateMinutes?: number | null
}

export type TaskUpdateInput = {
  title: string
  memo: string | null
  dueDate: string | null
  dueTime: string | null
  priority: Priority
  status: TaskStatus
  /** 全項目を送るので、変えないときも今の値を入れる（サブタスクでは使わない） */
  areaId: number | null
  /** 全項目を送るので、変えないときも今の値を入れる（送らないと未設定に戻る） */
  estimateMinutes: number | null
}

/** 選択肢の並び順（高い順） */
export const PRIORITIES: Priority[] = ['HIGH', 'MEDIUM', 'LOW']
export const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE']

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

/** MANUAL は自動では作らず、一覧の「作成」で必要なときに作る（ひな形として使う） */
export type PatternType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'MANUAL'
export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'

export type Pattern = {
  type: PatternType
  daysOfWeek: Weekday[] | null
  /** 1〜31、または -1（末日） */
  dayOfMonth: number | null
}

export type SubtaskTemplate = { title: string; priority: Priority; estimateMinutes: number | null }

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
  /** 生成するタスクのエリア（null は未分類） */
  areaId: number | null
  /** 生成するタスクの目安時間（分） */
  estimateMinutes: number | null
}

export type Rule = RuleInput & {
  id: number
  nextOccurrence: string | null
  lastGeneratedDate: string | null
  createdAt: string
  updatedAt: string
}
