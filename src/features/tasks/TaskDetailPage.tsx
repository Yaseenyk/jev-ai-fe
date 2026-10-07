import {
  Check,
  ChevronRight,
  FileUp,
  Loader2,
  MessageCircleQuestion,
  Pencil,
  Play,
  RotateCcw,
  Send,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import type { MatchRun, Task } from '@/api/types'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge, type Tone } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { RunStatusBadge } from '@/features/runs/RunStatusBadge'
import { PriorityBadge, TaskStatusBadge } from '@/features/tasks/PriorityBadge'
import { StartRunway } from '@/features/tasks/StartRunway'
import { useCanEdit, useManagesPeople } from '@/features/auth/AuthProvider'
import { CandidatesFromHr } from '@/features/hr/CandidatesFromHr'
import { useResumeChecks, useSuggest } from '@/features/hr/api'
import type { CandidateMatch, SentState } from '@/features/hr/types'
import { ScoreBar } from '@/features/hr/ui'
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

          {managesPeople && !canEdit && <ResumeChecks taskId={task.id} closed={closed} />}
          {canEdit && !managesPeople && <CandidatesFromHr taskId={task.id} />}

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
              <div className="flex items-center gap-3 px-5 py-4">
                <span className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-full">
                  <Play className="size-4" aria-hidden />
                </span>
                <div className="text-sm">
                  <p className="font-medium">No runs yet</p>
                  <p className="text-muted-foreground">
                    {closed
                      ? 'This task was closed before matching was run.'
                      : canEdit
                        ? 'Click “Run matching” to get people recommended for this task.'
                        : 'The manager runs matching for this task. Their results appear here.'}
                  </p>
                </div>
              </div>
            ) : (
              <ul className="divide-y">
                {runs.data.items.map((r, i) => (
                  <RunRow key={r.id} run={r} latest={i === 0} />
                ))}
              </ul>
            )}
          </section>

          {managesPeople && canEdit && <ResumeChecks taskId={task.id} closed={closed} />}
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

const TONE_BAR: Record<Tone, string> = {
  ready: 'bg-band-shortlist-foreground',
  attention: 'bg-band-review-foreground',
  info: 'bg-primary',
  neutral: 'bg-muted-foreground/40',
  danger: 'bg-destructive',
}

const TONE_NOTE: Record<Tone, string> = {
  ready: 'bg-band-shortlist/40 text-band-shortlist-foreground',
  attention: 'bg-band-review/40 text-band-review-foreground',
  info: 'bg-primary/5 text-primary',
  neutral: 'bg-muted text-muted-foreground',
  danger: 'bg-destructive/5 text-destructive',
}

function fitOf(m: CandidateMatch): { label: string; tone: Tone } {
  if (m.band === 'shortlist') return { label: 'Good fit', tone: 'ready' }
  if (m.band === 'review') return { label: 'Worth a look', tone: 'attention' }
  if (m.score > 0 && (m.blockers ?? []).length === 0) return { label: 'Weak fit', tone: 'neutral' }
  return { label: 'Not a fit', tone: 'danger' }
}

/** Things HR still has to ask the candidate (never a reason to reject). */
const toConfirm = (m: CandidateMatch) =>
  m.reasons.filter((r) => /not confirmed|not entered yet|estimated/i.test(r))

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

/** Outside candidates' resumes HR checked against this task, newest first, with the answer. */
function ResumeChecks({ taskId, closed }: { taskId: string; closed: boolean }) {
  const checks = useResumeChecks(taskId)
  const uploaded = (useLocation().state as { uploaded?: string } | null)?.uploaded
  const count = checks.data?.length ?? 0
  return (
    <section aria-label="Outside candidates for this task" className="bg-surface rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            Outside candidates for this task
            {count > 0 && (
              <span className="bg-muted text-muted-foreground rounded-full px-2 text-xs tabular-nums">
                {count}
              </span>
            )}
          </h2>
          <p className="text-muted-foreground text-xs">
            Resumes checked against this task, newest first, with whether each person fits and why.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/tasks/${taskId}/candidates`}>See all outside candidates</Link>
          </Button>
          {!closed && count > 0 && (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/candidates/new?task=${taskId}`}>
                <FileUp aria-hidden /> Check another resume
              </Link>
            </Button>
          )}
        </div>
      </div>
      {checks.isPending ? (
        <Skeleton className="m-5 h-24" />
      ) : checks.isError ? (
        <div className="p-5">
          <ErrorState error={checks.error} onRetry={() => void checks.refetch()} />
        </div>
      ) : count === 0 ? (
        <div className="p-5">
          {closed ? (
            <p className="text-muted-foreground text-sm">
              No resume was checked for this task before it closed.
            </p>
          ) : (
            <Link
              to={`/candidates/new?task=${taskId}`}
              className="hover:border-primary/50 hover:bg-primary/5 flex items-center gap-4 rounded-xl border border-dashed p-5 transition-colors"
            >
              <span className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-full">
                <FileUp className="size-5" aria-hidden />
              </span>
              <span className="text-sm">
                <span className="block font-medium">No resumes checked yet</span>
                <span className="text-muted-foreground block">
                  Upload a resume to see at once whether the person fits this task, and why.
                </span>
              </span>
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3 p-4" aria-label="Checked resumes">
          {checks.data.map((m) => (
            <CheckCard
              key={m.candidate.id}
              m={m}
              fresh={m.candidate.id === uploaded}
              taskId={taskId}
              closed={closed}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function CheckCard({
  m,
  fresh,
  taskId,
  closed,
}: {
  m: CandidateMatch
  fresh: boolean
  taskId: string
  closed: boolean
}) {
  const [suggesting, setSuggesting] = useState(false)
  const fit = fitOf(m)
  const blockers = m.blockers ?? []
  const ask = toConfirm(m)
  const why =
    blockers.length > 0
      ? blockers
      : fit.tone === 'ready' || fit.tone === 'attention'
        ? [
            `Has ${m.matched_skills.length} of ${m.matched_skills.length + m.missing_skills.length} must-have skills`,
          ]
        : []
  return (
    <li
      aria-label={m.candidate.full_name}
      className={cn(
        'bg-background relative overflow-hidden rounded-xl border pl-4 transition-shadow hover:shadow-sm',
        fresh && 'ring-primary/40 ring-2',
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', TONE_BAR[fit.tone])} aria-hidden />
      <div className="flex flex-wrap items-start gap-4 p-4">
        <span className="bg-muted grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold">
          {initials(m.candidate.full_name)}
        </span>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/candidates/${m.candidate.id}`} className="font-semibold hover:underline">
              {m.candidate.full_name}
            </Link>
            <StatusBadge tone={fit.tone}>{fit.label}</StatusBadge>
            {fresh && <StatusBadge tone="info">Just checked</StatusBadge>}
          </div>
          <p className="text-muted-foreground text-xs">
            {m.candidate.designation} · {levelLabel(m.candidate.level)} ·{' '}
            {locationLabel(m.candidate.location)} · checked {date(m.candidate.uploaded_at)}
          </p>
          {why.map((w) => (
            <p
              key={w}
              className={cn('rounded-lg px-3 py-2 text-sm font-medium', TONE_NOTE[fit.tone])}
            >
              {w}
            </p>
          ))}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground mr-1">Must-have</span>
            {m.matched_skills.map((k) => (
              <span
                key={k}
                className="bg-band-shortlist/40 text-band-shortlist-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              >
                <Check className="size-3" aria-hidden /> {k}
              </span>
            ))}
            {m.missing_skills.map((k) => (
              <span
                key={k}
                className="bg-destructive/5 text-destructive inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              >
                <X className="size-3" aria-hidden /> {k}
              </span>
            ))}
          </div>
          {ask.length > 0 && (
            <p className="text-band-review-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <MessageCircleQuestion className="size-3.5" aria-hidden />
              {ask.map((a) => (
                <span key={a}>{a}</span>
              ))}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {m.score > 0 && <ScoreBar score={m.score} band={m.band} />}
          {m.sent ? (
            <SentBadge sent={m.sent} />
          ) : (
            !closed && (
              <Button size="sm" onClick={() => setSuggesting(true)}>
                <Send aria-hidden /> Suggest to the manager
              </Button>
            )
          )}
          <Button variant="outline" size="sm" asChild>
            <Link to={`/candidates/${m.candidate.id}`}>Open profile</Link>
          </Button>
          {suggesting && (
            <SuggestDialog taskId={taskId} m={m} onClose={() => setSuggesting(false)} />
          )}
        </div>
      </div>
    </li>
  )
}

function SentBadge({ sent }: { sent: SentState }) {
  if (sent === 'fit') return <StatusBadge tone="ready">Manager: fit, contact them</StatusBadge>
  if (sent === 'not_fit') return <StatusBadge tone="neutral">Manager: not a fit</StatusBadge>
  return <StatusBadge tone="info">Sent to the manager</StatusBadge>
}

/** One field, so a dialog: what the manager should know about this person. */
function SuggestDialog({
  taskId,
  m,
  onClose,
}: {
  taskId: string
  m: CandidateMatch
  onClose: () => void
}) {
  const suggest = useSuggest(taskId)
  const [note, setNote] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suggest {m.candidate.full_name} to the manager?</DialogTitle>
          <DialogDescription>
            The task&rsquo;s manager is notified and sees the resume, the profile and the fit on
            this task. They decide; you are told their answer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="suggest-note">Note for the manager (optional)</Label>
          <Textarea
            id="suggest-note"
            placeholder="e.g. Strong Python and Power BI; no BigQuery yet but used Snowflake"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {suggest.isError && <ErrorState error={suggest.error} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={suggest.isPending}
            onClick={() =>
              suggest.mutate({ candidate_id: m.candidate.id, note }, { onSuccess: onClose })
            }
          >
            <Send aria-hidden /> Send to the manager
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
