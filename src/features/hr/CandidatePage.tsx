import { ArrowLeft, Mail, Phone, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'

import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import {
  useCandidate,
  useCandidateMatches,
  useDeleteCandidate,
  useUpdateCandidate,
} from '@/features/hr/api'
import { CANDIDATE_STATUSES, type CandidateStatus, STATUS_LABELS } from '@/features/hr/types'
import {
  CandidateStatusBadge,
  MatchReasons,
  Panel,
  ScoreBar,
  SkillChip,
  daysUntil,
} from '@/features/hr/ui'
import { date, dateTime, domainLabel, levelLabel, locationLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function CandidatePage() {
  const { candidateId = '' } = useParams()
  const allowed = useManagesPeople()
  const candidate = useCandidate(candidateId)
  const matches = useCandidateMatches(candidateId)
  const update = useUpdateCandidate(candidateId)
  const remove = useDeleteCandidate()
  const navigate = useNavigate()
  const [moving, setMoving] = useState<CandidateStatus | null>(null)
  const [deleting, setDeleting] = useState(false)
  if (!allowed) return <Navigate to="/tasks" replace />
  if (candidate.isPending) return <Skeleton className="h-96 w-full rounded-2xl" />
  if (candidate.isError) return <ErrorState error={candidate.error} />
  const c = candidate.data
  const days = c.delete_after ? daysUntil(c.delete_after) : null
  const step = CANDIDATE_STATUSES.indexOf(c.status)

  return (
    <div className="space-y-6">
      <Link
        to="/candidates"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> All candidates
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{c.full_name}</h1>
            <CandidateStatusBadge status={c.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {c.designation} · {levelLabel(c.level)} · {c.years_experience} yrs ·{' '}
            {locationLabel(c.location)} · can join in {c.profile.notice_days} days · via {c.source}
          </p>
        </div>
        <Button variant="outline" onClick={() => setDeleting(true)}>
          <Trash2 aria-hidden /> Delete
        </Button>
      </header>

      <ol className="flex flex-wrap gap-1.5" aria-label="Status">
        {CANDIDATE_STATUSES.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              disabled={s === c.status}
              onClick={() => setMoving(s)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm',
                s === c.status
                  ? 'bg-primary text-primary-foreground border-primary'
                  : i < step
                    ? 'bg-accent/60'
                    : 'hover:bg-accent/50',
              )}
            >
              {STATUS_LABELS[s]}
            </button>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Panel title="Open tasks this candidate fits" label="Open tasks this candidate fits">
            {matches.isPending ? (
              <Skeleton className="h-32 w-full" />
            ) : matches.isError ? (
              <ErrorState error={matches.error} />
            ) : matches.data.length === 0 ? (
              <EmptyState title="No open task fits right now">
                Kept in the pool: new tasks are checked against everyone here.
              </EmptyState>
            ) : (
              <ul className="divide-y">
                {matches.data.map((m) => (
                  <li key={m.task_id} className="flex gap-3 py-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Link to={`/tasks/${m.task_id}`} className="font-medium hover:underline">
                        {m.task_code} · {m.title}
                      </Link>
                      <p className="text-muted-foreground text-xs">{m.client_code}</p>
                      <MatchReasons match={m} />
                    </div>
                    <ScoreBar score={m.score} band={m.band} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Profile (read from the resume, checked by HR)">
            <p className="text-sm">{c.profile.summary}</p>
            <p className="mt-3 flex flex-wrap gap-1">
              {c.profile.skills.map((k) => (
                <SkillChip key={k.skill_id}>
                  {k.skill_name} {k.proficiency}/5 · {k.years}y
                </SkillChip>
              ))}
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Domains</dt>
                <dd>{c.profile.domains.map(domainLabel).join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Education</dt>
                <dd>{c.profile.education.join(', ') || '—'}</dd>
              </div>
            </dl>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Contact (HR only)">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="text-muted-foreground size-4" aria-hidden /> {c.email ?? '—'}
              </li>
              <li className="flex items-center gap-2">
                <Phone className="text-muted-foreground size-4" aria-hidden /> {c.phone ?? '—'}
              </li>
            </ul>
            <p className="text-muted-foreground mt-2 text-xs">
              Never sent to ChatGPT; managers do not see it.
            </p>
          </Panel>
          <Panel title="Consent and retention">
            <p className="flex items-start gap-2 text-sm">
              <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
              Consent recorded by {c.consent_recorded_by} on {date(c.consent_at)}.
            </p>
            <p className={cn('mt-2 text-sm', days !== null && days <= 30 && 'text-destructive')}>
              {c.delete_after
                ? days !== null && days <= 0
                  ? 'Past the 1-year limit: delete now.'
                  : `Deleted automatically on ${date(c.delete_after)} (1 year after upload).`
                : 'Hired: kept.'}
            </p>
          </Panel>
          <Panel title="History">
            <ol className="space-y-2 text-sm">
              {c.history.map((h) => (
                <li key={h.at + h.status} className="border-l-2 pl-3">
                  <p className="font-medium">{STATUS_LABELS[h.status]}</p>
                  {h.note && <p className="text-muted-foreground">{h.note}</p>}
                  <p className="text-muted-foreground text-xs">
                    {h.by} · {dateTime(h.at)}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      {moving && (
        <MoveDialog
          to={moving}
          name={c.full_name}
          pending={update.isPending}
          onClose={() => setMoving(null)}
          onConfirm={(note) =>
            update.mutate({ status: moving, note }, { onSuccess: () => setMoving(null) })
          }
        />
      )}
      {deleting && (
        <Dialog open onOpenChange={(open) => !open && setDeleting(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {c.full_name}?</DialogTitle>
              <DialogDescription>
                The resume and profile are removed for good. The deletion is recorded in the audit
                log.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(c.id, { onSuccess: () => void navigate('/candidates') })
                }
              >
                Delete for good
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function MoveDialog({
  to,
  name,
  pending,
  onClose,
  onConfirm,
}: {
  to: CandidateStatus
  name: string
  pending: boolean
  onClose: () => void
  onConfirm: (note: string) => void
}) {
  const [note, setNote] = useState('')
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Move {name} to “{STATUS_LABELS[to]}”?
          </DialogTitle>
          <DialogDescription>
            {to === 'hired'
              ? 'Hired candidates are kept beyond the 1-year limit.'
              : 'Recorded in the history.'}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={3}
          placeholder="Note, e.g. called on 6 Oct, interview Friday"
          aria-label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => onConfirm(note)}>
            Move to {STATUS_LABELS[to]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
