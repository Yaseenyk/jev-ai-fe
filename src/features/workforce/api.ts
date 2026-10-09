import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type {
  AssignmentRead,
  CapacityReport,
  CourseIn,
  CourseRead,
  DealIn,
  DealRead,
  DealStatus,
  DemandForecast,
  Digest,
  InterpretedSearch,
  InterviewPlan,
  KeyPersonReport,
  LearningOverview,
  LearningStatus,
  MyProfile,
  OpportunityReport,
  PeopleFilters,
  PeopleSearchResult,
  PreferencesIn,
  PreferencesRead,
  RfpDrafts,
  SavingsReport,
  SetupStatus,
  TeamIn,
  TeamPlan,
  WorkingOn,
} from '@/api/types'

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })

export const useKeyPersonRisk = () =>
  useQuery({
    queryKey: ['planning', 'key-person-risk'],
    queryFn: () => apiFetch<KeyPersonReport>('/planning/key-person-risk'),
  })

export const useOpportunity = () =>
  useQuery({
    queryKey: ['planning', 'opportunity'],
    queryFn: () => apiFetch<OpportunityReport>('/planning/opportunity'),
  })

export const useCapacity = (months: number) =>
  useQuery({
    queryKey: ['planning', 'capacity', months],
    queryFn: () => apiFetch<CapacityReport>(`/planning/capacity?months=${months}`),
  })

export const useBuildTeam = () =>
  useMutation({
    mutationFn: (body: TeamIn) => apiFetch<TeamPlan>('/planning/team', post(body)),
  })

export const useInterpretSearch = () =>
  useMutation({
    mutationFn: (q: string) => apiFetch<InterpretedSearch>('/people-search/interpret', post({ q })),
  })

export const useSearchPeople = () =>
  useMutation({
    mutationFn: (f: PeopleFilters) => apiFetch<PeopleSearchResult>('/people-search', post(f)),
  })

export const useRfpDrafts = () =>
  useMutation({
    mutationFn: (text: string) => apiFetch<RfpDrafts>('/tasks/from-request', post({ text })),
  })

export const useInterview = (candidateId: string) =>
  useMutation({
    mutationFn: (taskId: string) =>
      apiFetch<InterviewPlan>(
        `/candidates/${candidateId}/interview-questions`,
        post({ task_id: taskId }),
      ),
  })

const PREFS = (id: string) => ['employees', id, 'preferences']

export const usePreferences = (employeeId: string) =>
  useQuery({
    queryKey: PREFS(employeeId),
    queryFn: () => apiFetch<PreferencesRead | null>(`/employees/${employeeId}/preferences`),
  })

export function useSavePreferences(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PreferencesIn) =>
      apiFetch<PreferencesRead>(`/employees/${employeeId}/preferences`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => qc.setQueryData(PREFS(employeeId), data),
  })
}

export function useClearPreferences(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<undefined>(`/employees/${employeeId}/preferences`, { method: 'DELETE' }),
    onSuccess: () => qc.setQueryData(PREFS(employeeId), null),
  })
}

export const useCourses = () =>
  useQuery({ queryKey: ['courses'], queryFn: () => apiFetch<CourseRead[]>('/courses') })

export function useAddCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CourseIn) => apiFetch<CourseRead>('/courses', post(body)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['courses'] }),
  })
}

export const useLearningOverview = () =>
  useQuery({ queryKey: ['learning'], queryFn: () => apiFetch<LearningOverview>('/learning') })

export const useEmployeeLearning = (employeeId: string) =>
  useQuery({
    queryKey: ['learning', employeeId],
    queryFn: () => apiFetch<AssignmentRead[]>(`/employees/${employeeId}/learning`),
  })

export function useAssignCourse(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { course_id: string; due_date: string | null }) =>
      apiFetch<AssignmentRead>(`/employees/${employeeId}/learning`, post(body)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['learning'] })
      void qc.invalidateQueries({ queryKey: ['courses'] })
    },
  })
}

export function useUpdateAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LearningStatus }) =>
      apiFetch<AssignmentRead>(`/learning/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['learning'] })
      void qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

// --- ADR 032 ---------------------------------------------------------------------------------
export function useDeleteCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<undefined>(`/courses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['courses'] })
      void qc.invalidateQueries({ queryKey: ['learning'] })
    },
  })
}

export const useDeals = () =>
  useQuery({ queryKey: ['deals'], queryFn: () => apiFetch<DealRead[]>('/planning/deals') })

export const useDemand = () =>
  useQuery({
    queryKey: ['deals', 'demand'],
    queryFn: () => apiFetch<DemandForecast>('/planning/demand'),
  })

export function useAddDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DealIn) => apiFetch<DealRead>('/planning/deals', post(body)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['deals'] }),
  })
}

export function useUpdateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; win_pct?: number; status?: DealStatus }) =>
      apiFetch<DealRead>(`/planning/deals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['deals'] }),
  })
}

export function useDeleteDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<undefined>(`/planning/deals/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['deals'] }),
  })
}

export const useWorkingOn = (employeeId: string) =>
  useQuery({
    queryKey: ['employees', employeeId, 'working-on'],
    queryFn: () => apiFetch<WorkingOn>(`/employees/${employeeId}/working-on`),
  })

export const useSavings = (month: string) =>
  useQuery({
    queryKey: ['reports', 'savings', month],
    queryFn: () => apiFetch<SavingsReport>(`/reports/savings?month=${month}`),
  })

export const useSetup = () =>
  useQuery({ queryKey: ['setup'], queryFn: () => apiFetch<SetupStatus>('/setup') })

export const useDigest = () =>
  useQuery({ queryKey: ['me', 'digest'], queryFn: () => apiFetch<Digest>('/me/digest') })

export const useMyProfile = () =>
  useQuery({ queryKey: ['me', 'profile'], queryFn: () => apiFetch<MyProfile>('/me/profile') })

export function useRequestSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { skill_id: string; proficiency: number }) =>
      apiFetch<undefined>('/me/skill-requests', post(body)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me', 'profile'] }),
  })
}

export function useSaveMyPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PreferencesIn) =>
      apiFetch<PreferencesRead>('/me/preferences', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me', 'profile'] }),
  })
}
