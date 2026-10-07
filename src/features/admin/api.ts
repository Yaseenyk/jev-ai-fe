import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, apiFetch } from '@/api/client'
import { getAccessToken } from '@/features/auth/session'
import { env } from '@/lib/env'
import type {
  AdminRun,
  EvalReport,
  ApiProject,
  ApiProjectCreate,
  Company,
  CompanyCreate,
  CompanyCreated,
  DecisionRequest,
  EvalReportSummary,
  NewApiKey,
  FeedbackReport,
  ThemeStatus,
  LearningSummary,
  ModelActivate,
  ModelHealth,
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

export function useAllRuns(status: RunStatus | '', limit = 100, offset = 0) {
  return useQuery({
    queryKey: ['admin', 'runs', status, limit, offset],
    queryFn: () =>
      apiFetch<Page<AdminRun>>(
        `/match-runs?limit=${limit}&offset=${offset}${status ? `&status=${status}` : ''}`,
      ),
    placeholderData: keepPreviousData,
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

export const useApiProjects = () =>
  useQuery({
    queryKey: ['admin', 'api-projects'],
    queryFn: () => apiFetch<ApiProject[]>('/admin/api-projects'),
  })

export const useApiRequests = (projectId: string) =>
  useQuery({
    queryKey: ['admin', 'api-projects', projectId, 'requests'],
    queryFn: () => apiFetch<DecisionRequest[]>(`/admin/api-projects/${projectId}/requests`),
  })

function useApiProjectsMutation<I, O>(fn: (input: I) => Promise<O>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'api-projects'] }),
  })
}

export const useCreateApiProject = () =>
  useApiProjectsMutation((input: ApiProjectCreate) =>
    apiFetch<ApiProject>('/admin/api-projects', { method: 'POST', body: JSON.stringify(input) }),
  )

/** The new key comes back once; it is never shown again. */
export const useCreateApiKey = (projectId: string) =>
  useApiProjectsMutation(() =>
    apiFetch<NewApiKey>(`/admin/api-projects/${projectId}/keys`, { method: 'POST' }),
  )

export const useRevokeApiKey = () =>
  useApiProjectsMutation((keyId: string) =>
    apiFetch<undefined>(`/admin/api-keys/${keyId}/revoke`, { method: 'POST' }),
  )

export const useFeedbackReports = () =>
  useQuery({
    queryKey: ['admin', 'feedback-reports'],
    queryFn: () => apiFetch<FeedbackReport[]>('/admin/feedback-reports'),
  })

/** Makes the report now from the feedback since the last one (one LLM call). */
export function useMakeFeedbackReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<FeedbackReport>('/admin/feedback-reports', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'feedback-reports'] }),
  })
}

export function useSetThemeStatus(reportId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ index, status }: { index: number; status: ThemeStatus }) =>
      apiFetch<FeedbackReport>(`/admin/feedback-reports/${reportId}/themes/${index}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'feedback-reports'] }),
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

const COMPANIES = ['admin', 'companies'] as const

/** Customer companies (ADR 022). Only the operator's admins may list them: anyone else gets 403,
 * which hides the tab. */
export function useCompanies() {
  return useQuery({
    queryKey: COMPANIES,
    queryFn: () => apiFetch<Company[]>('/admin/companies'),
    retry: false,
  })
}

export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CompanyCreate) =>
      apiFetch<CompanyCreated>('/admin/companies', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANIES }),
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

export function useModelHealth() {
  return useQuery({
    queryKey: ['admin', 'health'],
    queryFn: () => apiFetch<ModelHealth>('/admin/health'),
  })
}
