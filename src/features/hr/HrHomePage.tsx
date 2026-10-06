import { ArrowRight, Bell, FileUp, Inbox, Trash2, Upload, UserSearch } from 'lucide-react'
import { Link, Navigate } from 'react-router'

import { ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import { useHiringRequests, useHrSummary } from '@/features/hr/api'
import { CANDIDATE_STATUSES, STATUS_LABELS } from '@/features/hr/types'
import { CandidateStatusBadge, Panel, RequestStatusBadge } from '@/features/hr/ui'
import { dateTime } from '@/lib/format'

export default function HrHomePage() {
  const allowed = useManagesPeople()
  const summary = useHrSummary()
  const requests = useHiringRequests()
  if (!allowed) return <Navigate to="/tasks" replace />
  if (summary.isPending || requests.isPending)
    return <Skeleton className="h-96 w-full rounded-2xl" />
  if (summary.isError) return <ErrorState error={summary.error} />
  if (requests.isError) return <ErrorState error={requests.error} />
  const s = summary.data
  const waiting = requests.data.filter((r) => r.status === 'new' || r.status === 'reviewed')
  const inPipeline = CANDIDATE_STATUSES.filter((st) => st !== 'hired' && st !== 'not_taken').reduce(
    (n, st) => n + (s.candidates_by_status[st] ?? 0),
    0,
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">HR home</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Managers ask here when nobody internal fits. Find candidates, send the best few, and
            contact the ones they choose.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/import">
              <FileUp aria-hidden /> Import data
            </Link>
          </Button>
          <Button asChild>
            <Link to="/candidates/new">
              <Upload aria-hidden /> Upload resume
            </Link>
          </Button>
        </div>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Bell} label="Requests needing you" value={waiting.length} />
        <Stat
          icon={UserSearch}
          label="Open tasks with no internal fit"
          value={s.tasks_without_internal_fit.length}
          hint={`of ${s.open_tasks} open tasks`}
        />
        <Stat icon={Inbox} label="Candidates in progress" value={inPipeline} />
        <Stat
          icon={Trash2}
          label="Due for deletion within 30 days"
          value={s.due_for_deletion_30d}
          hint="1-year rule"
        />
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Requests needing you"
          action={
            <Link to="/hiring-requests" className="text-primary text-sm hover:underline">
              All requests
            </Link>
          }
        >
          {waiting.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing waiting. New requests appear here.
            </p>
          ) : (
            <ul className="divide-y">
              {waiting.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/hiring-requests/${r.id}`}
                    className="hover:bg-accent/40 flex items-center gap-3 rounded-lg px-1 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {r.task_code} · {r.task_title}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {r.status === 'reviewed'
                          ? `${r.fit_count} marked fit — contact them`
                          : `${r.requested_by} wants ${r.wanted} · ${dateTime(r.requested_at)}`}
                      </p>
                    </div>
                    <RequestStatusBadge status={r.status} />
                    <ArrowRight className="text-muted-foreground size-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Open tasks with no internal fit">
          <ul className="divide-y" aria-label="Tasks with no internal fit">
            {s.tasks_without_internal_fit.slice(0, 8).map((t) => (
              <li key={t.task_id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t.code} · {t.title}
                  </p>
                  <p className="text-muted-foreground text-xs">{t.client_code}</p>
                </div>
                <Link
                  to={`/tasks/${t.task_id}/candidates`}
                  className="text-primary shrink-0 text-sm hover:underline"
                >
                  See candidates
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Panel
          title="Recently uploaded"
          action={
            <Link to="/candidates" className="text-primary text-sm hover:underline">
              All candidates
            </Link>
          }
        >
          <ul className="divide-y">
            {s.recent_candidates.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/candidates/${c.id}`}
                  className="hover:bg-accent/40 flex items-center gap-3 rounded-lg px-1 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.full_name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {c.designation} · {c.top_skills.join(', ')}
                    </p>
                  </div>
                  <CandidateStatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Candidates by status">
          <ul className="space-y-1.5 text-sm">
            {CANDIDATE_STATUSES.map((st) => (
              <li key={st} className="flex justify-between">
                <Link to={`/candidates?status=${st}`} className="hover:underline">
                  {STATUS_LABELS[st]}
                </Link>
                <span className="tabular-nums">{s.candidates_by_status[st] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Bell
  label: string
  value: number
  hint?: string
}) {
  return (
    <div className="bg-surface rounded-2xl border p-4">
      <dt className="text-muted-foreground flex items-center gap-2 text-sm">
        <Icon className="size-4" aria-hidden /> {label}
      </dt>
      <dd className="mt-1 text-3xl font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="text-muted-foreground text-xs">{hint}</dd>}
    </div>
  )
}
