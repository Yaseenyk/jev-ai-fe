import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { ExcludedCandidate, FeedbackInput, Page, ShortlistItem } from '@/api/types'

export const shortlistKeys = {
  items: (runId: string) => ['runs', runId, 'shortlist'] as const,
  excluded: (runId: string) => ['runs', runId, 'excluded'] as const,
}

export function useShortlist(runId: string, enabled: boolean) {
  return useQuery({
    queryKey: shortlistKeys.items(runId),
    queryFn: () =>
      apiFetch<Page<ShortlistItem>>(`/match-runs/${runId}/shortlist?include_hidden=true&limit=200`),
    select: (p) => p.items,
    enabled,
  })
}

export function useExcluded(runId: string, enabled: boolean) {
  return useQuery({
    queryKey: shortlistKeys.excluded(runId),
    queryFn: () => apiFetch<Page<ExcludedCandidate>>(`/match-runs/${runId}/excluded?limit=200`),
    enabled,
  })
}

export function useSubmitFeedback(runId: string) {
  const qc = useQueryClient()
  const key = shortlistKeys.items(runId)
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: FeedbackInput }) =>
      apiFetch<ShortlistItem>(`/shortlist-items/${itemId}/feedback`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onMutate: async ({ itemId, input }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Page<ShortlistItem>>(key)
      qc.setQueryData<Page<ShortlistItem>>(
        key,
        (page) =>
          page && {
            ...page,
            items: page.items.map((i) =>
              i.id === itemId
                ? {
                    ...i,
                    feedback: {
                      action: input.action,
                      reject_reason: input.reject_reason ?? null,
                      comment: input.comment ?? null,
                      by: 'me',
                      at: new Date().toISOString(),
                    },
                  }
                : i,
            ),
          },
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
