import { Check, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import type { DecisionDefinition, ShortlistItem, Thresholds } from '@/api/types'
import { DecisionBars } from '@/features/shortlist/DecisionBars'
import { FactsList } from '@/features/shortlist/FactsList'
import { FLAG_LABELS, humanize, percent } from '@/lib/format'
import { cn } from '@/lib/utils'

const RULES = [
  'Free in time for the start date',
  'No leave clash during the task',
  'Location fits the task',
  'Enough working-hours overlap with the client',
  'Within the cost band',
  'Client clearance, if the task needs it',
]

/** Why the result is what it is, in the order the system decided it. */
export function bandReason(item: ShortlistItem, th: Thresholds | null | undefined): string {
  const score = percent(item.rank_score)
  if (item.band === 'shortlist') {
    return th
      ? `Overall fit ${score} is at least ${percent(th.shortlist_min)}, with no warnings, so it is on the shortlist.`
      : `High overall fit (${score}) with no warnings, so it is on the shortlist.`
  }
  if (item.band === 'review') {
    if (item.flags.length > 0 && th && item.rank_score >= th.shortlist_min) {
      return `Overall fit ${score} would reach the shortlist, but a warning caps it at Review so a person checks it.`
    }
    return th
      ? `Overall fit ${score} is between ${percent(th.review_min)} and ${percent(th.shortlist_min)}, so it needs a human look.`
      : `Medium overall fit (${score}), so it needs a human look.`
  }
  return th
    ? `Overall fit ${score} is below ${percent(th.review_min)}, so it is hidden unless you ask to see it.`
    : `Low overall fit (${score}), so it is hidden unless you ask to see it.`
}

export function DecisionTrail({
  item,
  definitions,
  thresholds,
}: {
  item: ShortlistItem
  definitions: DecisionDefinition[]
  thresholds: Thresholds | null | undefined
}) {
  const warnings = item.flags.length > 0 || item.contradictions.length > 0
  return (
    <section aria-label="How this was decided">
      <p className="text-sm font-semibold">How this was decided</p>
      <ol className="mt-3 space-y-0">
        <TrailStep n={1} title="Passed every rule" tone="ok">
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {RULES.map((r) => (
              <li key={r} className="flex items-center gap-1.5 text-sm">
                <Check className="text-band-shortlist-foreground size-3.5 shrink-0" aria-hidden />
                {r}
              </li>
            ))}
          </ul>
        </TrailStep>

        <TrailStep n={2} title="Facts from the data">
          <div className="max-w-md">
            <FactsList features={item.features} />
          </div>
        </TrailStep>

        <TrailStep n={3} title="What the model answered (probability of each answer)">
          <div className="grid gap-4 sm:grid-cols-2">
            {definitions.map((def) => {
              const result = item.decisions.find((d) => d.key === def.key)
              return result ? <DecisionBars key={def.key} def={def} result={result} /> : null
            })}
          </div>
        </TrailStep>

        <TrailStep n={4} title="Safety checks" tone={warnings ? 'warn' : 'ok'}>
          {warnings ? (
            <div className="space-y-1 text-sm">
              {item.flags.map((f) => (
                <p key={f} className="flex items-center gap-1.5">
                  <TriangleAlert
                    className="text-band-review-foreground size-3.5 shrink-0"
                    aria-hidden
                  />
                  {FLAG_LABELS[f] ?? humanize(f)}
                </p>
              ))}
              {item.contradictions.map((c) => (
                <p key={c} className="text-muted-foreground pl-5">
                  {c}
                </p>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-sm">
              <ShieldCheck className="text-band-shortlist-foreground size-3.5" aria-hidden />
              No contradictions with the facts, and the answers held when the options were
              reordered.
            </p>
          )}
        </TrailStep>

        <TrailStep n={5} title="Result" last>
          <p className="text-sm">{bandReason(item, thresholds)}</p>
        </TrailStep>
      </ol>
    </section>
  )
}

function TrailStep({
  n,
  title,
  tone,
  last = false,
  children,
}: {
  n: number
  title: string
  tone?: 'ok' | 'warn'
  last?: boolean
  children: ReactNode
}) {
  return (
    <li className="relative grid grid-cols-[1.75rem_1fr] gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums',
            tone === 'ok' &&
              'border-band-shortlist-foreground/30 bg-band-shortlist text-band-shortlist-foreground',
            tone === 'warn' &&
              'border-band-review-foreground/30 bg-band-review text-band-review-foreground',
            !tone && 'bg-surface',
          )}
        >
          {n}
        </span>
        {!last && <span className="bg-border mt-1 w-px flex-1" aria-hidden />}
      </div>
      <div className={cn('min-w-0', last ? 'pb-0' : 'pb-5')}>
        <p className="pt-1 text-sm font-medium">{title}</p>
        <div className="mt-2">{children}</div>
      </div>
    </li>
  )
}
