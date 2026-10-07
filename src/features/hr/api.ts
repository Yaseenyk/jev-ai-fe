import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, apiBlob, apiFetch } from '@/api/client'
import type { Page } from '@/api/types'
import type {
  AppNotification,
  CandidateCreate,
  CandidateDetail,
  CandidateProfile,
  CandidateMatch,
  CandidateStatus,
  CandidateSummary,
  DataHealth,
  EmployeeCreate,
  EmployeeDetail,
  EmployeeResume,
  EmployeeProjectCreate,
  EmployeeSkill,
  EmployeeSummary,
  HealthFilter,
  EmployeeUpdate,
  Extraction,
  HiringRequestDetail,
  HiringRequestSummary,
  HrSummary,
  ImportKind,
  ImportPreview,
  ProjectOption,
  TaskMatch,
  Verdict,
} from '@/features/hr/types'

const qs = (params: Record<string, string | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : ''
}

// --- Overview ---------------------------------------------------------------------------
export const useHrSummary = () =>
  useQuery({ queryKey: ['hr', 'summary'], queryFn: () => apiFetch<HrSummary>('/hr/summary') })

// --- Employees -------------------------------------------------------------------------------
export const useDataHealth = () =>
  useQuery({
    queryKey: ['employees', 'health'],
    queryFn: () => apiFetch<DataHealth>('/employees/health'),
  })

export const useProjects = () =>
  useQuery({ queryKey: ['projects'], queryFn: () => apiFetch<ProjectOption[]>('/projects') })

export const useAddProject = (id: string) =>
  useEmployeeMutation((input: EmployeeProjectCreate) =>
    apiFetch<EmployeeDetail>(`/employees/${id}/projects`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )

export const useRemoveProject = (id: string) =>
  useEmployeeMutation((entryId: string) =>
    apiFetch<EmployeeDetail>(`/employees/${id}/projects/${entryId}`, { method: 'DELETE' }),
  )

export const useConfirmReviewed = (id: string) =>
  useEmployeeMutation(() => apiFetch<EmployeeDetail>(`/employees/${id}/review`, { method: 'POST' }))

export const useEmployees = (filters: {
  q?: string
  level?: string
  location?: string
  health?: HealthFilter
  practice?: string
  sort?: string
  limit?: string
  offset?: string
}) =>
  useQuery({
    queryKey: ['employees', filters],
    queryFn: () => apiFetch<Page<EmployeeSummary>>(`/employees${qs(filters)}`),
    placeholderData: keepPreviousData,
  })

export const useEmployee = (id: string) =>
  useQuery({
    queryKey: ['employees', id],
    queryFn: () => apiFetch<EmployeeDetail>(`/employees/${id}`),
  })

function useEmployeeMutation<T>(fn: (input: T) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export const useCreateEmployee = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: EmployeeCreate) =>
      apiFetch<EmployeeDetail>('/employees', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export const useUpdateEmployee = (id: string) =>
  useEmployeeMutation((input: EmployeeUpdate) =>
    apiFetch<EmployeeDetail>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  )

export const useSaveSkills = (id: string) =>
  useEmployeeMutation((skills: Omit<EmployeeSkill, 'skill_name'>[]) =>
    apiFetch<EmployeeDetail>(`/employees/${id}/skills`, {
      method: 'PUT',
      body: JSON.stringify(skills),
    }),
  )

export const useAddLeave = (id: string) =>
  useEmployeeMutation((leave: { start_date: string; end_date: string }) =>
    apiFetch(`/employees/${id}/leaves`, { method: 'POST', body: JSON.stringify(leave) }),
  )

export const useRemoveLeave = (id: string) =>
  useEmployeeMutation((leaveId: string) =>
    apiFetch<undefined>(`/employees/${id}/leaves/${leaveId}`, { method: 'DELETE' }),
  )

// --- Import ------------------------------------------------------------------------------------
export const usePreviewImport = () =>
  useMutation({
    mutationFn: ({ kind, file }: { kind: ImportKind; file: File }) => {
      const form = new FormData()
      form.set('kind', kind)
      form.set('file', file)
      return apiFetch<ImportPreview>('/imports/preview', { method: 'POST', body: form })
    },
  })

export const useCommitImport = () =>
  useMutation({
    mutationFn: (previewId: string) =>
      apiFetch<{ created: number; updated: number; skipped: number }>(
        `/imports/${previewId}/commit`,
        { method: 'POST' },
      ),
  })

// --- Candidates -------------------------------------------------------------------------------
export const useCandidates = (filters: {
  status?: string
  q?: string
  limit?: string
  offset?: string
}) =>
  useQuery({
    queryKey: ['candidates', filters],
    queryFn: () => apiFetch<Page<CandidateSummary>>(`/candidates${qs(filters)}`),
  })

export const useCandidate = (id: string) =>
  useQuery({
    queryKey: ['candidates', id],
    queryFn: () => apiFetch<CandidateDetail>(`/candidates/${id}`),
  })

export const useCandidateMatches = (id: string) =>
  useQuery({
    queryKey: ['candidates', id, 'matches'],
    queryFn: () => apiFetch<TaskMatch[]>(`/candidates/${id}/matches`),
  })

export const useTaskCandidates = (taskId: string) =>
  useQuery({
    queryKey: ['tasks', taskId, 'candidates'],
    queryFn: () => apiFetch<CandidateMatch[]>(`/tasks/${taskId}/candidates`),
  })

/** Resumes HR uploaded from this task's page, each with its fit (including people who do not fit). */
export const useResumeChecks = (taskId: string, enabled = true) =>
  useQuery({
    queryKey: ['tasks', taskId, 'resume-checks'],
    queryFn: () => apiFetch<CandidateMatch[]>(`/tasks/${taskId}/resume-checks`),
    enabled,
  })

export const useExtractResume = () =>
  useMutation({
    // allowImages: HR agreed that a scanned file's page images (personal details included) go
    // to the LLM; the API refuses a scan without it (code scanned_needs_consent).
    mutationFn: ({ file, allowImages = false }: { file: File; allowImages?: boolean }) => {
      const form = new FormData()
      form.set('file', file)
      if (allowImages) form.set('allow_images', 'true')
      return apiFetch<Extraction>('/candidates/extract', { method: 'POST', body: form })
    },
  })

export function useCreateCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CandidateCreate) =>
      apiFetch<CandidateDetail>('/candidates', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['candidates'] })
      // A new candidate is scored against every task's pool.
      await qc.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'tasks' &&
          (q.queryKey[2] === 'candidates' || q.queryKey[2] === 'resume-checks'),
      })
    },
  })
}

export function useUpdateCandidate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { status?: CandidateStatus; note?: string; profile?: CandidateProfile }) =>
      apiFetch<CandidateDetail>(`/candidates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['candidates'] })
      void qc.invalidateQueries({ queryKey: ['hr'] })
      // The profile (e.g. the pay band) changes which tasks the candidate fits.
      void qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'tasks' && q.queryKey[2] === 'candidates',
      })
    },
  })
}

export function useDeleteCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<undefined>(`/candidates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['candidates'] }),
  })
}

// --- Hiring requests and notifications ----------------------------------------------------------
// Viewers have no requests (the API answers 403), so callers pass `enabled` for them.
export const useHiringRequests = (status?: string, enabled = true) =>
  useQuery({
    queryKey: ['requests', status ?? 'all'],
    queryFn: () => apiFetch<HiringRequestSummary[]>(`/hiring-requests${qs({ status })}`),
    enabled,
  })

export const useHiringRequest = (id: string) =>
  useQuery({
    queryKey: ['requests', 'one', id],
    queryFn: () => apiFetch<HiringRequestDetail>(`/hiring-requests/${id}`),
  })

function useRequestMutation<T>(fn: (input: T) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ['requests', 'notifications', 'candidates', 'hr']) {
        void qc.invalidateQueries({ queryKey: [key] })
      }
    },
  })
}

export const useCreateRequest = (taskId: string) =>
  useRequestMutation((input: { wanted: number; note: string }) =>
    apiFetch<HiringRequestSummary>(`/tasks/${taskId}/hiring-requests`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )

export const useStartRequest = (id: string) =>
  useRequestMutation(() => apiFetch(`/hiring-requests/${id}/start`, { method: 'POST' }))

export const useSendCandidates = (id: string) =>
  useRequestMutation((input: { candidate_ids: string[]; note: string }) =>
    apiFetch(`/hiring-requests/${id}/submissions`, { method: 'POST', body: JSON.stringify(input) }),
  )

export const useDecide = (id: string) =>
  useRequestMutation(
    ({ candidateId, ...input }: { candidateId: string; verdict: Verdict; note: string }) =>
      apiFetch(`/hiring-requests/${id}/submissions/${candidateId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
  )

export const useCloseRequest = (id: string) =>
  useRequestMutation(() => apiFetch(`/hiring-requests/${id}/close`, { method: 'POST' }))

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<AppNotification[]>('/notifications'),
    refetchInterval: 30_000,
  })

export function useReadNotifications() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id?: string) =>
      apiFetch<undefined>(id ? `/notifications/${id}/read` : '/notifications/read-all', {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

/** HR puts an outside candidate in front of the task's manager without being asked. */
export function useSuggest(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { candidate_id: string; note: string }) =>
      apiFetch<HiringRequestDetail>(`/tasks/${taskId}/suggestions`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      for (const key of ['requests', 'notifications', 'candidates', 'hr']) {
        void qc.invalidateQueries({ queryKey: [key] })
      }
      void qc.invalidateQueries({ queryKey: ['tasks', taskId, 'resume-checks'] })
    },
  })
}

/** The resume file as uploaded (HR, or the manager it was sent to). */
export const useResumeFile = (candidateId: string) =>
  useQuery({
    queryKey: ['candidates', candidateId, 'resume'],
    queryFn: () => apiBlob(`/candidates/${candidateId}/resume`),
    retry: false,
    staleTime: Infinity,
  })

// --- Employee resumes (item 6) ---------------------------------------------------------------
export const useEmployeeResume = (employeeId: string) =>
  useQuery({
    queryKey: ['employees', employeeId, 'resume'],
    queryFn: async () => {
      try {
        return await apiFetch<EmployeeResume>(`/employees/${employeeId}/resume`)
      } catch (e) {
        if (e instanceof ApiError && e.problem?.code === 'resume_not_found') return null
        throw e
      }
    },
  })

function useResumeMutation<T>(fn: (input: T) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export const useUploadEmployeeResume = (employeeId: string) =>
  useResumeMutation(({ file, allowImages = false }: { file: File; allowImages?: boolean }) => {
    const form = new FormData()
    form.set('file', file)
    if (allowImages) form.set('allow_images', 'true')
    return apiFetch<EmployeeResume>(`/employees/${employeeId}/resume`, {
      method: 'POST',
      body: form,
    })
  })

export const useResumeSkill = (employeeId: string) =>
  useResumeMutation(({ skillId, action }: { skillId: string; action: 'accept' | 'dismiss' }) =>
    apiFetch<EmployeeResume>(`/employees/${employeeId}/resume/skills/${skillId}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  )

export const useDeleteEmployeeResume = (employeeId: string) =>
  useResumeMutation(() =>
    apiFetch<undefined>(`/employees/${employeeId}/resume`, { method: 'DELETE' }),
  )

export const useEmployeeResumeFile = (employeeId: string, enabled: boolean) =>
  useQuery({
    queryKey: ['employees', employeeId, 'resume', 'file'],
    queryFn: () => apiBlob(`/employees/${employeeId}/resume/file`),
    enabled,
    retry: false,
    staleTime: Infinity,
  })
