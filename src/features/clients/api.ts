import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { Client, ClientCreate, ClientUpdate } from '@/api/types'

const CLIENTS = ['clients'] as const

export function useClients() {
  return useQuery({ queryKey: CLIENTS, queryFn: () => apiFetch<Client[]>('/clients') })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ClientCreate) =>
      apiFetch<Client>('/clients', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS }),
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ code, ...input }: ClientUpdate & { code: string }) =>
      apiFetch<Client>(`/clients/${encodeURIComponent(code)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS }),
  })
}
