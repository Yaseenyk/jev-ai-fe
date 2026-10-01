import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { DecisionDefinition, MatchRun } from '@/api/types'

export const POLL_MS = 2000

export const runKeys = {
  all: ['runs'] as const,
  detail: (id: string) => [...runKeys.all, id] as const,
}

export const isActive = (run: MatchRun | undefined) =>
  run?.status === 'queued' || run?.status === 'running'

export function useMatchRun(runId: string) {
  return useQuery({
    queryKey: runKeys.detail(runId),
    queryFn: () => apiFetch<MatchRun>(`/match-runs/${runId}`),
    refetchInterval: (query) => (isActive(query.state.data) ? POLL_MS : false),
  })
}

export function useDecisionDefinitions() {
  return useQuery({
    queryKey: ['decisions'],
    queryFn: () => apiFetch<{ items: DecisionDefinition[] }>('/decisions'),
    select: (d) => d.items,
    staleTime: Infinity,
  })
}
