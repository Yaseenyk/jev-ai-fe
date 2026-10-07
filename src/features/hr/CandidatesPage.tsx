import { Upload } from 'lucide-react'
import { Link, Navigate } from 'react-router'

import { type Column, DataTable, Pagination } from '@/components/DataTable'
import { FilterBar, Segmented } from '@/components/FilterBar'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { useUrlState } from '@/components/useUrlState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import { useCandidates, useHrSummary } from '@/features/hr/api'
import { CANDIDATE_STATUSES, type CandidateSummary, STATUS_LABELS } from '@/features/hr/types'
import { CandidateStatusBadge, daysUntil } from '@/features/hr/ui'
import { date, levelLabel, locationLabel, percent } from '@/lib/format'

const DEFAULTS = { status: '', q: '', page: '1', size: '25' }

const columns: Column<CandidateSummary>[] = [
  {
    key: 'name',
    header: 'Candidate',
    cell: (c) => (
      <div className="min-w-0">
        <Link
          to={`/candidates/${c.id}`}
          className="font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {c.full_name}
        </Link>
        <div className="text-muted-foreground text-xs">{c.designation}</div>
      </div>
    ),
  },
  {
    key: 'experience',
    header: 'Experience',
    cell: (c) => (
      <div>
        <div>{levelLabel(c.level)}</div>
        <div className="text-muted-foreground text-xs">{c.years_experience} years</div>
      </div>
    ),
  },
  { key: 'location', header: 'Location', cell: (c) => locationLabel(c.location) },
  {
    key: 'skills',
    header: 'Top skills',
    cell: (c) => (
      <span className="text-muted-foreground text-xs">{c.top_skills.join(', ') || '—'}</span>
    ),
  },
  {
    key: 'best',
    header: 'Best open task',
    cell: (c) =>
      c.best_match ? (
        <div>
          <div className="tabular-nums">{percent(c.best_match.score)} fit</div>
          <div className="text-muted-foreground text-xs">{c.best_match.task_code}</div>
        </div>
      ) : (
        <span className="text-muted-foreground text-xs">No open task fits</span>
      ),
  },
  {
    key: 'kept',
    header: 'Kept until',
    cell: (c) => {
      if (!c.delete_after) return <span className="text-muted-foreground text-xs">Hired</span>
      const days = daysUntil(c.delete_after)
      if (days <= 0) return <StatusBadge tone="danger">Past the 1-year limit</StatusBadge>
      return (
        <div>
          <div>{date(c.delete_after)}</div>
          {days <= 30 && <div className="text-destructive text-xs">in {days} days</div>}
        </div>
      )
    },
  },
  { key: 'status', header: 'Status', cell: (c) => <CandidateStatusBadge status={c.status} /> },
]

export default function CandidatesPage() {
  const allowed = useManagesPeople()
  const [f, set] = useUrlState(DEFAULTS)
  const page = Math.max(1, Number(f.page) || 1)
  const size = Number(f.size) || 25
  const candidates = useCandidates({
    status: f.status || undefined,
    q: f.q || undefined,
    limit: String(size),
    offset: String((page - 1) * size),
  })
  const summary = useHrSummary()
  if (!allowed) return <Navigate to="/tasks" replace />

  const counts = summary.data?.candidates_by_status
  const total = counts ? CANDIDATE_STATUSES.reduce((n, s) => n + (counts[s] ?? 0), 0) : undefined
  const chips = [
    ...(f.status
      ? [
          {
            label: `Status: ${(STATUS_LABELS as Record<string, string | undefined>)[f.status] ?? f.status}`,
            onRemove: () => set({ status: '' }),
          },
        ]
      : []),
    ...(f.q ? [{ label: `Search: “${f.q}”`, onRemove: () => set({ q: '' }) }] : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        description="People we do not employ yet. Kept apart from employees, and deleted one year after upload unless hired."
        actions={
          <Button asChild>
            <Link to="/candidates/new">
              <Upload aria-hidden /> Upload resume
            </Link>
          </Button>
        }
      />

      <section aria-label="Candidate list" className="space-y-3">
        <FilterBar
          search={{
            value: f.q,
            onChange: (q) => set({ q }),
            placeholder: 'Name, role or skill',
            label: 'Search candidates',
          }}
          chips={chips}
          onClear={() => set({ status: '', q: '' })}
        />
        <div className="overflow-x-auto">
          <Segmented
            label="Filter by status"
            value={f.status}
            onChange={(status) => set({ status })}
            options={[
              { value: '', label: 'All', count: total },
              ...CANDIDATE_STATUSES.map((s) => ({
                value: s,
                label: STATUS_LABELS[s],
                count: counts ? (counts[s] ?? 0) : undefined,
              })),
            ]}
          />
        </div>

        {candidates.isPending ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : candidates.isError ? (
          <ErrorState error={candidates.error} />
        ) : (
          <>
            <DataTable
              label="Candidates"
              rows={candidates.data.items}
              columns={columns}
              rowKey={(c) => c.id}
              rowHref={(c) => `/candidates/${c.id}`}
              empty={
                chips.length > 0
                  ? { title: 'No candidates match', body: 'Clear the search or the status filter.' }
                  : {
                      title: 'No candidates yet',
                      body: 'Upload a resume from a job site to start the candidate pool.',
                    }
              }
            />
            {candidates.data.total > 0 && (
              <Pagination
                total={candidates.data.total}
                page={page}
                pageSize={size}
                noun="candidates"
                onPage={(p) => set({ page: String(p) })}
                onPageSize={(n) => set({ size: String(n) })}
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}
