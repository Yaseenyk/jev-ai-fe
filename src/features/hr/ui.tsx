import { CheckCircle2, CircleAlert, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import type { Band } from '@/api/types'
import { StatusBadge, type Tone } from '@/components/StatusBadge'
import {
  type CandidateStatus,
  type RequestStatus,
  REQUEST_STATUS_LABELS,
  STATUS_LABELS,
  type TaskMatch,
} from '@/features/hr/types'
import { BAND_LABELS, percent } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_TONE: Record<CandidateStatus, Tone> = {
  new: 'neutral',
  screened: 'attention',
  contacted: 'attention',
  interviewing: 'info',
  hired: 'ready',
  not_taken: 'neutral',
}

export function CandidateStatusBadge({ status }: { status: CandidateStatus }) {
  return <StatusBadge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</StatusBadge>
}

const REQUEST_TONE: Record<RequestStatus, Tone> = {
  new: 'attention',
  in_progress: 'neutral',
  sent: 'info',
  reviewed: 'ready',
  closed: 'neutral',
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <StatusBadge tone={REQUEST_TONE[status]}>{REQUEST_STATUS_LABELS[status]}</StatusBadge>
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
  id,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  label?: string
  id?: string
}) {
  return (
    <section id={id} className="bg-surface rounded-xl border" aria-label={label ?? title}>
      <div className="flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

/** The "Details" side card of a detail page: each label above its value. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y text-sm">
      {items.map((i) => (
        <div key={i.label} className="space-y-0.5 py-2 first:pt-0 last:pb-0">
          <dt className="text-muted-foreground text-xs">{i.label}</dt>
          <dd className="min-w-0 break-words">{i.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function daysUntil(isoDate: string, today = new Date()): number {
  return Math.ceil((new Date(isoDate).getTime() - today.getTime()) / 86_400_000)
}
