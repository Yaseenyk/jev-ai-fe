import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { Dashboard, DashboardPointers } from '@/api/types'

export const useDashboard = () =>
  useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<Dashboard>('/dashboard'),
    staleTime: 60_000,
  })

/** Loaded on its own: the pointers take longer than the first numbers (ADR 036). */
export const usePointers = () =>
  useQuery({
    queryKey: ['dashboard', 'pointers'],
    queryFn: () => apiFetch<DashboardPointers>('/dashboard/pointers'),
    staleTime: 60_000,
  })
