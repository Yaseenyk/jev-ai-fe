import { useState } from 'react'
import { Link } from 'react-router'

import type { RunStatus } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Skeleton } from '@/components/ui/skeleton'
import { useAllRuns } from '@/features/admin/api'
import { RunStatusBadge } from '@/features/runs/RunStatusBadge'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const FILTERS: { value: RunStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'running', label: 'Running' },
  { value: 'queued', label: 'Queued' },
  { value: 'failed', label: 'Failed' },
]

export function RunsTab() {
  const [status, setStatus] = useState<RunStatus | ''>('')
  const runs = useAllRuns(status)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => setStatus(f.value)}
            className={cn(
              'h-8 rounded-full border px-3 text-sm',
              status === f.value ? 'bg-foreground text-background' : 'hover:bg-muted',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {runs.isPending ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : runs.isError ? (
        <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
      ) : runs.data.items.length === 0 ? (
        <EmptyState title="No runs yet" />
      ) : (
        <div className="bg-surface overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="text-muted-foreground border-b text-left text-xs">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Ranked</th>
                <th className="px-4 py-3 font-medium">Started by</th>
                <th className="px-4 py-3 text-right font-medium">Time</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Finished</th>
              </tr>
            </thead>
            <tbody>
              {runs.data.items.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40 border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <Link to={`/runs/${r.id}`} className="hover:underline">
                      <span className="text-muted-foreground font-mono text-xs">{r.task_code}</span>{' '}
                      <span className="font-medium">{r.task_title}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <RunStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                    {r.retrieved_count} / {r.candidate_count}
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5">
                    {r.requested_by_email ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                    {(r.latency_ms / 1000).toFixed(1)} s
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                    ${r.total_cost_usd.toFixed(4)}
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                    {r.finished_at ? dateTime(r.finished_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted-foreground border-t px-4 py-2 text-xs">
            Showing {runs.data.items.length} of {runs.data.total} runs, newest first.
          </p>
        </div>
      )}
    </div>
  )
}
