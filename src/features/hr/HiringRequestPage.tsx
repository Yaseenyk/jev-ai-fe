import { Check, Loader2, Send, ThumbsDown, ThumbsUp, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import {
  type CandidateMatch,
  type HiringRequestDetail,
  MAX_SUBMISSIONS,
  type Submission,
} from '@/features/hr/types'
import {
  CandidateStatusBadge,
  DetailList,
  MatchReasons,
  Panel,
  RequestStatusBadge,
  ScoreBar,
  SkillChip,
} from '@/features/hr/ui'
import { BAND_LABELS, dateTime, levelLabel, locationLabel, percent } from '@/lib/format'

export default function HiringRequestPage() {
  const { requestId = '' } = useParams()
  const request = useHiringRequest(requestId)
  const isHr = useManagesPeople()
  const start = useStartRequest(requestId)
  const close = useCloseRequest(requestId)
  const back = isHr
    ? { to: '/hiring-requests', label: 'All requests' }
    : { to: '/hiring-requests', label: 'My requests' }

  if (request.isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (request.isError) return <ErrorState error={request.error} />
  const r = request.data

  return (
    <div className="space-y-6">
      <PageHeader
        back={back}
        title={`${r.task_code} · ${r.task_title}`}
        status={<RequestStatusBadge status={r.status} />}
        description={
          isHr
            ? 'Find external candidates for this task and send the best few to the manager. Contact the ones they mark fit.'
            : 'Candidates HR found for your task. Mark each one fit or not a fit; HR contacts the fit ones.'
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/tasks/${r.task_id}`}>Open the task</Link>
            </Button>
            {isHr && r.status !== 'closed' && (
              <Button
                variant="outline"
                onClick={() => close.mutate(undefined)}
                disabled={close.isPending}
              >
                Close request
              </Button>
            )}
            {isHr && r.status === 'new' && (
              <Button onClick={() => start.mutate(undefined)} disabled={start.isPending}>
                Start searching
              </Button>
            )}
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          {isHr ? <HrView request={r} /> : <ManagerView request={r} />}
        </div>
        <aside className="space-y-4">
          <Panel title="Details">
            <DetailList
              items={[
                { label: 'Client', value: r.client_code },
                { label: 'Asked by', value: r.requested_by },
                { label: 'Asked on', value: dateTime(r.requested_at) },
                { label: 'Wanted', value: `${r.wanted} candidates` },
                { label: 'Sent', value: `${r.sent_count} of ${MAX_SUBMISSIONS} at most` },
                { label: 'Marked fit', value: r.fit_count },
              ]}
            />
          </Panel>
          {r.note && (
            <Panel title="Note from the manager">
              <p className="text-sm">“{r.note}”</p>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  )
}

// --- HR: find candidates, send up to 10, contact the ones marked fit ------------------------------
function HrView({ request: r }: { request: HiringRequestDetail }) {
  const pool = useTaskCandidates(r.task_id)
  const send = useSendCandidates(r.id)
  // Set when HR comes back from uploading a resume for this request.
  const uploaded = (useLocation().state as { uploaded?: string } | null)?.uploaded
  const [picked, setPicked] = useState<string[]>(uploaded ? [uploaded] : [])
  const [note, setNote] = useState('')
  const sentIds = new Set(r.submissions.map((s) => s.candidate.id))
  const room = MAX_SUBMISSIONS - r.submissions.length
  const fit = r.submissions.filter((s) => s.verdict === 'fit')

  const toggle = (id: string) =>
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length < room ? [...p, id] : p,
    )

  return (
    <>
      {r.status === 'new' && (
        <Alert>
          <AlertTitle>New request</AlertTitle>
          <AlertDescription>
            Choose “Start searching” so the manager knows you are on it. Then upload resumes from
            job sites, or pick from the candidates below.
          </AlertDescription>
        </Alert>
      )}

      {fit.length > 0 && (
        <Panel title={`Marked fit by the manager: contact them (${fit.length})`} label="Marked fit">
          <ul className="-my-2 divide-y">
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
          <ul className="-my-2 divide-y">
            {r.submissions.map((s) => (
              <li key={s.candidate.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Link
                  to={`/candidates/${s.candidate.id}`}
                  className="min-w-0 flex-1 text-sm font-medium hover:underline"
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
              {uploaded && (
                <UploadedFit match={pool.data.find((m) => m.candidate.id === uploaded)} />
              )}
              <p className="text-muted-foreground mb-1 text-sm">
                Ranked by fit to this task. Tick up to {room} to send (1–{MAX_SUBMISSIONS} per
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
                          <CandidateStatusBadge status={m.candidate.status} />
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {m.candidate.designation} · {levelLabel(m.candidate.level)} ·{' '}
                          {m.candidate.years_experience} yrs · {locationLabel(m.candidate.location)}
                        </p>
                        <MatchReasons match={m} />
                      </div>
                      <ScoreBar score={m.score} band={m.band} />
                    </li>
                  ))}
              </ul>
              <div className="bg-surface sticky bottom-0 -mx-4 -mb-4 space-y-3 rounded-b-xl border-t px-4 py-4">
                <Textarea
                  rows={2}
                  placeholder="Note for the manager (optional), e.g. both can join within a month"
                  aria-label="Note for the manager"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                {send.isError && <ErrorState error={send.error} />}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-muted-foreground text-sm">
                    {picked.length === 0
                      ? 'Tick at least one candidate to send.'
                      : `${picked.length} of ${room} picked`}
                  </span>
                  <Button
                    disabled={picked.length === 0 || send.isPending}
                    onClick={() =>
                      send.mutate(
                        { candidate_ids: picked, note },
                        { onSuccess: () => setPicked([]) },
                      )
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
              </div>
            </>
          )}
        </Panel>
      )}
    </>
  )
}

/** "Is the resume HR just uploaded a fit for this task?" */
function UploadedFit({ match }: { match: CandidateMatch | undefined }) {
  if (!match) {
    return (
      <Alert className="mb-3">
        <AlertTitle>The uploaded resume does not fit this task</AlertTitle>
        <AlertDescription>
          It misses the must-have skills or the location. The candidate stays in the pool for other
          tasks.
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert className="mb-3">
      <Check />
      <AlertTitle>
        {match.candidate.full_name} fits this task: {percent(match.score)} ·{' '}
        {BAND_LABELS[match.band]}
      </AlertTitle>
      <AlertDescription>
        {match.matched_skills.length > 0 && <>Has {match.matched_skills.join(', ')}. </>}
        Ticked below, ready to send to the manager.
      </AlertDescription>
    </Alert>
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
    <>
      <p className="text-sm">
        {open
          ? `${open} of ${r.submissions.length} still need your decision. HR contacts the ones you mark fit.`
          : 'All decided. HR has been told and will contact the ones you marked fit.'}
      </p>
      <ul className="space-y-4" aria-label="Candidates sent by HR">
        {r.submissions.map((s) => (
          <SubmissionCard key={s.candidate.id} requestId={r.id} submission={s} />
        ))}
      </ul>
    </>
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
    <li className="bg-surface space-y-3 rounded-xl border p-4">
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
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ candidateId: c.id, verdict: 'not_fit', note })}
            >
              <ThumbsDown aria-hidden /> Not a fit
            </Button>
            <Button
              size="sm"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ candidateId: c.id, verdict: 'fit', note })}
            >
              <ThumbsUp aria-hidden /> Fit
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
      <StatusBadge tone="ready">
        <Check className="size-3" aria-hidden /> Fit
      </StatusBadge>
    )
  }
  if (s.verdict === 'not_fit') return <StatusBadge tone="neutral">Not a fit</StatusBadge>
  return <StatusBadge tone="attention">Waiting for manager</StatusBadge>
}
