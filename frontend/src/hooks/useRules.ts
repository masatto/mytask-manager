import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRule,
  deleteRule,
  fetchRule,
  fetchRules,
  previewRule,
  ruleKeys,
  setRuleActive,
  updateRule,
  type RulePreviewInput,
} from '../api/rules.ts'
import { taskKeys } from '../api/tasks.ts'
import type { RuleInput } from '../api/types.ts'

export function useRules() {
  return useQuery({ queryKey: ruleKeys.list(), queryFn: fetchRules })
}

export function useRule(id: number) {
  return useQuery({ queryKey: ruleKeys.detail(id), queryFn: () => fetchRule(id), retry: false })
}

/** 次回の生成予定（入力が揃っていないときは null を渡して問い合わせない） */
export function useRulePreview(input: RulePreviewInput | null) {
  return useQuery({
    queryKey: input ? ruleKeys.preview(input) : ['rules', 'preview', 'none'],
    queryFn: () => previewRule(input!),
    enabled: input !== null,
    // 入力のたびに表示がちらつかないよう、新しい結果が来るまで前の結果を出しておく
    placeholderData: keepPreviousData,
  })
}

/**
 * ルールの変更はタスクにも影響する（作成・再開時に今日の分が生成される、ルール名の表示が変わる）ので、
 * ルールとタスクの両方を再取得する。
 */
function useInvalidateRulesAndTasks() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ruleKeys.all }),
      queryClient.invalidateQueries({ queryKey: taskKeys.all }),
    ])
}

export function useCreateRule() {
  const invalidate = useInvalidateRulesAndTasks()
  return useMutation({ mutationFn: (input: RuleInput) => createRule(input), onSuccess: invalidate })
}

export function useUpdateRule() {
  const invalidate = useInvalidateRulesAndTasks()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: RuleInput }) => updateRule(id, input),
    onSuccess: invalidate,
  })
}

export function useSetRuleActive() {
  const invalidate = useInvalidateRulesAndTasks()
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => setRuleActive(id, active),
    onSuccess: invalidate,
  })
}

export function useDeleteRule() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateRulesAndTasks()
  return useMutation({
    mutationFn: (id: number) => deleteRule(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ruleKeys.detail(id) })
      return invalidate()
    },
  })
}
