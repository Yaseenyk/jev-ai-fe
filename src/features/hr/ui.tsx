import { CheckCircle2, CircleAlert, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import type { Band } from '@/api/types'
import {
  type CandidateStatus,
  type RequestStatus,
  REQUEST_STATUS_LABELS,
  STATUS_LABELS,
  type TaskMatch,
} from '@/features/hr/types'
import { BAND_LABELS, percent } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_TONE: Record<CandidateStatus, string> = {
  new: 'bg-secondary text-secondary-foreground',
  screened: 'bg-band-review text-band-review-foreground',
  contacted: 'bg-band-review text-band-review-foreground',
  interviewing: 'bg-primary/15 text-primary',
  hired: 'bg-band-shortlist text-band-shortlist-foreground',
  not_taken: 'bg-muted text-muted-foreground',
}

export function CandidateStatusBadge({ status }: { status: CandidateStatus }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_TONE[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}

const REQUEST_TONE: Record<RequestStatus, string> = {
  new: 'bg-band-review text-band-review-foreground',
  in_progress: 'bg-secondary text-secondary-foreground',
  sent: 'bg-primary/15 text-primary',
  reviewed: 'bg-band-shortlist text-band-shortlist-foreground',
  closed: 'bg-muted text-muted-foreground',
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', REQUEST_TONE[status])}>
      {REQUEST_STATUS_LABELS[status]}
    </span>
  )
}

export function ScoreBar({ score, band }: { score: number; band: Band }) {
  return (
    <div
      className="flex items-center gap-2"
      aria-label={`Fit ${percent(score)}, ${BAND_LABELS[band]}`}
    >
      <span className="bg-muted block h-2 w-24 overflow-hidden rounded-full" aria-hidden>
        <span
          className={cn(
            'block h-full',
            band === 'shortlist'
              ? 'bg-primary'
              : band === 'review'
                ? 'bg-band-review-foreground'
                : 'bg-muted-foreground',
          )}
          style={{ width: `${score * 100}%` }}
        />
      </span>
      <span className="text-sm font-medium tabular-nums">{percent(score)}</span>
    </div>
  )
}

/** Why this score: the rules-based reasons, which must-haves are met and which are missing. */
export function MatchReasons({
  match,
}: {
  match: Pick<TaskMatch, 'reasons' | 'matched_skills' | 'missing_skills'>
}) {
  return (
    <div className="space-y-1.5 text-sm">
      <ul className="space-y-0.5">
        {match.reasons.map((r) => (
          <li key={r} className="flex items-start gap-1.5">
            <CircleAlert className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
            {r}
          </li>
        ))}
      </ul>
      {match.matched_skills.length > 0 && (
        <p className="flex flex-wrap items-center gap-1">
          <CheckCircle2 className="text-primary size-3.5" aria-label="Has" />
          {match.matched_skills.map((s) => (
            <SkillChip key={s}>{s}</SkillChip>
          ))}
        </p>
      )}
      {match.missing_skills.length > 0 && (
        <p className="flex flex-wrap items-center gap-1">
          <XCircle className="text-destructive size-3.5" aria-label="Missing" />
          {match.missing_skills.map((s) => (
            <SkillChip key={s} muted>
              {s}
            </SkillChip>
          ))}
        </p>
      )}
    </div>
  )
}

export function SkillChip({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-md border px-1.5 py-0.5 text-xs',
        muted ? 'text-muted-foreground border-dashed' : 'bg-surface',
      )}
    >
      {children}
    </span>
  )
}

export function Panel({
  title,
  action,
  children,
  label,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  label?: string
}) {
  return (
    <section className="bg-surface rounded-2xl border p-4" aria-label={label ?? title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function daysUntil(isoDate: string, today = new Date()): number {
  return Math.ceil((new Date(isoDate).getTime() - today.getTime()) / 86_400_000)
}
