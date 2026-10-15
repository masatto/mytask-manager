import { apiFetch, ApiRequestError } from './client.ts'

export type ImportSummary = {
  current: { tasks: number; rules: number }
  incoming: { tasks: number; rules: number }
}

/** GET /api/backup。ファイル名はサーバーの Content-Disposition に従う */
export async function exportBackup(): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch('/api/backup')
  if (!response.ok) {
    throw new ApiRequestError(response.status, 'INTERNAL_ERROR', 'エクスポートに失敗しました')
  }
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'mytask-manager-backup.json'
  return { blob: await response.blob(), filename }
}

/** ファイルの中身をそのまま送る。形式のチェックはサーバーで行う（api-design 6.2） */
export function importBackup(json: string, dryRun: true): Promise<ImportSummary>
export function importBackup(json: string, dryRun: false): Promise<void>
export function importBackup(json: string, dryRun: boolean): Promise<ImportSummary | void> {
  return apiFetch(`/backup/import?dryRun=${dryRun}`, { method: 'POST', body: json })
}
