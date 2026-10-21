import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, apiFetch } from '@/api/client'
import type {
  BenchReport,
  EmployeeValue,
  HireOrMove,
  RateCard,
  RateCardLine,
  SkillGapReport,
} from '@/api/types'
import { getAccessToken } from '@/features/auth/session'
import { env } from '@/lib/env'

export interface BenchFilters {
  q: string
  level: string
  hasFit: string
  sort: string
  descending: boolean
}

export function useBench(horizon: number, page: number, size: number, filters: BenchFilters) {
  const params = new URLSearchParams({
    horizon_days: String(horizon),
    limit: String(size),
    offset: String((page - 1) * size),
    sort: filters.sort,
  })
  if (filters.q.trim()) params.set('q', filters.q.trim())
  if (filters.level) params.set('level', filters.level)
  if (filters.hasFit) params.set('has_fit', filters.hasFit)
  if (filters.descending) params.set('descending', 'true')
  return useQuery({
    queryKey: ['planning', 'bench', horizon, page, size, filters],
    queryFn: () => apiFetch<BenchReport>(`/planning/bench?${params.toString()}`),
    placeholderData: keepPreviousData,
  })
}

export function useEmployeeValue(employeeId: string) {
  return useQuery({
    queryKey: ['planning', 'people', employeeId],
    queryFn: () => apiFetch<EmployeeValue>(`/planning/people/${employeeId}`),
  })
}

export function useSkillGaps(horizon: number) {
  return useQuery({
    queryKey: ['planning', 'skill-gaps', horizon],
    queryFn: () => apiFetch<SkillGapReport>(`/planning/skill-gaps?horizon_days=${horizon}`),
  })
}

export function useHireOrMove(taskId: string) {
  return useQuery({
    queryKey: ['planning', 'hire-or-move', taskId],
    queryFn: () => apiFetch<HireOrMove>(`/tasks/${taskId}/hire-or-move`),
  })
}

const RATE_CARD = ['admin', 'rate-card'] as const

export function useRateCard() {
  return useQuery({ queryKey: RATE_CARD, queryFn: () => apiFetch<RateCard>('/admin/rate-card') })
}

export function useSaveRateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ rows, target }: { rows: RateCardLine[]; target: number }) =>
      apiFetch<RateCard>('/admin/rate-card', {
        method: 'PUT',
        body: JSON.stringify({ rows, margin_target_pct: target }),
      }),
    onSuccess: (data) => qc.setQueryData(RATE_CARD, data),
  })
}

/** Saves the decisions CSV through the browser's normal download. */
export async function downloadAudit(since: string, until: string): Promise<void> {
  const params = new URLSearchParams()
  if (since) params.set('since', since)
  if (until) params.set('until', until)
  const token = getAccessToken()
  const res = await fetch(
    new URL(
      `${env.VITE_API_BASE_URL}/admin/audit/decisions.csv?${params.toString()}`,
      window.location.origin,
    ),
    { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' },
  )
  if (!res.ok) throw new ApiError(res.status, null)
  const name =
    /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'decisions.csv'
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Starts matching for each task; returns how many started (a task already running counts). */
