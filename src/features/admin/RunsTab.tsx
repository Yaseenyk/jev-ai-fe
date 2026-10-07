import { Link } from 'react-router'

import type { AdminRun, RunStatus } from '@/api/types'
import { type Column, DataTable, Pagination } from '@/components/DataTable'
import { Segmented } from '@/components/FilterBar'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge, type Tone } from '@/components/StatusBadge'
import { useUrlState } from '@/components/useUrlState'
import { Skeleton } from '@/components/ui/skeleton'
import { useAllRuns } from '@/features/admin/api'
import { dateTime } from '@/lib/format'

const STATUS: Record<RunStatus, { label: string; tone: Tone }> = {
  completed: { label: 'Completed', tone: 'ready' },
  running: { label: 'Running', tone: 'info' },
  queued: { label: 'Queued', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'running', label: 'Running' },
  { value: 'queued', label: 'Queued' },
  { value: 'failed', label: 'Failed' },
]

const DEFAULTS = { status: '', page: '1', size: '25' }

function cost(usd: number): string {
  if (usd === 0) return 'Free'
  if (usd < 0.01) return '< $0.01'
  return `$${usd.toFixed(2)}`
}

const columns: Column<AdminRun>[] = [
  {
    key: 'task',
    header: 'Task',
    cell: (r) => (
      <div className="min-w-0">
        <Link
          to={`/runs/${r.id}`}
          className="font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {r.task_title}
        </Link>
        <div className="text-muted-foreground text-xs">{r.task_code}</div>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (r) => (
      <div className="space-y-1">
        <StatusBadge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusBadge>
        {r.error && (
          <p className="text-muted-foreground max-w-56 truncate text-xs" title={r.error}>
            {r.error}
          </p>
        )}
      </div>
    ),
  },
  {
    key: 'ranked',
    header: 'Ranked of considered',
    align: 'right',
    cell: (r) => (
      <span className="whitespace-nowrap">
        {r.retrieved_count} <span className="text-muted-foreground">of {r.candidate_count}</span>
      </span>
    ),
  },
  {
    key: 'by',
    header: 'Started by',
    cell: (r) => <span className="text-muted-foreground">{r.requested_by_email ?? '—'}</span>,
  },
  {
    key: 'time',
    header: 'Took',
    align: 'right',
    cell: (r) => <span className="whitespace-nowrap">{(r.latency_ms / 1000).toFixed(1)} s</span>,
  },
  {
    key: 'cost',
    header: 'AI cost',
    align: 'right',
    cell: (r) => (
      <span className="whitespace-nowrap" title={`$${r.total_cost_usd.toFixed(4)}`}>
        {cost(r.total_cost_usd)}
      </span>
    ),
  },
  {
    key: 'finished',
    header: 'Finished',
    cell: (r) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {r.finished_at ? dateTime(r.finished_at) : 'Not yet'}
      </span>
    ),
  },
]

export function RunsTab() {
  const [f, set] = useUrlState(DEFAULTS)
  const page = Math.max(1, Number(f.page) || 1)
  const size = Number(f.size) || 25
  const runs = useAllRuns(f.status as RunStatus | '', size, (page - 1) * size)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Every time someone asked the system for people, newest first. “Ranked of considered” is
          how many people passed the rules and were scored, out of everyone looked at. Open a run to
          see its results.
        </p>
        <Segmented
          label="Filter by status"
          value={f.status}
          onChange={(status) => set({ status })}
          options={FILTERS}
        />
      </div>

      {runs.isPending ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : runs.isError ? (
        <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
      ) : (
        <>
          <DataTable
            label="Matching runs"
            rows={runs.data.items}
            columns={columns}
            rowKey={(r) => r.id}
            rowHref={(r) => `/runs/${r.id}`}
            empty={
              f.status
                ? {
                    title: `No ${FILTERS.find((x) => x.value === f.status)?.label.toLowerCase()} runs`,
                    body: 'Pick “All” to see every run.',
                  }
                : {
                    title: 'No runs yet',
                    body: 'Runs appear here once a manager runs matching on a task.',
                  }
            }
          />
          {runs.data.total > 0 && (
            <Pagination
              total={runs.data.total}
              page={page}
              pageSize={size}
              noun="runs"
              onPage={(p) => set({ page: String(p) })}
              onPageSize={(n) => set({ size: String(n) })}
            />
          )}
        </>
      )}
    </div>
  )
}
