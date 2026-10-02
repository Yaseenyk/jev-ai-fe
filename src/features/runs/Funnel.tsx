import type { MatchRun } from '@/api/types'
import { cn } from '@/lib/utils'

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
  ]
  const max = Math.max(run.candidate_count, 1)

  return (
    <section
      aria-label="How people were narrowed down"
      className="bg-surface rounded-2xl border p-4 sm:p-5"
    >
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li
            key={s.label}
            className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3 sm:grid-cols-[13rem_1fr]"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                <span className="text-muted-foreground mr-1.5 tabular-nums">{i + 1}.</span>
                {s.label}
              </p>
              <p className="text-muted-foreground truncate text-xs">{s.hint}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-muted h-2.5 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: s.value === null ? '0%' : `${Math.max(1.5, (s.value / max) * 100)}%`,
                  }}
                />
              </div>
              <span className="w-12 text-right text-lg font-semibold tabular-nums">
                {s.value ?? '…'}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4">
        <BandCount label="Shortlist" value={bands.shortlist} tone="shortlist" />
        <BandCount label="Review" value={bands.review} tone="review" />
        <BandCount label="Low confidence" value={bands.hidden} tone="hidden" />
      </div>
    </section>
  )
}

function BandCount({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'shortlist' | 'review' | 'hidden'
}) {
  return (
    <div
      className={cn(
        'rounded-xl px-3 py-2.5',
        tone === 'shortlist' && 'bg-band-shortlist text-band-shortlist-foreground',
        tone === 'review' && 'bg-band-review text-band-review-foreground',
        tone === 'hidden' && 'bg-muted text-muted-foreground',
      )}
    >
      <p className="text-xs font-medium">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
