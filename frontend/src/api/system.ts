import { apiFetch } from './client.ts'

export type SystemInfo = {
  version: string
  buildTime: string | null
  dataDirectory: string
  backupDirectory: string
  /** ログファイル。開発用の起動では null */
  logFile: string | null
}

/** 動いているアプリのバージョン・ビルド日時と、データの保存先 */
export function fetchSystemInfo(): Promise<SystemInfo> {
  return apiFetch('/system')
}
