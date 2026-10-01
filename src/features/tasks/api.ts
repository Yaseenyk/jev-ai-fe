import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { MatchRun, MatchRunCreated, Page, Task } from '@/api/types'

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

export function useTasks(filters: TaskFilters) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => {
      const params = new URLSearchParams({ limit: '200' })
      for (const key of ['q', 'priority', 'domain'] as const) {
        if (filters[key]) params.set(key, filters[key])
      }
      return apiFetch<Page<Task>>(`/tasks?${params}`)
    },
  })
}

export function useTask(taskId: string) {
  return useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: () => apiFetch<Task>(`/tasks/${taskId}`),
  })
}

export function useTaskRuns(taskId: string) {
  return useQuery({
    queryKey: taskKeys.runs(taskId),
    queryFn: () => apiFetch<Page<MatchRun>>(`/tasks/${taskId}/match-runs`),
  })
}

export function useStartRun(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<MatchRunCreated>(`/tasks/${taskId}/match-runs`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.runs(taskId) }),
  })
}
