import { useQuery } from '@tanstack/react-query'
import { backupKeys, fetchAutoBackupStatus } from '../api/backup.ts'
import { fetchSystemInfo, systemKeys } from '../api/system.ts'

/** 自動バックアップの状態（保存済みのファイル・コピー先）。設定画面の複数のカードで共有する */
export function useAutoBackupStatus() {
  return useQuery({ queryKey: backupKeys.auto, queryFn: fetchAutoBackupStatus })
}

/** 動いているアプリのバージョン・保存先。起動中は変わらないので取り直さない */
export function useSystemInfo() {
  return useQuery({ queryKey: systemKeys.info, queryFn: fetchSystemInfo, refetchInterval: false })
}
