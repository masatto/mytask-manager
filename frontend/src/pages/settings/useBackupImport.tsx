import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { importBackup, restoreAutoBackup, type ImportSummary } from '../../api/backup.ts'
import { ApiRequestError } from '../../api/client.ts'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { useToast } from '../../toast/useToast.ts'

/** D3 で確認待ちの取り込み。source は表示用の名前（ファイル名） */
type PendingImport = { source: string; summary: ImportSummary; apply: () => Promise<void> }

/** 不正なバックアップならサーバーの説明を、それ以外は fallback を出す */
export function backupErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError && error.code === 'INVALID_BACKUP' ? error.message : fallback
}

/**
 * バックアップの取り込み（ファイルからと、自動バックアップからの復元）。どちらも
 * 「検証だけ（dryRun）→ 件数を出して D3 で確認 → 置き換え」の順に進める。
 * 確認ダイアログ（dialog）は呼び出し側で描画する。
 */
export function useBackupImport() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [checking, setChecking] = useState(false)
  const [importing, setImporting] = useState(false)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** 選んだファイルを検証し、問題なければ確認ダイアログを出す */
  const checkFile = async (file: File) => {
    setError(null)
    setChecking(true)
    try {
      const json = await file.text()
      const summary = await importBackup(json, true)
      setPending({ source: file.name, summary, apply: () => importBackup(json, false) })
    } catch (e) {
      setError(backupErrorMessage(e, 'ファイルを確認できませんでした'))
    } finally {
      setChecking(false)
    }
  }

  /** 自動バックアップを検証し、問題なければ確認ダイアログを出す */
  const checkAutoBackup = async (name: string) => {
    try {
      const summary = await restoreAutoBackup(name, true)
      setPending({ source: name, summary, apply: () => restoreAutoBackup(name, false) })
    } catch (e) {
      showToast({ message: backupErrorMessage(e, '自動バックアップを確認できませんでした') })
    }
  }

  const apply = async (target: PendingImport) => {
    setPending(null)
    setImporting(true)
    try {
      await target.apply()
      // すべてのデータが置き換わるので、キャッシュをすべて取り直す
      await queryClient.invalidateQueries()
      showToast({ message: `${target.source} からインポートしました` })
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'インポートに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  const dialog = pending && (
    <ConfirmDialog
      message="現在のデータはすべて置き換えられます。"
      detail={`タスク ${pending.summary.current.tasks}件 → ${pending.summary.incoming.tasks}件 ／ ルール ${pending.summary.current.rules}件 → ${pending.summary.incoming.rules}件`}
      confirmLabel="置き換える"
      danger
      onConfirm={() => apply(pending)}
      onCancel={() => setPending(null)}
    />
  )

  return { checking, importing, error, checkFile, checkAutoBackup, dialog }
}
