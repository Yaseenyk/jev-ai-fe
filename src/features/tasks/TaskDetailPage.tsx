import { ChevronRight, FileUp, Loader2, Pencil, Play, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import type { MatchRun, Task } from '@/api/types'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { StatusBadge, type Tone } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RunStatusBadge } from '@/features/runs/RunStatusBadge'
import { PriorityBadge, TaskStatusBadge } from '@/features/tasks/PriorityBadge'
import { StartRunway } from '@/features/tasks/StartRunway'
import { useCanEdit, useManagesPeople } from '@/features/auth/AuthProvider'
import { useResumeChecks } from '@/features/hr/api'
import type { CandidateMatch } from '@/features/hr/types'
import { MatchReasons, ScoreBar } from '@/features/hr/ui'
import { type CloseAs, CloseTaskDialog } from '@/features/tasks/CloseTaskDialog'
import { useChangeTaskStatus, useStartRun, useTask, useTaskRuns } from '@/features/tasks/api'
import { cn } from '@/lib/utils'
import { date, dateTime, domainLabel, humanize, levelLabel, locationLabel } from '@/lib/format'

export default function TaskDetailPage() {
  const { taskId = '' } = useParams()
  const task = useTask(taskId)

  if (task.isPending) return <Skeleton className="h-64 w-full" />
  if (task.isError) return <ErrorState error={task.error} onRetry={() => void task.refetch()} />
  return <TaskDetail task={task.data} />
}

function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="bg-surface rounded-xl border">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function TaskDetail({ task }: { task: Task }) {
  const navigate = useNavigate()
  const runs = useTaskRuns(task.id)
  const start = useStartRun(task.id)
  const canEdit = useCanEdit()
  const managesPeople = useManagesPeople()
  const [closeAs, setCloseAs] = useState<CloseAs | null>(null)
  const [today] = useState(() => new Date())
  const reopen = useChangeTaskStatus(task.id)
  const closed = task.status === 'filled' || task.status === 'cancelled'

  const details: [string, ReactNode][] = [
    ['Priority', <PriorityBadge key="p" priority={task.priority} short />],
    ['Client', task.client_code],
    ['Domain', domainLabel(task.domain)],
    ['Required level', levelLabel(task.required_level)],
    ['Minimum experience', `${task.min_years_experience} years`],
    ['Start date', date(task.start_date)],
    ['Duration', `${task.duration_weeks} weeks`],
    ['Allocation', `${task.allocation_pct_required}%`],
    ['Work mode', humanize(task.work_mode)],
    [
      'Location',
      task.location_constraint.length
        ? task.location_constraint.map(locationLabel).join(', ')
        : 'Any',
    ],
    ['Client timezone', task.client_timezone],
    ['Max cost band', task.max_cost_band],
    ['Client clearance', task.clearance_required ?? 'Not needed'],
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ to: '/tasks', label: 'All tasks' }}
        title={task.title}
        status={<TaskStatusBadge status={task.status} />}
        meta={
          <span className="inline-flex items-center gap-2">
            <span className="font-mono">{task.code}</span>
            <span aria-hidden>·</span>
            <PriorityBadge priority={task.priority} />
          </span>
        }
        description={
          closed
            ? 'This task is closed. Its requirements and past matching runs are kept for reference.'
            : canEdit
              ? 'Run matching to get people recommended for this task. The system only recommends; you decide.'
              : 'The manager runs matching for the company’s own people. Check an outside candidate’s resume against this task to see whether they fit.'
        }
        actions={
          !canEdit ? (
            managesPeople && !closed && <CheckResumeButton taskId={task.id} />
          ) : closed ? (
            <Button
              variant="outline"
              disabled={reopen.isPending}
              onClick={() => reopen.mutate({ status: 'open', note: null })}
            >
              <RotateCcw aria-hidden /> Reopen task
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setCloseAs('cancelled')}
              >
                Cancel task
              </Button>
              <Button variant="outline" onClick={() => setCloseAs('filled')}>
                Mark as filled
              </Button>
              <Button variant="outline" asChild>
                <Link to={`/tasks/${task.id}/edit`}>
                  <Pencil aria-hidden /> Edit task
                </Link>
              </Button>
              <Button
                onClick={() =>
                  start.mutate(undefined, { onSuccess: (r) => void navigate(`/runs/${r.run_id}`) })
                }
                disabled={start.isPending}
              >
                {start.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Play aria-hidden />
                )}
                Run matching
              </Button>
              {managesPeople && <CheckResumeButton taskId={task.id} outline />}
            </>
          )
        }
      />
      {start.isError && <ErrorState error={start.error} />}
      {closed && (
        <div
          role="status"
          className={cn(
            'rounded-xl border px-4 py-3 text-sm',
            task.status === 'filled' ? 'bg-band-shortlist' : 'bg-muted',
          )}
        >
          <span className="font-semibold">
            {task.status === 'filled' ? 'Filled' : 'Cancelled'}.
          </span>{' '}
          This task is closed: it is off the open board and cannot be matched.
          {canEdit && ' Reopen it to match again.'}
        </div>
      )}
      {reopen.isError && <ErrorState error={reopen.error} />}
      <CloseTaskDialog taskId={task.id} as={closeAs} onOpenChange={(o) => !o && setCloseAs(null)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Description">
            <p className="text-sm whitespace-pre-wrap">{task.description}</p>
          </Panel>

          <Panel title="Skills">
            <div className="space-y-4">
              {[true, false].map((must) => {
                const reqs = task.requirements.filter((r) => r.must_have === must)
                return (
                  <div key={String(must)} className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium">
                      {must ? 'Must have' : 'Nice to have'}
                    </p>
                    {reqs.length === 0 ? (
                      <p className="text-muted-foreground text-sm">None</p>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5">
                        {reqs.map((r) => (
                          <li
                            key={r.skill.id}
                            className={cn(
                              'rounded-md border px-2 py-1 text-xs',
                              must ? 'bg-primary/5 border-primary/20' : 'bg-surface',
                            )}
                          >
                            <span className="font-medium">{r.skill.name}</span>
                            <span className="text-muted-foreground">
                              {' '}
                              · level {r.min_proficiency} of 5 or higher
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </Panel>

          <section aria-label="Matching runs" className="bg-surface rounded-xl border">
            <div className="border-b px-5 py-3">
              <h2 className="text-sm font-semibold">Matching runs</h2>
              <p className="text-muted-foreground text-xs">
                Each run ranks the people who fit this task. Open one to review and decide.
              </p>
            </div>
            {runs.isPending ? (
              <Skeleton className="m-5 h-16" />
            ) : runs.isError ? (
              <div className="p-5">
                <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
              </div>
            ) : runs.data.items.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No runs yet">
                  {closed
                    ? 'This task was closed before matching was run.'
                    : canEdit
                      ? 'Click “Run matching” to get people recommended for this task.'
                      : 'The manager runs matching for this task. Their results appear here.'}
                </EmptyState>
              </div>
            ) : (
              <ul className="divide-y">
                {runs.data.items.map((r, i) => (
                  <RunRow key={r.id} run={r} latest={i === 0} />
                ))}
              </ul>
            )}
          </section>

          {managesPeople && <ResumeChecks taskId={task.id} closed={closed} />}
        </div>

        <aside aria-label="Details" className="bg-surface rounded-xl border lg:sticky lg:top-6">
          <h2 className="border-b px-5 py-3 text-sm font-semibold">Details</h2>
          <div className="space-y-4 px-5 py-4">
            {!closed && (
              <StartRunway
                startDate={task.start_date}
                durationWeeks={task.duration_weeks}
                today={today}
              />
            )}
            <dl className="space-y-2.5 text-sm">
              {details.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground shrink-0 text-xs">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
}

function RunRow({ run, latest }: { run: MatchRun; latest: boolean }) {
  return (
    <li>
      <Link
        to={`/runs/${run.id}`}
        className="hover:bg-muted/50 flex items-center gap-4 px-5 py-3 text-sm"
      >
        <RunStatusBadge status={run.status} />
        <span className="flex-1">
          {run.status === 'completed'
            ? `${run.retrieved_count} people ranked out of ${run.candidate_count}`
            : run.status === 'failed'
              ? 'Run failed'
              : 'In progress'}
          {latest && <span className="text-muted-foreground ml-2 text-xs">Latest</span>}
        </span>
        <span className="text-muted-foreground text-xs">
          {run.finished_at
            ? dateTime(run.finished_at)
            : run.started_at
              ? dateTime(run.started_at)
              : ''}
        </span>
        <span className="text-primary inline-flex items-center gap-0.5 text-xs font-medium">
          Open results <ChevronRight className="size-3.5" aria-hidden />
        </span>
      </Link>
    </li>
  )
}

function CheckResumeButton({ taskId, outline = false }: { taskId: string; outline?: boolean }) {
  return (
    <Button variant={outline ? 'outline' : 'default'} asChild>
      <Link to={`/candidates/new?task=${taskId}`}>
        <FileUp aria-hidden /> Check a resume for this task
      </Link>
    </Button>
  )
}

function fitOf(m: CandidateMatch): { label: string; tone: Tone; sentence: string } {
  if (m.band === 'shortlist')
    return { label: 'Good fit', tone: 'ready', sentence: 'is a good fit for this task.' }
  if (m.band === 'review')
    return { label: 'Worth a look', tone: 'attention', sentence: 'is worth a look for this task.' }
  if (m.score > 0)
    return { label: 'Weak fit', tone: 'neutral', sentence: 'is a weak fit for this task.' }
  return { label: 'Not a fit', tone: 'danger', sentence: 'does not fit this task.' }
}

/** Outside candidates' resumes HR checked against this task, newest first, with the answer. */
function ResumeChecks({ taskId, closed }: { taskId: string; closed: boolean }) {
  const checks = useResumeChecks(taskId)
  const uploaded = (useLocation().state as { uploaded?: string } | null)?.uploaded
  const latest = checks.data?.find((m) => m.candidate.id === uploaded)
  return (
    <section aria-label="Resumes checked for this task" className="bg-surface rounded-xl border">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Resumes checked for this task</h2>
          <p className="text-muted-foreground text-xs">
            Outside candidates whose resume was checked from this page, and how well each fits.
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/tasks/${taskId}/candidates`}>See all outside candidates</Link>
        </Button>
      </div>
      {checks.isPending ? (
        <Skeleton className="m-5 h-16" />
      ) : checks.isError ? (
        <div className="p-5">
          <ErrorState error={checks.error} onRetry={() => void checks.refetch()} />
        </div>
      ) : checks.data.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No resumes checked yet">
            {closed
              ? 'No resume was checked for this task before it closed.'
              : 'Use “Check a resume for this task” to upload one and see whether the person fits.'}
          </EmptyState>
        </div>
      ) : (
        <>
          {latest && (
            <div
              role="status"
              className="bg-accent/40 m-5 mb-0 space-y-2 rounded-lg border p-4"
              aria-label="Result of the resume you just checked"
            >
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge tone={fitOf(latest).tone}>{fitOf(latest).label}</StatusBadge>
                <span>
                  <strong>{latest.candidate.full_name}</strong> {fitOf(latest).sentence}
                </span>
              </p>
              <MatchReasons match={latest} />
            </div>
          )}
          <table className="w-full text-sm" aria-label="Checked resumes">
            <thead className="text-muted-foreground text-left text-xs">
              <tr className="border-b">
                <th className="px-5 py-2 font-medium">Candidate</th>
                <th className="px-3 py-2 font-medium">Fit</th>
                <th className="px-3 py-2 font-medium">Must-have skills</th>
                <th className="px-3 py-2 font-medium">Checked</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {checks.data.map((m) => {
                const fit = fitOf(m)
                return (
                  <tr
                    key={m.candidate.id}
                    className={cn(m.candidate.id === uploaded && 'bg-primary/5')}
                  >
                    <td className="px-5 py-2.5 align-top">
                      <div className="font-medium">{m.candidate.full_name}</div>
                      <div className="text-muted-foreground text-xs">
                        {m.candidate.designation} · {levelLabel(m.candidate.level)}
                      </div>
                    </td>
                    <td className="space-y-1 px-3 py-2.5 align-top">
                      <StatusBadge tone={fit.tone}>{fit.label}</StatusBadge>
                      {m.score > 0 && <ScoreBar score={m.score} band={m.band} />}
                    </td>
                    <td className="px-3 py-2.5 align-top text-xs">
                      {m.matched_skills.map((s) => (
                        <span key={s} className="mr-2 inline-block">
                          {s} ✓
                        </span>
                      ))}
                      {m.missing_skills.map((s) => (
                        <span key={s} className="text-destructive mr-2 inline-block">
                          {s} ✗
                        </span>
                      ))}
                    </td>
                    <td className="text-muted-foreground px-3 py-2.5 align-top whitespace-nowrap">
                      {date(m.candidate.uploaded_at)}
                    </td>
                    <td className="px-5 py-2.5 text-right align-top">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/candidates/${m.candidate.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
