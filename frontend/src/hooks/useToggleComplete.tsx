import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiRequestError } from '../api/client.ts'
import { changeTaskStatus, restoreTaskStatuses } from '../api/tasks.ts'
import type { Task, TaskStatus } from '../api/types.ts'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { useToast } from '../toast/useToast.ts'
import { useInvalidateTasks } from './useTasks.ts'

type ChangeVariables = { task: Task; status: TaskStatus; completeSubtasks?: boolean }

/**
 * チェックボックスによる完了・未完了の切り替え。
 * - 変更後に「元に戻す」付きのトーストを出す（screen-design 3.1）
 * - 未完了のサブタスクが残る親を完了にしようとしたら D1 を出し、OKなら一括完了する（screen-design 6章）
 *
 * D1 は confirmDialog として返すので、呼び出し側で描画すること。
 */
export function useToggleComplete() {
  const invalidate = useInvalidateTasks()
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState<{ task: Task; count: number } | null>(null)

  const restore = useMutation({
    mutationFn: restoreTaskStatuses,
    onSettled: invalidate,
    onError: () => showToast({ message: '元に戻せませんでした' }),
  })

  const change = useMutation({
    mutationFn: ({ task, status, completeSubtasks }: ChangeVariables) =>
      changeTaskStatus(task.id, status, completeSubtasks),
    onSuccess: ({ changed }, { status }) => {
      if (changed.length === 0) {
        return
      }
      showToast({
        message: status === 'DONE' ? '完了にしました' : '未完了に戻しました',
        action: {
          label: '元に戻す',
          onClick: () => restore.mutate(changed.map((c) => ({ id: c.id, status: c.previousStatus }))),
        },
      })
    },
    onError: (error, { task }) => {
      if (error instanceof ApiRequestError && error.code === 'SUBTASKS_INCOMPLETE') {
        setConfirming({ task, count: error.incompleteCount ?? 0 })
        return
      }
      showToast({ message: 'ステータスを変更できませんでした' })
    },
    onSettled: invalidate,
  })

  const confirmDialog = confirming && (
    <ConfirmDialog
      message={`未完了のサブタスクが${confirming.count}件あります。すべて完了にしますか？`}
      confirmLabel="すべて完了"
      onConfirm={() => {
        change.mutate({ task: confirming.task, status: 'DONE', completeSubtasks: true })
        setConfirming(null)
      }}
      onCancel={() => setConfirming(null)}
    />
  )

  return {
    toggle: (task: Task, done: boolean) => change.mutate({ task, status: done ? 'DONE' : 'TODO' }),
    /** 送信中のタスクと変更先（チェック状態を先に反映するため） */
    pending: change.isPending ? change.variables : undefined,
    confirmDialog,
  }
}

/** 送信中の変更を反映したチェック状態 */
export function isChecked(task: Task, pending: ChangeVariables | undefined): boolean {
  return pending?.task.id === task.id ? pending.status === 'DONE' : task.status === 'DONE'
}
