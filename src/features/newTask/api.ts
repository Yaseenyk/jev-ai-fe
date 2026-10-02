import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { Page, Skill, Task, TaskCreate } from '@/api/types'
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
