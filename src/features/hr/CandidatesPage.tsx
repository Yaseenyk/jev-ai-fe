import { Search, Upload } from 'lucide-react'
import { Link, Navigate, useSearchParams } from 'react-router'

import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import { useCandidates } from '@/features/hr/api'
import { CANDIDATE_STATUSES, STATUS_LABELS } from '@/features/hr/types'
import { CandidateStatusBadge, daysUntil } from '@/features/hr/ui'
import { date, levelLabel, locationLabel, percent } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function CandidatesPage() {
  const allowed = useManagesPeople()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const q = params.get('q') ?? ''
  const candidates = useCandidates({ status: status || undefined, q: q || undefined })
  if (!allowed) return <Navigate to="/tasks" replace />

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">Candidates</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            People we do not employ yet. Never mixed with employees; deleted one year after upload
            unless hired.
          </p>
        </div>
        <Button asChild>
          <Link to="/candidates/new">
            <Upload aria-hidden /> Upload resume
          </Link>
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder="Name, role or skill"
            aria-label="Search candidates"
            value={q}
            onChange={(e) => set('q', e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {(['', ...CANDIDATE_STATUSES] as const).map((s) => (
            <button
              key={s || 'all'}
              type="button"
              aria-pressed={status === s}
              onClick={() => set('status', s)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm',
                status === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-accent/50',
              )}
            >
              {s ? STATUS_LABELS[s] : 'All'}
            </button>
          ))}
        </div>
      </div>

      {candidates.isPending ? (
        <Skeleton className="h-80 w-full rounded-2xl" />
      ) : candidates.isError ? (
        <ErrorState error={candidates.error} />
      ) : candidates.data.items.length === 0 ? (
        <EmptyState title="No candidates match">Upload resumes, or clear the filters.</EmptyState>
      ) : (
        <ul className="divide-y rounded-2xl border" aria-label="Candidates">
          {candidates.data.items.map((c) => {
            const days = c.delete_after ? daysUntil(c.delete_after) : null
            return (
              <li key={c.id}>
                <Link
                  to={`/candidates/${c.id}`}
                  className="hover:bg-accent/40 flex flex-wrap items-center gap-3 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.full_name}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {c.designation} · {levelLabel(c.level)} · {c.years_experience} yrs ·{' '}
                      {locationLabel(c.location)} · {c.top_skills.join(', ')}
                    </p>
                  </div>
                  {c.best_match ? (
                    <span className="text-muted-foreground text-sm">
                      Best: {c.best_match.task_code} · {percent(c.best_match.score)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">No open task fits</span>
                  )}
                  {days !== null && days <= 30 && (
                    <span className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-xs font-medium">
                      {days <= 0
                        ? 'Past the 1-year limit'
                        : `Deletes on ${date(c.delete_after ?? '')}`}
                    </span>
                  )}
                  <CandidateStatusBadge status={c.status} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
