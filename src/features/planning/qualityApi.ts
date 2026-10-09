import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type {
  CareerView,
  ClientRateIn,
  ClientRateLine,
  CostBand,
  DataQuality,
  SkillSuggestion,
} from '@/api/types'

export function useSkillSuggestions(employeeId: string) {
  return useQuery({
    queryKey: ['skill-suggestions', employeeId],
    queryFn: () => apiFetch<SkillSuggestion[]>(`/employees/${employeeId}/skill-suggestions`),
  })
}

export function useDecideSuggestion(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, accept, level }: { id: string; accept: boolean; level?: number }) =>
      apiFetch<undefined>(
        `/employees/${employeeId}/skill-suggestions/${id}/${accept ? 'accept' : 'dismiss'}`,
        {
          method: 'POST',
          body: accept ? JSON.stringify({ proficiency: level ?? 2 }) : undefined,
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['skill-suggestions', employeeId] })
      void qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useCareer(employeeId: string) {
  return useQuery({
    queryKey: ['planning', 'career', employeeId],
    queryFn: () => apiFetch<CareerView>(`/planning/people/${employeeId}/career`),
  })
}

export function useDataQuality() {
  return useQuery({
    queryKey: ['data-quality'],
    queryFn: () => apiFetch<DataQuality>('/data-quality'),
  })
}

export function useRefreshSkills() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ people: number; dates_updated: number; suggestions_added: number }>(
        '/data-quality/refresh-skills',
        { method: 'POST' },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['data-quality'] }),
  })
}

const CLIENT_RATES = ['admin', 'client-rates'] as const

export function useClientRates() {
  return useQuery({
    queryKey: CLIENT_RATES,
    queryFn: () => apiFetch<ClientRateLine[]>('/admin/client-rates'),
  })
}

export function useSaveClientRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ClientRateIn) =>
      apiFetch<ClientRateLine[]>('/admin/client-rates', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => qc.setQueryData(CLIENT_RATES, data),
  })
}

export function useDeleteClientRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ client, band }: { client: string; band: CostBand }) =>
      apiFetch<undefined>(`/admin/client-rates/${client}/${band}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENT_RATES }),
  })
}
