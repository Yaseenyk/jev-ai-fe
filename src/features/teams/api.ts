import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { LeadOptions, MemberOptions, Team, TeamCandidate, TeamSave } from '@/api/types'

const TEAMS = ['teams'] as const

/** `poll` while a matching run started from the builder is running, until it has finished. */
export const useLeadOptions = (taskId: string, poll = false) =>
  useQuery({
    queryKey: ['team-builder', taskId, 'leads'],
    queryFn: () => apiFetch<LeadOptions>(`/tasks/${taskId}/team/leads`),
    enabled: Boolean(taskId),
    refetchInterval: (q) => (poll && !q.state.data?.run_id ? 3000 : false),
  })

export const useMemberOptions = (taskId: string, leadId: string, runId: string | null) =>
  useQuery({
    queryKey: ['team-builder', taskId, 'members', leadId, runId],
    queryFn: () => apiFetch<MemberOptions>(`/tasks/${taskId}/team/members?lead_id=${leadId}`),
    enabled: Boolean(taskId && leadId && runId),
  })

export const useShadowOptions = (taskId: string, teamIds: string[], enabled: boolean) =>
  useQuery({
    queryKey: ['team-builder', taskId, 'shadows', teamIds],
    queryFn: () =>
      apiFetch<TeamCandidate[]>(
        `/tasks/${taskId}/team/shadows?${teamIds.map((id) => `team_ids=${id}`).join('&')}`,
      ),
    enabled: Boolean(taskId) && enabled,
  })

export const useTeams = (taskId?: string) =>
  useQuery({
    queryKey: [...TEAMS, taskId ?? 'all'],
    queryFn: () => apiFetch<Team[]>(taskId ? `/teams?task_id=${taskId}` : '/teams'),
  })

export const useTeam = (teamId: string) =>
  useQuery({
    queryKey: [...TEAMS, 'one', teamId],
    queryFn: () => apiFetch<Team>(`/teams/${teamId}`),
  })

export function useSaveTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TeamSave) =>
      apiFetch<Team>('/teams', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEAMS }),
  })
}

export function useDeleteTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (teamId: string) => apiFetch<undefined>(`/teams/${teamId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEAMS }),
  })
}
