import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { BusinessUnit, BusinessUnitRef, HeadOption } from '@/api/types'

const UNITS = ['business-units'] as const

/** The unit the signed-in person heads (null when none). */
export function useMyUnit() {
  return useQuery({
    queryKey: [...UNITS, 'mine'],
    queryFn: () => apiFetch<{ unit: BusinessUnitRef | null }>('/business-units/mine'),
    select: (r) => r.unit,
    staleTime: 5 * 60_000,
  })
}

export function useUnits() {
  return useQuery({ queryKey: UNITS, queryFn: () => apiFetch<BusinessUnit[]>('/business-units') })
}

export function useUnitHeads() {
  return useQuery({
    queryKey: [...UNITS, 'heads'],
    queryFn: () => apiFetch<HeadOption[]>('/business-units/heads'),
  })
}

export function useCreateUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { code: string; name: string; head_user_id: string | null }) =>
      apiFetch<BusinessUnit>('/business-units', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: UNITS }),
  })
}

export function useUpdateUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; head_user_id?: string | null }) =>
      apiFetch<BusinessUnit>(`/business-units/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: UNITS }),
  })
}
