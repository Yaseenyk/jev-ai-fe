import { Check, ChevronDown, MapPin, TriangleAlert, X } from 'lucide-react'
import { useState } from 'react'

import type { DecisionDefinition, FeedbackInput, ShortlistItem } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { BandBadge } from '@/features/shortlist/BandBadge'
import { DecisionBars } from '@/features/shortlist/DecisionBars'
import { ExplanationBlock } from '@/features/shortlist/ExplanationBlock'
import { FactsList } from '@/features/shortlist/FactsList'
import { RejectDialog } from '@/features/shortlist/RejectDialog'
import {
  FLAG_LABELS,
  REJECT_REASON_LABELS,
  humanize,
  levelLabel,
  locationLabel,
  percent,
} from '@/lib/format'

export function ShortlistItemCard({
  item,
  definitions,
  defaultOpen,
  onFeedback,
  saving,
}: {
  item: ShortlistItem
  definitions: DecisionDefinition[]
  defaultOpen: boolean
  onFeedback: (input: FeedbackInput) => void
  saving: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [rejecting, setRejecting] = useState(false)
  const e = item.employee

  return (
    <Card className="py-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-muted-foreground w-8 text-sm tabular-nums">#{item.rank}</span>
          <div className="min-w-48 flex-1">
            <p className="font-medium">{e.full_name}</p>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
              <span>{e.designation}</span>
              <span>{levelLabel(e.level)}</span>
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="size-3" aria-hidden />
                {locationLabel(e.location)}
              </span>
              <span className="font-mono">{e.employee_code}</span>
            </p>
          </div>
          <BandBadge band={item.band} />
          <div className="w-24 text-right">
            <p className="text-lg leading-none font-semibold tabular-nums">
              {percent(item.rank_score)}
            </p>
            <p className="text-muted-foreground text-[11px]">overall fit</p>
          </div>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={open ? 'Hide details' : 'Show details'}
            >
              <ChevronDown
                className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
              />
            </Button>
          </CollapsibleTrigger>
        </div>

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

        <CollapsibleContent>
          <CardContent className="space-y-4 border-t px-4 py-4">
            <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_1fr]">
              <div className="space-y-2">
                <p className="text-xs font-medium">Facts from the data</p>
                <FactsList features={item.features} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium">AI decisions (probability of each answer)</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {definitions.map((def) => {
                    const result = item.decisions.find((d) => d.key === def.key)
                    return result ? <DecisionBars key={def.key} def={def} result={result} /> : null
                  })}
                </div>
              </div>
            </div>
            <ExplanationBlock explanation={item.explanation} status={item.explanation_status} />
          </CardContent>
        </CollapsibleContent>

        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
          {item.feedback ? (
            <p className="flex-1 text-sm">
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
            <p className="text-muted-foreground flex-1 text-xs">
              Your decision is recorded; nobody is assigned automatically.
            </p>
          )}
          <Button
            size="sm"
            variant={item.feedback?.action === 'accept' ? 'secondary' : 'default'}
            disabled={saving || item.feedback?.action === 'accept'}
            onClick={() => onFeedback({ action: 'accept' })}
          >
            <Check /> Accept as candidate
          </Button>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => setRejecting(true)}>
            <X /> Reject
          </Button>
        </div>
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
