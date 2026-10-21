import type { Task, TaskListItem } from '../api/types.ts'

export type RecordedRequest = { method: string; path: string; body: unknown }

type Handler = (req: RecordedRequest) => { status: number; body?: unknown; headers?: Record<string, string> }

/**
 * fetch を差し替えるテスト用の簡易APIサーバー。
 * 呼び出しを記録し、登録したハンドラーで応答する（未登録のパスは 404）。
 */
export function installFakeApi(handlers: Record<string, Handler>) {
  const requests: RecordedRequest[] = []
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost')
    const req: RecordedRequest = {
      method: init?.method ?? 'GET',
      path: url.pathname.replace(/^\/api/, '') + url.search,
      body: init?.body ? parseBody(String(init.body)) : undefined,
    }
    requests.push(req)
    const key = `${req.method} ${req.path}`
    const handler =
      handlers[key] ?? handlers[`${req.method} ${url.pathname.replace(/^\/api/, '')}`] ?? DEFAULT_HANDLERS[key]
    const res = handler ? handler(req) : { status: 404, body: { code: 'NOT_FOUND', message: 'not found' } }
    return new Response(res.status === 204 ? null : JSON.stringify(res.body ?? {}), {
      status: res.status,
      headers: { 'Content-Type': 'application/json', ...res.headers },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { requests }
}

/** 登録しなくても応答するもの。エリアは、指定しなければ「なし」（タブを出さない）にする */
const DEFAULT_HANDLERS: Record<string, Handler> = {
  'GET /areas': () => ({ status: 200, body: { items: [] } }),
}

/** JSON として読めない本文（不正なファイルのテストなど）は文字列のまま記録する */
function parseBody(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: 'タスク',
    memo: null,
    dueDate: null,
    dueTime: null,
    priority: 'MEDIUM',
    status: 'TODO',
    completedAt: null,
    overdue: false,
    parentId: null,
    recurrence: null,
    areaId: null,
    estimateMinutes: null,
    createdAt: '2026-10-14T09:00:00+09:00',
    updatedAt: '2026-10-14T09:00:00+09:00',
    ...overrides,
  }
}

export function listItem(task: Task): TaskListItem {
  return {
    task,
    contextOnly: false,
    subtasks: [],
    progress: { done: 0, total: 0 },
    viewDate: task.dueDate,
    viewTime: task.dueTime,
    viewOverdue: task.overdue,
  }
}

export const EMPTY_COUNTS = { status: 200, body: { today: 0, overdue: 0, upcoming: 0, noDue: 0, doneToday: 0 } }
