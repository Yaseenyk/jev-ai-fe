import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { InterpretResponse, MatchRunCreated, Page, Skill, Task, TaskCreate } from '@/api/types'
import { taskKeys } from '@/features/tasks/api'

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: () => apiFetch<Page<Skill>>('/skills?limit=200'),
    select: (p) => p.items,
    staleTime: Infinity,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskCreate) =>
      apiFetch<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

export function useInterpret() {
  return useMutation({
    mutationFn: (input: { text: string; known_clients: string[] }) =>
      apiFetch<InterpretResponse>('/tasks/interpret', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  })
}

export function useUpdateTask(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskCreate) =>
      apiFetch<Task>(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

export function useInterpretFile() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return apiFetch<InterpretResponse>('/tasks/interpret-file', { method: 'POST', body: form })
    },
  })
}

export function useStartMatch() {
  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch<MatchRunCreated>(`/tasks/${taskId}/match-runs`, { method: 'POST' }),
  })
}
