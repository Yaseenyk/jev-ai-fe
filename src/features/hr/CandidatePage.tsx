import { Check, Mail, Phone, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  DetailList,
  MatchReasons,
  Panel,
  ScoreBar,
  SkillChip,
  daysUntil,
} from '@/features/hr/ui'
import { date, dateTime, domainLabel, levelLabel, locationLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

const NOT_KNOWN = 'none'
const COST_BANDS = ['A', 'B', 'C', 'D', 'E']

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
  if (candidate.isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (candidate.isError) return <ErrorState error={candidate.error} />
  const c = candidate.data
  const days = c.delete_after ? daysUntil(c.delete_after) : null
  const step = CANDIDATE_STATUSES.indexOf(c.status)

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ to: '/candidates', label: 'All candidates' }}
        title={c.full_name}
        status={<CandidateStatusBadge status={c.status} />}
        meta={`${c.designation} · ${levelLabel(c.level)} · ${c.years_experience} yrs · ${locationLabel(c.location)}`}
        description="An external candidate. Move them through the steps below as you screen, contact and interview them."
        actions={
          <Button variant="outline" onClick={() => setDeleting(true)}>
            <Trash2 aria-hidden /> Delete
          </Button>
        }
      />

      <section className="bg-surface rounded-xl border p-3" aria-label="Progress">
        <p className="text-muted-foreground mb-2 px-1 text-xs">
          Click a step to move the candidate there. Each move is recorded in the history.
        </p>
        <ol className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-6" aria-label="Status">
          {CANDIDATE_STATUSES.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                disabled={s === c.status}
                onClick={() => setMoving(s)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  s === c.status
                    ? 'bg-primary text-primary-foreground border-primary font-medium'
                    : i < step
                      ? 'bg-muted/60 text-foreground hover:bg-muted'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] tabular-nums',
                    s === c.status && 'border-primary-foreground/60',
                  )}
                  aria-hidden
                >
                  {i < step ? <Check className="size-3" /> : i + 1}
                </span>
                {STATUS_LABELS[s]}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
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
              <ul className="-my-3 divide-y">
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
          <Panel title="Profile (read from the resume, checked by HR)" label="Profile">
            <p className="text-sm">{c.profile.summary}</p>
            <h3 className="text-muted-foreground mt-4 mb-1.5 text-xs font-semibold">Skills</h3>
            <p className="flex flex-wrap gap-1">
              {c.profile.skills.map((k) => (
                <SkillChip key={k.skill_id}>
                  {k.skill_name} {k.proficiency}/5 · {k.years}y
                </SkillChip>
              ))}
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs font-semibold">Domains</dt>
                <dd className="mt-0.5">{c.profile.domains.map(domainLabel).join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-semibold">Education</dt>
                <dd className="mt-0.5">{c.profile.education.join(', ') || '—'}</dd>
              </div>
            </dl>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Details">
            <DetailList
              items={[
                { label: 'Source', value: c.source },
                { label: 'Uploaded', value: date(c.uploaded_at) },
                { label: 'Can join in', value: `${c.profile.notice_days} days` },
                {
                  label: 'Expected pay band',
                  value: (
                    <Select
                      value={c.profile.cost_band ?? NOT_KNOWN}
                      onValueChange={(band) =>
                        update.mutate({
                          profile: { ...c.profile, cost_band: band === NOT_KNOWN ? null : band },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-full" aria-label="Expected pay band">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NOT_KNOWN}>Not known yet</SelectItem>
                        {COST_BANDS.map((b) => (
                          <SelectItem key={b} value={b}>
                            Band {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ),
                },
              ]}
            />
          </Panel>
          <Panel title="Contact (HR only)">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2 break-all">
                <Mail className="text-muted-foreground size-4 shrink-0" aria-hidden />{' '}
                {c.email ?? '—'}
              </li>
              <li className="flex items-center gap-2">
                <Phone className="text-muted-foreground size-4 shrink-0" aria-hidden />{' '}
                {c.phone ?? '—'}
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
            <ol className="space-y-3 text-sm">
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
        </aside>
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
