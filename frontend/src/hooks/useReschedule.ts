import { useMutation } from '@tanstack/react-query'
import { updateTask } from '../api/tasks.ts'
import type { Task, TaskUpdateInput } from '../api/types.ts'
import { useToast } from '../toast/useToast.ts'
import { useInvalidateTasks } from './useTasks.ts'

/** 期限日だけを変えた更新内容（時刻はそのまま。期限なしにするなら時刻も消す） */
function withDueDate(task: Task, dueDate: string | null): TaskUpdateInput {
  return {
    title: task.title,
    memo: task.memo,
    dueDate,
    dueTime: dueDate ? task.dueTime : null,
    priority: task.priority,
    status: task.status,
  }
}

type RescheduleVariables = { task: Task; dueDate: string | null; label: string }

/**
 * 一覧から期限を延期する（「明日へ」）。完了と同じく「元に戻す」付きのトーストを出す。
 *
 * 延期すると一覧からその行が消え、最後の1件なら一覧ごと（このフックを使う部品ごと）消える。
 * mutate() に渡すコールバックは部品が消えると呼ばれないので、トーストは useMutation 側で出す。
 */
export function useReschedule() {
  const invalidate = useInvalidateTasks()
  const { showToast } = useToast()

  const undo = useMutation({
    mutationFn: (task: Task) => updateTask(task.id, withDueDate(task, task.dueDate)),
    onSettled: invalidate,
    onError: () => showToast({ message: '元に戻せませんでした' }),
  })

  const reschedule = useMutation({
    mutationFn: ({ task, dueDate }: RescheduleVariables) => updateTask(task.id, withDueDate(task, dueDate)),
    onSuccess: (_updated, { task, label }) =>
      showToast({
        message: `「${task.title}」を${label}に延期しました`,
        action: { label: '元に戻す', onClick: () => undo.mutate(task) },
      }),
    onError: () => showToast({ message: '延期できませんでした' }),
    onSettled: invalidate,
  })

  return (task: Task, dueDate: string, label: string) => reschedule.mutate({ task, dueDate, label })
}
