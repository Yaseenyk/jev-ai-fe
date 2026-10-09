import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { Dashboard } from '@/api/types'

export const useDashboard = () =>
  useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<Dashboard>('/dashboard'),
    staleTime: 60_000,
  })
