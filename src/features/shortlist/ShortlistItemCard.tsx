import { Check, ChevronDown, MapPin, TriangleAlert, X } from 'lucide-react'
import { useState } from 'react'

import type { DecisionDefinition, FeedbackInput, ShortlistItem, Thresholds } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { BandBadge } from '@/features/shortlist/BandBadge'
import { DecisionTrail } from '@/features/shortlist/DecisionTrail'
import { FeedbackPrompt } from '@/components/FeedbackPrompt'
import { ExplanationBlock } from '@/features/shortlist/ExplanationBlock'
import { useCanEdit } from '@/features/auth/AuthProvider'
import { RejectDialog } from '@/features/shortlist/RejectDialog'
import {
  FLAG_LABELS,
  chance,
  REJECT_REASON_LABELS,
  humanize,
  levelLabel,
  locationLabel,
  percent,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { UnitBadge } from '@/features/org/UnitBadge'

/** The few code-computed facts a manager scans first; the full list is in the details. */
function keyFacts(item: ShortlistItem): [string, string][] {
  const f = item.features
  return [
    ['Must-have skills', percent(f.must_have_coverage)],
    [
      'Level',
      f.level_gap === 0
        ? 'Right level'
        : f.level_gap > 0
          ? `${f.level_gap} above`
          : `${-f.level_gap} below`,
    ],
    ['Free at start', `${f.available_capacity_pct}%`],
    ['Domain projects', String(f.domain_project_count)],
  ]
}

export function ShortlistItemCard({
  item,
  definitions,
  thresholds,
  defaultOpen,
  onFeedback,
  saving,
}: {
  item: ShortlistItem
  definitions: DecisionDefinition[]
  thresholds?: Thresholds | null
  defaultOpen: boolean
  onFeedback: (input: FeedbackInput) => void
  saving: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [rejecting, setRejecting] = useState(false)
  const canEdit = useCanEdit()
  const e = item.employee
  const decided = item.feedback?.action

  return (
    <Card
      className={cn(
        'gap-0 py-0',
        decided === 'accept' && 'ring-band-shortlist-foreground/40',
        decided === 'reject' && 'opacity-80',
      )}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
          <span
            className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums"
            aria-label={`Rank ${item.rank}`}
          >
            {item.rank}
          </span>
          <div className="min-w-48 flex-1">
            <p className="font-medium">{e.full_name}</p>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
              <span>{e.designation}</span>
              <span aria-hidden>·</span>
              <span>{levelLabel(e.level)}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="size-3" aria-hidden />
                {locationLabel(e.location)}
              </span>
              <span aria-hidden>·</span>
              <span className="font-mono">{e.employee_code}</span>
              <UnitBadge unit={e.business_unit} />
            </p>
          </div>
          <dl className="hidden gap-5 text-xs md:flex" aria-label="Key facts">
            {keyFacts(item).map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex w-32 shrink-0 flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <BandBadge band={item.band} />
              <span className="text-lg leading-none font-semibold tabular-nums">
                {chance(item.rank_score)}
              </span>
            </div>
            <span className="bg-muted block h-1 w-full overflow-hidden rounded-full" aria-hidden>
              <span
                className="bg-primary block h-full"
                style={{ width: percent(item.rank_score) }}
              />
            </span>
            <span className="text-muted-foreground text-[11px]">overall fit</span>
          </div>
        </div>

        {item.resume && (
          <p
            className="text-muted-foreground mx-4 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
            aria-label="What the resume backs"
          >
            <span>Resume backs:</span>
            {item.resume.backed.map((s) => (
              <span key={s} className="text-band-shortlist-foreground">
                {s} ✓
              </span>
            ))}
            {item.resume.not_backed.map((s) => (
              <span key={s}>{s} ✗</span>
            ))}
            <span>(shown only, not scored yet)</span>
          </p>
        )}

        {item.flags.length > 0 && (
          <div className="text-band-review-foreground bg-band-review mx-4 mb-3 flex gap-2 rounded-md px-3 py-2 text-xs">
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Check this one: it can't be auto-shortlisted.</p>
              <p>{item.flags.map((f) => FLAG_LABELS[f] ?? humanize(f)).join(' · ')}</p>
              {item.contradictions.map((c) => (
                <p key={c}>{c}</p>
              ))}
            </div>
          </div>
        )}

        <div className="bg-muted/30 flex flex-wrap items-center gap-2 border-t px-4 py-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="-ml-2">
              <ChevronDown
                className={cn('transition-transform', open && 'rotate-180')}
                aria-hidden
              />
              {open ? 'Hide details' : 'Show details'}
            </Button>
          </CollapsibleTrigger>
          <div className="flex-1" />
          {item.feedback ? (
            <p className="text-sm">
              {item.feedback.action === 'accept' ? (
                <span className="text-band-shortlist-foreground inline-flex items-center gap-1 font-medium">
                  <Check className="size-4" aria-hidden /> Accepted as candidate
                </span>
              ) : (
                <span className="text-destructive inline-flex items-center gap-1 font-medium">
                  <X className="size-4" aria-hidden /> Rejected
                  {item.feedback.reject_reason &&
                    ` · ${REJECT_REASON_LABELS[item.feedback.reject_reason]}`}
                </span>
              )}
            </p>
          ) : (
            <p className="text-muted-foreground hidden text-xs sm:block">Not decided yet</p>
          )}
          {canEdit && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => setRejecting(true)}
              >
                <X aria-hidden /> Reject
              </Button>
              <Button
                size="sm"
                variant={decided === 'accept' ? 'secondary' : 'default'}
                disabled={saving || decided === 'accept'}
                onClick={() => onFeedback({ action: 'accept' })}
              >
                <Check aria-hidden /> Accept as candidate
              </Button>
            </>
          )}
        </div>

        <CollapsibleContent>
          <div className="space-y-4 border-t px-4 py-4">
            <DecisionTrail item={item} definitions={definitions} thresholds={thresholds} />
            <ExplanationBlock explanation={item.explanation} status={item.explanation_status} />
            <FeedbackPrompt
              area="shortlist_decision"
              targetId={item.id}
              question="Is this person ranked right?"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        personName={e.full_name}
        onSubmit={(v) => {
          onFeedback({
            action: 'reject',
            reject_reason: v.reject_reason,
            ...(v.comment.trim() ? { comment: v.comment.trim() } : {}),
          })
          setRejecting(false)
        }}
      />
    </Card>
  )
}
