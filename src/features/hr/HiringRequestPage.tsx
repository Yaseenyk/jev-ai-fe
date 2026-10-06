import { ArrowLeft, Check, Loader2, Send, ThumbsDown, ThumbsUp, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import {
  useCloseRequest,
  useDecide,
  useHiringRequest,
  useSendCandidates,
  useStartRequest,
  useTaskCandidates,
} from '@/features/hr/api'
import { type HiringRequestDetail, MAX_SUBMISSIONS, type Submission } from '@/features/hr/types'
import {
  CandidateStatusBadge,
  MatchReasons,
  Panel,
  RequestStatusBadge,
  ScoreBar,
  SkillChip,
} from '@/features/hr/ui'
import { dateTime, levelLabel, locationLabel } from '@/lib/format'

export default function HiringRequestPage() {
  const { requestId = '' } = useParams()
  const request = useHiringRequest(requestId)
  const isHr = useManagesPeople()

  if (request.isPending) return <Skeleton className="h-96 w-full rounded-2xl" />
  if (request.isError) return <ErrorState error={request.error} />
  const r = request.data

  return (
    <div className="space-y-6">
      <Link
        to="/hiring-requests"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> All requests
      </Link>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            Candidates for {r.task_code} · {r.task_title}
          </h1>
          <RequestStatusBadge status={r.status} />
        </div>
        <p className="text-muted-foreground text-sm">
          {r.client_code} · asked by {r.requested_by} on {dateTime(r.requested_at)} · {r.wanted}{' '}
          wanted ·{' '}
          <Link to={`/tasks/${r.task_id}`} className="text-primary hover:underline">
            Open the task
          </Link>
        </p>
        {r.note && <p className="bg-muted/50 rounded-lg px-3 py-2 text-sm">“{r.note}”</p>}
      </header>
      {isHr ? <HrView request={r} /> : <ManagerView request={r} />}
    </div>
  )
}

// --- HR: find candidates, send up to 10, contact the ones marked fit ------------------------------
function HrView({ request: r }: { request: HiringRequestDetail }) {
  const pool = useTaskCandidates(r.task_id)
  const start = useStartRequest(r.id)
  const send = useSendCandidates(r.id)
  const close = useCloseRequest(r.id)
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState('')
  const sentIds = new Set(r.submissions.map((s) => s.candidate.id))
  const room = MAX_SUBMISSIONS - r.submissions.length
  const fit = r.submissions.filter((s) => s.verdict === 'fit')

  const toggle = (id: string) =>
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length < room ? [...p, id] : p,
    )

  return (
    <div className="space-y-4">
      {r.status === 'new' && (
        <div className="bg-band-review/40 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
          <p className="text-sm">
            New request. Let the manager know you are on it, then upload resumes from job sites or
            pick from the candidates below.
          </p>
          <Button onClick={() => start.mutate(undefined)} disabled={start.isPending}>
            Start searching
          </Button>
        </div>
      )}

      {fit.length > 0 && (
        <Panel
          title={`Marked fit by the manager — contact them (${fit.length})`}
          label="Marked fit"
        >
          <ul className="divide-y">
            {fit.map((s) => (
              <li key={s.candidate.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {s.candidate.first_name} · {s.candidate.designation}
                  </p>
                  {s.verdict_note && (
                    <p className="text-muted-foreground text-sm">Manager: “{s.verdict_note}”</p>
                  )}
                </div>
                <Button asChild size="sm">
                  <Link to={`/candidates/${s.candidate.id}`}>Open to contact</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {r.submissions.length > 0 && (
        <Panel
          title={`Sent to the manager (${r.submissions.length} of ${MAX_SUBMISSIONS})`}
          label="Sent to the manager"
        >
          <ul className="divide-y">
            {r.submissions.map((s) => (
              <li key={s.candidate.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Link
                  to={`/candidates/${s.candidate.id}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  {s.candidate.first_name} · {s.candidate.designation}
                </Link>
                <ScoreBar score={s.match.score} band={s.match.band} />
                <VerdictBadge submission={s} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {r.status !== 'closed' && room > 0 && (
        <Panel
          title="Candidates for this task"
          label="Candidates for this task"
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={`/candidates/new?request=${r.id}`}>
                <Upload aria-hidden /> Upload resumes
              </Link>
            </Button>
          }
        >
          {pool.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : pool.isError ? (
            <ErrorState error={pool.error} />
          ) : pool.data.filter((m) => !sentIds.has(m.candidate.id)).length === 0 ? (
            <EmptyState title="Nobody in the pool fits yet">
              Download resumes from job sites and upload them; each is scored against this task.
            </EmptyState>
          ) : (
            <>
              <p className="text-muted-foreground mb-2 text-sm">
                Ranked by fit to this task. Pick up to {room} to send (1–{MAX_SUBMISSIONS} per
                request).
              </p>
              <ul className="divide-y">
                {pool.data
                  .filter((m) => !sentIds.has(m.candidate.id))
                  .map((m) => (
                    <li key={m.candidate.id} className="flex gap-3 py-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-4"
                        checked={picked.includes(m.candidate.id)}
                        disabled={!picked.includes(m.candidate.id) && picked.length >= room}
                        onChange={() => toggle(m.candidate.id)}
                        aria-label={`Pick ${m.candidate.full_name}`}
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/candidates/${m.candidate.id}`}
                            className="font-medium hover:underline"
                          >
                            {m.candidate.full_name}
                          </Link>
                          <span className="text-muted-foreground text-sm">
                            {m.candidate.designation} · {levelLabel(m.candidate.level)} ·{' '}
                            {m.candidate.years_experience} yrs ·{' '}
                            {locationLabel(m.candidate.location)}
                          </span>
                          <CandidateStatusBadge status={m.candidate.status} />
                        </div>
                        <MatchReasons match={m} />
                      </div>
                      <ScoreBar score={m.score} band={m.band} />
                    </li>
                  ))}
              </ul>
              <div className="mt-3 space-y-2 border-t pt-3">
                <Textarea
                  rows={2}
                  placeholder="Note for the manager (optional)"
                  aria-label="Note for the manager"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                {send.isError && <ErrorState error={send.error} />}
                <Button
                  disabled={picked.length === 0 || send.isPending}
                  onClick={() =>
                    send.mutate({ candidate_ids: picked, note }, { onSuccess: () => setPicked([]) })
                  }
                >
                  {send.isPending ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Send aria-hidden />
                  )}
                  Send {picked.length || ''} to the manager
                </Button>
              </div>
            </>
          )}
        </Panel>
      )}

      {r.status !== 'closed' && (
        <Button
          variant="outline"
          onClick={() => close.mutate(undefined)}
          disabled={close.isPending}
        >
          Close request
        </Button>
      )}
    </div>
  )
}

// --- Manager: review what HR sent; mark each fit or not a fit --------------------------------------
function ManagerView({ request: r }: { request: HiringRequestDetail }) {
  if (r.submissions.length === 0) {
    return (
      <EmptyState title={r.status === 'in_progress' ? 'HR is searching' : 'HR has your request'}>
        You will be notified when candidates are sent. Nothing to do until then.
      </EmptyState>
    )
  }
  const open = r.submissions.filter((s) => s.verdict === null).length
  return (
    <div className="space-y-4">
      <p className="text-sm">
        {open
          ? `${open} of ${r.submissions.length} still need your decision. HR contacts the ones you mark fit.`
          : 'All decided. HR has been told and will contact the ones you marked fit.'}
      </p>
      <ul className="grid gap-4 lg:grid-cols-2" aria-label="Candidates sent by HR">
        {r.submissions.map((s) => (
          <SubmissionCard key={s.candidate.id} requestId={r.id} submission={s} />
        ))}
      </ul>
    </div>
  )
}

function SubmissionCard({
  requestId,
  submission: s,
}: {
  requestId: string
  submission: Submission
}) {
  const decide = useDecide(requestId)
  const [note, setNote] = useState('')
  const c = s.candidate
  return (
    <li className="bg-surface space-y-3 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {c.first_name} · {c.designation}
          </p>
          <p className="text-muted-foreground text-sm">
            {levelLabel(c.level)} · {c.years_experience} yrs · {locationLabel(c.location)} · can
            join in {c.notice_days} days
          </p>
        </div>
        <ScoreBar score={s.match.score} band={s.match.band} />
      </div>
      <MatchReasons match={s.match} />
      <p className="flex flex-wrap gap-1">
        {c.profile.skills.slice(0, 8).map((k) => (
          <SkillChip key={k.skill_id}>
            {k.skill_name} {k.proficiency}/5
          </SkillChip>
        ))}
      </p>
      {s.hr_note && <p className="text-muted-foreground text-sm">HR: “{s.hr_note}”</p>}
      {s.verdict ? (
        <div className="flex items-center gap-2 border-t pt-3">
          <VerdictBadge submission={s} />
          {s.verdict_note && (
            <span className="text-muted-foreground text-sm">“{s.verdict_note}”</span>
          )}
        </div>
      ) : (
        <div className="space-y-2 border-t pt-3">
          <Textarea
            rows={2}
            placeholder="Why? (optional, HR sees this)"
            aria-label={`Note about ${c.first_name}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ candidateId: c.id, verdict: 'fit', note })}
            >
              <ThumbsUp aria-hidden /> Fit
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ candidateId: c.id, verdict: 'not_fit', note })}
            >
              <ThumbsDown aria-hidden /> Not a fit
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

function VerdictBadge({ submission: s }: { submission: Submission }) {
  if (s.verdict === 'fit') {
    return (
      <span className="bg-band-shortlist text-band-shortlist-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
        <Check className="size-3" aria-hidden /> Fit
      </span>
    )
  }
  if (s.verdict === 'not_fit') {
    return (
      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
        Not a fit
      </span>
    )
  }
  return (
    <span className="bg-band-review text-band-review-foreground rounded-full px-2 py-0.5 text-xs font-medium">
      Waiting for manager
    </span>
  )
}
