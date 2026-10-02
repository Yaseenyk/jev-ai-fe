import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type {
  AdminRun,
  EvalReport,
  EvalReportSummary,
  Page,
  RunStatus,
  ThresholdsHistory,
  ThresholdsUpdate,
} from '@/api/types'

export function useAllRuns(status: RunStatus | '') {
  return useQuery({
    queryKey: ['admin', 'runs', status],
    queryFn: () =>
      apiFetch<Page<AdminRun>>(`/match-runs?limit=100${status ? `&status=${status}` : ''}`),
  })
}

const THRESHOLDS = ['admin', 'thresholds', 'overall_fit'] as const

export function useThresholds() {
  return useQuery({
    queryKey: THRESHOLDS,
    queryFn: () => apiFetch<ThresholdsHistory>('/decisions/overall_fit/thresholds'),
  })
}

export function useUpdateThresholds() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ThresholdsUpdate) =>
      apiFetch<ThresholdsHistory>('/decisions/overall_fit/thresholds', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => qc.setQueryData(THRESHOLDS, data),
  })
}

export function useEvalReports() {
  return useQuery({
    queryKey: ['admin', 'eval'],
    queryFn: () => apiFetch<Page<EvalReportSummary>>('/eval/reports?limit=50'),
  })
}

export function useEvalReport(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'eval', id],
    queryFn: () => apiFetch<EvalReport>(`/eval/reports/${id ?? ''}`),
    enabled: id !== null,
  })
}
