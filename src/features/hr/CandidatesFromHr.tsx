import { Download, FileText, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ApiError } from '@/api/client'
import { ErrorState } from '@/components/QueryStates'
import { FeedbackPrompt } from '@/components/FeedbackPrompt'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useDecide, useHiringRequest, useHiringRequests, useResumeFile } from '@/features/hr/api'
import type { HiringRequestDetail, Submission } from '@/features/hr/types'
import { MatchReasons, ScoreBar } from '@/features/hr/ui'
import { date, domainLabel, levelLabel, locationLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

/** On a manager's task page: the outside candidates HR sent or suggested for this task. */
export function CandidatesFromHr({ taskId }: { taskId: string }) {
  const requests = useHiringRequests()
  const open = requests.data?.find(
    (r) => r.task_id === taskId && r.status !== 'closed' && r.sent_count > 0,
  )
  if (!open) return null
  return <FromHrSection requestId={open.id} />
}

function FromHrSection({ requestId }: { requestId: string }) {
  const request = useHiringRequest(requestId)
  const [openId, setOpenId] = useState<string | null>(null)
  if (request.isPending) return <Skeleton className="h-32 w-full rounded-xl" />
  if (request.isError) return <ErrorState error={request.error} />
  const r = request.data
  const waiting = r.submissions.filter((s) => !s.verdict).length
  const opened = r.submissions.find((s) => s.candidate.id === openId)
  return (
    <section
      aria-label="Candidates from HR"
      className="border-primary/30 bg-surface rounded-xl border-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            Candidates from HR
            {waiting > 0 && <StatusBadge tone="attention">{waiting} waiting for you</StatusBadge>}
          </h2>
          <p className="text-muted-foreground text-xs">
            People from outside the company HR found for this task. Open one to read the resume and
            say whether they fit.
          </p>
        </div>
      </div>
      <ul className="space-y-3 p-4" aria-label="Candidates from HR">
        {r.submissions.map((s) => (
          <li key={s.candidate.id}>
            <button
              type="button"
              onClick={() => setOpenId(s.candidate.id)}
              className="hover:border-primary/50 bg-background flex w-full flex-wrap items-center gap-4 rounded-xl border p-4 text-left transition-colors"
            >
              <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold">
                {s.candidate.first_name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {s.candidate.first_name}
                  <VerdictBadge s={s} />
                </span>
                <span className="text-muted-foreground block text-xs">
                  {s.candidate.designation} · {levelLabel(s.candidate.level)} ·{' '}
                  {s.candidate.years_experience} years · {locationLabel(s.candidate.location)}
                </span>
                {s.hr_note && (
                  <span className="mt-1 block text-sm">
                    <span className="text-muted-foreground">HR: </span>
                    {s.hr_note}
                  </span>
                )}
              </span>
              <ScoreBar score={s.match.score} band={s.match.band} />
              <span className="text-primary text-sm font-medium">Open resume</span>
            </button>
          </li>
        ))}
      </ul>
      {opened && <CandidateSheet request={r} submission={opened} onClose={() => setOpenId(null)} />}
    </section>
  )
}

function VerdictBadge({ s }: { s: Submission }) {
  if (s.verdict === 'fit') return <StatusBadge tone="ready">You said: fit</StatusBadge>
  if (s.verdict === 'not_fit') return <StatusBadge tone="neutral">You said: not a fit</StatusBadge>
  return <StatusBadge tone="info">Waiting for you</StatusBadge>
}

/** The resume on the left, the profile, fit and the decision on the right. */
function CandidateSheet({
  request,
  submission: s,
  onClose,
}: {
  request: HiringRequestDetail
  submission: Submission
  onClose: () => void
}) {
  const decide = useDecide(request.id)
  const [note, setNote] = useState(s.verdict_note)
  const p = s.candidate.profile
  const choose = (verdict: 'fit' | 'not_fit') =>
    decide.mutate({ candidateId: s.candidate.id, verdict, note: note.trim() })
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[min(1200px,95vw)]">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
            {s.candidate.first_name} · {s.candidate.designation}
            <VerdictBadge s={s} />
          </SheetTitle>
          <SheetDescription>
            Sent by HR for {request.task_code} · {request.task_title}. The system only recommends;
            you decide.
          </SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_400px]">
          <ResumeViewer candidateId={s.candidate.id} />
          <aside className="space-y-5 overflow-y-auto border-l px-6 py-5">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Fit for this task</h3>
              <ScoreBar score={s.match.score} band={s.match.band} />
              {(s.match.blockers ?? []).map((b) => (
                <p
                  key={b}
                  className="bg-destructive/5 text-destructive rounded-lg px-3 py-2 text-sm"
                >
                  {b}
                </p>
              ))}
              <MatchReasons match={s.match} />
            </section>
            {s.hr_note && (
              <section className="space-y-1">
                <h3 className="text-sm font-semibold">Note from HR</h3>
                <p className="bg-muted rounded-lg px-3 py-2 text-sm">{s.hr_note}</p>
              </section>
            )}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Profile</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Item label="Level" value={levelLabel(p.level)} />
                <Item label="Experience" value={`${p.years_experience} years`} />
                <Item label="Location" value={locationLabel(p.location)} />
                <Item
                  label="Notice period"
                  value={
                    (p.unconfirmed ?? []).includes('notice_days')
                      ? 'Not confirmed yet'
                      : `${p.notice_days} days`
                  }
                />
                <Item label="Domains" value={p.domains.map(domainLabel).join(', ') || '—'} />
                <Item label="Education" value={p.education.join(', ') || '—'} />
              </dl>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[...p.skills]
                  .sort((a, b) => b.proficiency - a.proficiency)
                  .map((k) => (
                    <span key={k.skill_id} className="bg-muted rounded-full px-2 py-0.5 text-xs">
                      {k.skill_name} · {k.proficiency}/5
                    </span>
                  ))}
              </div>
              {p.summary && <p className="text-muted-foreground text-sm">{p.summary}</p>}
            </section>
            <section className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-semibold">Your decision</h3>
              {s.decided_at && (
                <p className="text-muted-foreground text-xs">Decided {date(s.decided_at)}</p>
              )}
              <Textarea
                aria-label="Note for HR"
                placeholder="Optional note for HR, e.g. what to ask in the interview"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {decide.isError && <ErrorState error={decide.error} />}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className={cn('flex-1', s.verdict === 'not_fit' && 'border-foreground')}
                  disabled={decide.isPending}
                  onClick={() => choose('not_fit')}
                >
                  <ThumbsDown aria-hidden /> Not a fit
                </Button>
                <Button
                  className="flex-1"
                  disabled={decide.isPending}
                  onClick={() => choose('fit')}
                >
                  {decide.isPending ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <ThumbsUp aria-hidden />
                  )}
                  Fit, HR can contact them
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                HR is told at once. A fit means HR contacts the candidate; nobody is hired
                automatically.
              </p>
            </section>
            <FeedbackPrompt
              area="candidate_fit"
              targetId={s.candidate.id}
              question="Was this suggestion from HR useful?"
            />
          </aside>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/** The uploaded file: PDFs open inline; a Word file is offered as a download. */
function ResumeViewer({ candidateId }: { candidateId: string }) {
  const file = useResumeFile(candidateId)
  const url = useMemo(() => (file.data ? URL.createObjectURL(file.data) : null), [file.data])
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )

  const frame = 'bg-muted/40 flex min-h-[60vh] items-center justify-center p-6 lg:min-h-0'
  if (file.isPending) {
    return (
      <div className={frame}>
        <Loader2 className="text-muted-foreground animate-spin" aria-label="Loading the resume" />
      </div>
    )
  }
  if (file.isError) {
    const missing =
      file.error instanceof ApiError && file.error.problem?.code === 'resume_not_found'
    return (
      <div className={frame}>
        <p className="text-muted-foreground max-w-sm text-center text-sm">
          <FileText className="mx-auto mb-2 size-8" aria-hidden />
          {missing
            ? 'No resume file is kept for this candidate. The profile on the right is what HR checked.'
            : 'The resume could not be loaded. Try again in a moment.'}
        </p>
      </div>
    )
  }
  if (!url) return <div className={frame} />
  if (file.data.type === 'application/pdf') {
    return <iframe title="Resume" src={url} className="h-[70vh] w-full lg:h-full" />
  }
  return (
    <div className={frame}>
      <div className="space-y-3 text-center text-sm">
        <FileText className="text-muted-foreground mx-auto size-10" aria-hidden />
        <p>This resume is a Word file, which the browser cannot show here.</p>
        <Button asChild>
          <a href={url} download="resume.docx">
            <Download aria-hidden /> Download the resume
          </a>
        </Button>
      </div>
    </div>
  )
}
