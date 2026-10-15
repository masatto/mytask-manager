import { apiFetch } from './client.ts'
import type { Pattern, Rule, RuleInput } from './types.ts'

export const ruleKeys = {
  all: ['rules'] as const,
  list: () => ['rules', 'list'] as const,
  detail: (id: number) => ['rules', 'detail', id] as const,
  preview: (input: RulePreviewInput) => ['rules', 'preview', input] as const,
}

export type RulePreviewInput = {
  pattern: Pattern
  startDate: string
  endDate: string | null
}

export function fetchRules(): Promise<{ items: Rule[] }> {
  return apiFetch('/rules')
}

export function fetchRule(id: number): Promise<Rule> {
  return apiFetch(`/rules/${id}`)
}

export function createRule(input: RuleInput): Promise<Rule> {
  return apiFetch('/rules', { method: 'POST', body: JSON.stringify(input) })
}

export function updateRule(id: number, input: RuleInput): Promise<Rule> {
  return apiFetch(`/rules/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function setRuleActive(id: number, active: boolean): Promise<Rule> {
  return apiFetch(`/rules/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) })
}

export function deleteRule(id: number): Promise<void> {
  return apiFetch(`/rules/${id}`, { method: 'DELETE' })
}

export function previewRule(input: RulePreviewInput): Promise<{ occurrences: string[] }> {
  return apiFetch('/rules/preview', { method: 'POST', body: JSON.stringify(input) })
}
