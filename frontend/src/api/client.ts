export type FieldError = { field: string; message: string }

/** api-design 1章の共通エラーレスポンスを表す例外 */
export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: FieldError[]
  /** SUBTASKS_INCOMPLETE のときの未完了サブタスク数 */
  readonly incompleteCount: number | undefined

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors: FieldError[] = [],
    incompleteCount?: number,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
    this.incompleteCount = incompleteCount
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiRequestError(
      response.status,
      body?.code ?? 'INTERNAL_ERROR',
      body?.message ?? '通信に失敗しました',
      body?.fieldErrors ?? [],
      body?.incompleteCount,
    )
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}
