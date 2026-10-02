import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { MatchRun, MatchRunCreated, Page, Task } from '@/api/types'
import { isActive, POLL_MS } from '@/features/runs/api'

export interface TaskFilters {
  q: string
  priority: string
  domain: string
}

export const taskKeys = {
  all: ['tasks'] as const,
  list: (f: TaskFilters) => [...taskKeys.all, 'list', f] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
  runs: (id: string) => [...taskKeys.all, 'detail', id, 'runs'] as const,
}

export type TaskView = 'open' | 'closed'

export function useTasks(filters: TaskFilters, view: TaskView = 'open') {
  return useQuery({
    queryKey: [...taskKeys.list(filters), view],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '200' })
      for (const s of view === 'open' ? ['open'] : ['filled', 'cancelled'])
        params.append('status', s)
      for (const key of ['q', 'priority', 'domain'] as const) {
        if (filters[key]) params.set(key, filters[key])
      }
      return apiFetch<Page<Task>>(`/tasks?${params}`)
    },
  })
}

export function useTask(taskId: string, enabled = true) {
  return useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: () => apiFetch<Task>(`/tasks/${taskId}`),
    enabled,
  })
}

export function useTaskRuns(taskId: string) {
  return useQuery({
    queryKey: taskKeys.runs(taskId),
    queryFn: () => apiFetch<Page<MatchRun>>(`/tasks/${taskId}/match-runs`),
    // Keep the list's status badges current while any run is still queued or running.
    refetchInterval: (query) => (query.state.data?.items.some(isActive) ? POLL_MS : false),
  })
}

export function useStartRun(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<MatchRunCreated>(`/tasks/${taskId}/match-runs`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.runs(taskId) }),
  })
}

export function useChangeTaskStatus(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { status: 'filled' | 'cancelled' | 'open'; note: string | null }) =>
      apiFetch<Task>(`/tasks/${taskId}/status`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  })
}
