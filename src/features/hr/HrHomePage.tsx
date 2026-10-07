import {
  ArrowRight,
  Bell,
  FileUp,
  Inbox,
  PhoneCall,
  Trash2,
  Upload,
  UserSearch,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link, Navigate } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import { useHiringRequests, useHrSummary } from '@/features/hr/api'
import { CANDIDATE_STATUSES, STATUS_LABELS } from '@/features/hr/types'
import { CandidateStatusBadge, Panel, RequestStatusBadge } from '@/features/hr/ui'
import { date, dateTime } from '@/lib/format'

const TASKS_SHOWN = 6

export default function HrHomePage() {
  const [showAllTasks, setShowAllTasks] = useState(false)
  const allowed = useManagesPeople()
  const summary = useHrSummary()
  const requests = useHiringRequests()
  if (!allowed) return <Navigate to="/tasks" replace />

  const header = (
    <PageHeader
      title="HR home"
      description="Managers ask here when nobody internal fits a task. Find candidates, send the best few, and contact the ones they choose."
      actions={
        <>
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
        </>
      }
    />
  )
  if (summary.isPending || requests.isPending)
    return (
      <div className="space-y-6">
        {header}
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  if (summary.isError) return <ErrorState error={summary.error} />
  if (requests.isError) return <ErrorState error={requests.error} />
  const s = summary.data
  const waiting = requests.data.filter((r) => r.status === 'new' || r.status === 'reviewed')
  const withRequest = new Set(
    requests.data.filter((r) => r.status !== 'closed').map((r) => r.task_id),
  )
  const unasked = s.tasks_without_internal_fit.filter((t) => !withRequest.has(t.task_id))
  const inPipeline = CANDIDATE_STATUSES.filter((st) => st !== 'hired' && st !== 'not_taken').reduce(
    (n, st) => n + (s.candidates_by_status[st] ?? 0),
    0,
  )
  const totalCandidates = CANDIDATE_STATUSES.reduce(
    (n, st) => n + (s.candidates_by_status[st] ?? 0),
    0,
  )
  const attention =
    waiting.length + (unasked.length > 0 ? 1 : 0) + (s.due_for_deletion_30d > 0 ? 1 : 0)
  const noFit = showAllTasks
    ? s.tasks_without_internal_fit
    : s.tasks_without_internal_fit.slice(0, TASKS_SHOWN)

  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Bell}
          label="Requests needing you"
          value={waiting.length}
          meaning="New requests to start, and candidates managers marked fit."
          to="/hiring-requests?status=needs_you"
          action="Open these requests"
        />
        <Kpi
          icon={UserSearch}
          label="Tasks with no internal fit"
          value={s.tasks_without_internal_fit.length}
          meaning={`Of ${s.open_tasks} open tasks, nobody internal is a good match.`}
          to="#no-internal-fit"
          action="See the tasks"
        />
        <Kpi
          icon={Inbox}
          label="Candidates in progress"
          value={inPipeline}
          meaning="New, screened, contacted or interviewing."
          to="/candidates"
          action="Open candidates"
        />
        <Kpi
          icon={Trash2}
          label="Deleted within 30 days"
          value={s.due_for_deletion_30d}
          meaning="Resumes reach the 1-year limit unless the person is hired."
          to="/candidates"
          action="Review candidates"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel
          title={`Needs your attention (${attention})`}
          label="Needs your attention"
          action={
            <Link to="/hiring-requests" className="text-primary text-sm hover:underline">
              All requests
            </Link>
          }
        >
          {attention === 0 ? (
            <p className="text-muted-foreground text-sm">
              You are all caught up. New requests from managers appear here.
            </p>
          ) : (
            <ul className="-my-2 divide-y">
              {waiting.map((r) => (
                <AttentionRow
                  key={r.id}
                  icon={r.status === 'reviewed' ? PhoneCall : Bell}
                  title={`${r.task_code} · ${r.task_title}`}
                  detail={
                    r.status === 'reviewed'
                      ? `The manager marked ${r.fit_count} fit. Contact them.`
                      : `${r.requested_by} wants ${r.wanted} candidates · asked ${dateTime(r.requested_at)}`
                  }
                  badge={<RequestStatusBadge status={r.status} />}
                  to={`/hiring-requests/${r.id}`}
                  action={r.status === 'reviewed' ? 'Contact candidates' : 'Open request'}
                />
              ))}
              {unasked.length > 0 && (
                <AttentionRow
                  icon={UserSearch}
                  title={`${unasked.length} open ${unasked.length === 1 ? 'task has' : 'tasks have'} no internal fit and no request yet`}
                  detail="Check the candidate pool before a manager asks, so you are ready."
                  to="#no-internal-fit"
                  action="See the tasks"
                />
              )}
              {s.due_for_deletion_30d > 0 && (
                <AttentionRow
                  icon={Trash2}
                  title={`${s.due_for_deletion_30d} ${s.due_for_deletion_30d === 1 ? 'candidate is' : 'candidates are'} deleted within 30 days`}
                  detail="Hire them, or let the 1-year rule remove their resume."
                  to="/candidates"
                  action="Review candidates"
                />
              )}
            </ul>
          )}
        </Panel>

        <Panel title="Candidates by status">
          <ul className="space-y-2.5 text-sm">
            {CANDIDATE_STATUSES.map((st) => {
              const n = s.candidates_by_status[st] ?? 0
              return (
                <li key={st}>
                  <Link to={`/candidates?status=${st}`} className="group block">
                    <span className="flex justify-between">
                      <span className="group-hover:underline">{STATUS_LABELS[st]}</span>
                      <span className="tabular-nums">{n}</span>
                    </span>
                    <span
                      className="bg-muted mt-1 block h-1.5 overflow-hidden rounded-full"
                      aria-hidden
                    >
                      <span
                        className="bg-primary/60 block h-full"
                        style={{ width: `${totalCandidates ? (n / totalCandidates) * 100 : 0}%` }}
                      />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel
          id="no-internal-fit"
          title={`Open tasks with no internal fit (${s.tasks_without_internal_fit.length})`}
          label="Open tasks with no internal fit"
        >
          {s.tasks_without_internal_fit.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Every open task has someone internal who fits.
            </p>
          ) : (
            <ul className="-my-2 divide-y" aria-label="Tasks with no internal fit">
              {noFit.map((t) => (
                <li key={t.task_id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t.code} · {t.title}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t.client_code}
                      {withRequest.has(t.task_id) && ' · the manager has asked HR'}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/tasks/${t.task_id}/candidates`}>See candidates</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {s.tasks_without_internal_fit.length > TASKS_SHOWN && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 -mb-1"
              onClick={() => setShowAllTasks((v) => !v)}
            >
              {showAllTasks
                ? 'Show fewer'
                : `Show all ${s.tasks_without_internal_fit.length} tasks`}
            </Button>
          )}
        </Panel>

        <Panel
          title="Recently uploaded"
          action={
            <Link to="/candidates" className="text-primary text-sm hover:underline">
              All candidates
            </Link>
          }
        >
          {s.recent_candidates.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No resumes yet. Upload one to start the candidate pool.
            </p>
          ) : (
            <ul className="-my-2 divide-y">
              {s.recent_candidates.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/candidates/${c.id}`}
                    className="hover:bg-accent/40 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.full_name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {c.designation} · {c.top_skills.join(', ')}
                      </p>
                    </div>
                    <span className="text-muted-foreground hidden text-xs sm:inline">
                      {date(c.uploaded_at)}
                    </span>
                    <CandidateStatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  meaning,
  to,
  action,
}: {
  icon: typeof Bell
  label: string
  value: number
  meaning: string
  to: string
  action: string
}) {
  const body = (
    <>
      <span className="text-muted-foreground flex items-center gap-2 text-sm">
        <Icon className="size-4" aria-hidden /> {label}
      </span>
      <span className="mt-1 block text-3xl font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground mt-1 block flex-1 text-xs">{meaning}</span>
      <span className="text-primary mt-3 inline-flex items-center gap-1 text-xs font-medium">
        {action} <ArrowRight className="size-3" aria-hidden />
      </span>
    </>
  )
  const className =
    'bg-surface hover:border-primary/40 flex h-full flex-col rounded-xl border p-4 transition-colors'
  return to.startsWith('#') ? (
    <a href={to} className={className}>
      {body}
    </a>
  ) : (
    <Link to={to} className={className}>
      {body}
    </Link>
  )
}

function AttentionRow({
  icon: Icon,
  title,
  detail,
  badge,
  to,
  action,
}: {
  icon: typeof Bell
  title: string
  detail: string
  badge?: ReactNode
  to: string
  action: string
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
        <Icon className="text-muted-foreground size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-muted-foreground truncate text-xs">{detail}</p>
      </div>
      {badge}
      <Button asChild variant="outline" size="sm" className="shrink-0">
        {to.startsWith('#') ? <a href={to}>{action}</a> : <Link to={to}>{action}</Link>}
      </Button>
    </li>
  )
}
