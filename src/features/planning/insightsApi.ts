import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type {
  ClientProfile,
  FairnessReport,
  Judgement,
  OutcomeProof,
  OutcomeRead,
  OutcomeResult,
  PlanningActionCreate,
  PlanningActionRead,
  RollOffReport,
  WhatIfIn,
  WhatIfResult,
} from '@/api/types'

export function useTaskOutcomes(taskId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['outcomes', taskId],
    queryFn: () => apiFetch<OutcomeRead[]>(`/tasks/${taskId}/outcomes`),
    enabled,
  })
}

export function useAnswerOutcome(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, result }: { id: string; result: OutcomeResult }) =>
      apiFetch<OutcomeRead>(`/outcomes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ result, note: '' }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outcomes', taskId] }),
  })
}

export function useOutcomeProof() {
  return useQuery({
    queryKey: ['admin', 'outcomes'],
    queryFn: () => apiFetch<OutcomeProof>('/admin/outcomes'),
  })
}

export function useFairness(days: number) {
  return useQuery({
    queryKey: ['admin', 'fairness', days],
    queryFn: () => apiFetch<FairnessReport>(`/admin/fairness?days=${days}`),
  })
}

export function useJudgement() {
  return useQuery({
    queryKey: ['admin', 'judgement'],
    queryFn: () => apiFetch<Judgement>('/admin/judgement'),
  })
}

export function useRollOffs(days: number) {
  return useQuery({
    queryKey: ['planning', 'roll-offs', days],
    queryFn: () => apiFetch<RollOffReport>(`/planning/roll-offs?days=${days}`),
  })
}

export function useEmployeeActions(employeeId: string) {
  return useQuery({
    queryKey: ['planning', 'actions', employeeId],
    queryFn: () => apiFetch<PlanningActionRead[]>(`/planning/people/${employeeId}/actions`),
  })
}

export function useCreateAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PlanningActionCreate) =>
      apiFetch<PlanningActionRead>('/planning/actions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning'] }),
  })
}

export function useUpdateAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'done' | 'cancelled' }) =>
      apiFetch<PlanningActionRead>(`/planning/actions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning'] }),
  })
}

export function useWhatIf() {
  return useMutation({
    mutationFn: (input: WhatIfIn) =>
      apiFetch<WhatIfResult>('/planning/what-if', { method: 'POST', body: JSON.stringify(input) }),
  })
}

export function useClientProfile(employeeId: string) {
  return useQuery({
    queryKey: ['planning', 'client-profile', employeeId],
    queryFn: () => apiFetch<ClientProfile>(`/planning/people/${employeeId}/client-profile`),
  })
}
