import { useMutation } from '@tanstack/react-query'
import { updateTask } from '../api/tasks.ts'
import type { Task, TaskUpdateInput } from '../api/types.ts'
import { toDateKey } from '../lib/date.ts'
import { useToast } from '../toast/useToast.ts'
import { useInvalidateTasks } from './useTasks.ts'

/**
 * 期限日だけを変えた更新内容。時刻はそのまま残すが、移した先でその時刻がもう過ぎているなら消す
 * （「今日へ」で 9:00 のタスクを 10:00 に移すと、移した直後から期限切れになってしまうため）。
 */
function withDueDate(task: Task, dueDate: string | null, now = new Date()): TaskUpdateInput {
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const timePassed = dueDate === toDateKey(now) && task.dueTime !== null && task.dueTime <= nowTime
  return {
    title: task.title,
    memo: task.memo,
    dueDate,
    dueTime: dueDate && !timePassed ? task.dueTime : null,
    priority: task.priority,
    status: task.status,
    areaId: task.areaId,
  }
}

/** 元の期限に戻す（元に戻す用。時刻もそのまま戻す） */
function original(task: Task): TaskUpdateInput {
  return { ...withDueDate(task, task.dueDate, new Date(0)), dueTime: task.dueTime }
}

type RescheduleVariables = { tasks: Task[]; dueDate: string; message: string }

/**
 * 一覧から期限を移す（行の「明日へ」、期限切れの「すべて今日へ」）。完了と同じく「元に戻す」付きのトーストを出す。
 *
 * 移すと一覧からその行（やグループ）が消え、最後の1件なら一覧ごと（このフックを使う部品ごと）消える。
 * mutate() に渡すコールバックは部品が消えると呼ばれないので、トーストは useMutation 側で出す。
 */
export function useReschedule() {
  const invalidate = useInvalidateTasks()
  const { showToast } = useToast()

  const undo = useMutation({
    mutationFn: (tasks: Task[]) => Promise.all(tasks.map((t) => updateTask(t.id, original(t)))),
    onSettled: invalidate,
    onError: () => showToast({ message: '元に戻せませんでした' }),
  })

  const reschedule = useMutation({
    mutationFn: ({ tasks, dueDate }: RescheduleVariables) =>
      Promise.all(tasks.map((t) => updateTask(t.id, withDueDate(t, dueDate)))),
    onSuccess: (_updated, { tasks, message }) =>
      showToast({ message, action: { label: '元に戻す', onClick: () => undo.mutate(tasks) } }),
    onError: () => showToast({ message: '期限を変えられませんでした' }),
    onSettled: invalidate,
  })

  return (tasks: Task[], dueDate: string, message: string) => reschedule.mutate({ tasks, dueDate, message })
}
