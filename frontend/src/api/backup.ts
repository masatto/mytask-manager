import { apiFetch, ApiRequestError } from './client.ts'

export const backupKeys = {
  /** 自動バックアップの状態（保存済みのファイル・コピー先） */
  auto: ['backup', 'auto'] as const,
}

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
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'orbit-backup.json'
  return { blob: await response.blob(), filename }
}

/** ファイルの中身をそのまま送る。形式のチェックはサーバーで行う（api-design 6.2） */
export function importBackup(json: string, dryRun: true): Promise<ImportSummary>
export function importBackup(json: string, dryRun: false): Promise<void>
export function importBackup(json: string, dryRun: boolean): Promise<ImportSummary | void> {
  return apiFetch(`/backup/import?dryRun=${dryRun}`, { method: 'POST', body: json })
}

export type AutoBackupStatus = {
  directory: string
  keep: number
  files: { name: string; size: number; createdAt: string | null }[]
  /** コピー先（OneDrive などの同期フォルダー）。未設定なら null */
  mirrorDirectory: string | null
  /** 直近のコピーの失敗理由。成功していれば null */
  mirrorError: string | null
  /** コピー先にある自動バックアップ（新しい順） */
  mirrorFiles: { name: string; size: number; createdAt: string | null }[]
}

/** 自動バックアップのコピー先を設定する（null で解除） */
export function setBackupMirror(mirrorDirectory: string | null): Promise<AutoBackupStatus> {
  return apiFetch('/backup/auto/mirror', { method: 'PUT', body: JSON.stringify({ mirrorDirectory }) })
}

/** 今すぐ自動バックアップを保存する（今日の分があっても作り直す） */
export function runBackupNow(): Promise<AutoBackupStatus> {
  return apiFetch('/backup/auto/run', { method: 'POST' })
}

/** 自動バックアップの保存先と保存済みファイル（新しい順） */
export function fetchAutoBackupStatus(): Promise<AutoBackupStatus> {
  return apiFetch('/backup/auto')
}

/** 自動バックアップのファイルから復元する（dryRun なら検証と件数の確認だけ） */
export function restoreAutoBackup(name: string, dryRun: true): Promise<ImportSummary>
export function restoreAutoBackup(name: string, dryRun: false): Promise<void>
export function restoreAutoBackup(name: string, dryRun: boolean): Promise<ImportSummary | void> {
  return apiFetch(`/backup/auto/${encodeURIComponent(name)}/import?dryRun=${dryRun}`, { method: 'POST' })
}
