import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, apiFetch } from '@/api/client'
import { getAccessToken } from '@/features/auth/session'
import { env } from '@/lib/env'
import type {
  AdminRun,
  EvalReport,
  EvalReportSummary,
  LearningSummary,
  ModelActivate,
  ModelsList,
  UserAdmin,
  UserCreate,
  UserUpdate,
  UserWithPassword,
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

export function useLearning() {
  return useQuery({
    queryKey: ['admin', 'learning'],
    queryFn: () => apiFetch<LearningSummary>('/admin/learning'),
  })
}

/** Saves the training file (JSON Lines) through the browser's normal download. */
export async function downloadTrainingData(): Promise<void> {
  const token = getAccessToken()
  const res = await fetch(
    new URL(`${env.VITE_API_BASE_URL}/admin/learning/export`, window.location.origin),
    { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' },
  )
  if (!res.ok) throw new ApiError(res.status, null)
  const name =
    /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'feedback.jsonl'
  const url = URL.createObjectURL(await res.blob())
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  link.click()
  URL.revokeObjectURL(url)
}

const MODELS = ['admin', 'models'] as const

export function useModels() {
  return useQuery({ queryKey: MODELS, queryFn: () => apiFetch<ModelsList>('/admin/models') })
}

export function useActivateModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, ...input }: ModelActivate & { name: string }) =>
      apiFetch<ModelsList>(`/admin/models/${encodeURIComponent(name)}/activate`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => qc.setQueryData(MODELS, data),
  })
}

export function useRollbackModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<ModelsList>('/admin/models/rollback', { method: 'POST' }),
    onSuccess: (data) => qc.setQueryData(MODELS, data),
  })
}

const USERS = ['admin', 'users'] as const

export function useUsers() {
  return useQuery({ queryKey: USERS, queryFn: () => apiFetch<UserAdmin[]>('/admin/users') })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UserCreate) =>
      apiFetch<UserWithPassword>('/admin/users', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: UserUpdate & { id: string }) =>
      apiFetch<UserAdmin>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS }),
  })
}

export function useResetPassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<UserWithPassword>(`/admin/users/${id}/reset-password`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS }),
  })
}
