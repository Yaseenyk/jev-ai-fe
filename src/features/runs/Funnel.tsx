import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'

import type { MatchRun } from '@/api/types'

interface Step {
  label: string
  value: number | null
  hint: string
}

/** How 300 people became a short list: rules first, then the model, then the bands. */
export function Funnel({
  run,
  excludedTotal,
  bands,
}: {
  run: MatchRun
  excludedTotal: number | null
  bands: { shortlist: number; review: number; hidden: number }
}) {
  const passed = excludedTotal === null ? null : run.candidate_count - excludedTotal
  const steps: Step[] = [
    { label: 'People considered', value: run.candidate_count, hint: 'Everyone in the pool' },
    { label: 'Passed the rules', value: passed, hint: 'Available, in budget, cleared…' },
    {
      label: 'Ranked by the model',
      value: run.retrieved_count,
      hint: 'With at least one must-have skill',
    },
    {
      label: 'Recommended to you',
      value: bands.shortlist + bands.review,
      hint: `${bands.shortlist} shortlist · ${bands.review} review`,
    },
  ]
  const max = Math.max(run.candidate_count, 1)

  return (
    <section
      aria-label="How people were narrowed down"
      className="bg-surface grid grid-cols-2 gap-4 rounded-xl border p-4 sm:flex sm:items-stretch sm:gap-2"
    >
      {steps.map((s, i) => (
        <Fragment key={s.label}>
          {i > 0 && (
            <ChevronRight
              className="text-muted-foreground hidden size-4 shrink-0 self-center sm:block"
              aria-hidden
            />
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">{s.label}</p>
            <p className="text-2xl leading-none font-semibold tabular-nums">{s.value ?? '…'}</p>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
              <div
                className={
                  i === steps.length - 1
                    ? 'bg-band-shortlist-foreground h-full'
                    : 'bg-primary h-full'
                }
                style={{
                  width: s.value === null ? '0%' : `${Math.max(2, (s.value / max) * 100)}%`,
                }}
              />
            </div>
            <p className="text-muted-foreground truncate text-xs">{s.hint}</p>
          </div>
        </Fragment>
      ))}
    </section>
  )
}
