import { useSearchParams } from 'react-router'

/**
 * List state (filters, sort, page) kept in the URL, so a view can be shared and survives a
 * refresh (docs/04 §6a). Setting a filter or the sort goes back to the first page.
 */
export function useUrlState<K extends string>(defaults: Record<K, string>) {
  const [params, setParams] = useSearchParams()
  const values = Object.fromEntries(
    (Object.keys(defaults) as K[]).map((k) => [k, params.get(k) ?? defaults[k]]),
  ) as Record<K, string>
  const set = (changes: Partial<Record<K, string>>, keepPage = false) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(changes) as [K, string | undefined][]) {
          if (v === undefined || v === '' || v === defaults[k]) p.delete(k)
          else p.set(k, v)
        }
        if (!keepPage && !('page' in changes)) p.delete('page')
        return p
      },
      { replace: true },
    )
  return [values, set] as const
}
