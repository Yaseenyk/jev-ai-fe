import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, apiFetch } from '@/api/client'
import type {
  BenchReport,
  HireOrMove,
  RateCard,
  RateCardLine,
  SkillGapReport,
  StaffingPlan,
} from '@/api/types'
import { getAccessToken } from '@/features/auth/session'
import { env } from '@/lib/env'

export function useBench(horizon: number, page: number, size: number) {
  const params = new URLSearchParams({
    horizon_days: String(horizon),
    limit: String(size),
    offset: String((page - 1) * size),
  })
  return useQuery({
    queryKey: ['planning', 'bench', horizon, page, size],
    queryFn: () => apiFetch<BenchReport>(`/planning/bench?${params.toString()}`),
    placeholderData: keepPreviousData,
  })
}

export function useSkillGaps(horizon: number) {
  return useQuery({
    queryKey: ['planning', 'skill-gaps', horizon],
    queryFn: () => apiFetch<SkillGapReport>(`/planning/skill-gaps?horizon_days=${horizon}`),
  })
}

export function useStaffing() {
  return useMutation({
    mutationFn: (taskIds: string[]) =>
      apiFetch<StaffingPlan>('/planning/staffing', {
        method: 'POST',
        body: JSON.stringify({ task_ids: taskIds }),
      }),
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
    mutationFn: (rows: RateCardLine[]) =>
      apiFetch<RateCard>('/admin/rate-card', { method: 'PUT', body: JSON.stringify({ rows }) }),
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
export function useStartRuns() {
  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      let started = 0
      for (const id of taskIds) {
        try {
          await apiFetch(`/tasks/${id}/match-runs`, { method: 'POST' })
          started += 1
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) started += 1
          else if (!(e instanceof ApiError && e.status === 429)) throw e
        }
      }
      return { started, asked: taskIds.length }
    },
  })
}
