import { Info } from 'lucide-react'

import type { ModelHealth } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useModelHealth } from '@/features/admin/api'
import { date, percent, REJECT_REASON_LABELS } from '@/lib/format'

const BAND_NAMES: Record<string, string> = {
  shortlist: 'Shortlist',
  review: 'Review',
  hidden: 'Hidden',
}

export function HealthTab() {
  const health = useModelHealth()
  if (health.isPending) return <Skeleton className="h-80 w-full rounded-xl" />
  if (health.isError) return <ErrorState error={health.error} />
  const h = health.data

  if (h.overall.decisions === 0) {
    return (
      <EmptyState title="No manager decisions yet">
        Accept or reject people on a results page. This screen then shows how often the model
        agreed, week by week.
      </EmptyState>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground max-w-3xl text-sm">
        How often managers agree with the model when they accept or reject a suggested person. It
        &quot;leans yes&quot; when its score is 50% or more. Rejections for availability, client
        preference or other plans say nothing about the model, so they are left out.
      </p>
      {h.overall.rate === null && (
        <Alert>
          <Info />
          <AlertDescription>
            {h.overall.decisions} decisions so far. Rates appear from {h.min_decisions} decisions,
            below that they are mostly chance.
          </AlertDescription>
        </Alert>
      )}

      <dl className="grid gap-3 sm:grid-cols-3">
        <Headline
          label="Managers agree with the model"
          value={rate(h.overall.rate)}
          hint={`${h.overall.agreed} of ${h.overall.decisions} decisions`}
        />
        <Headline
          label="Shortlist suggestions rejected"
          value={rate(h.shortlist_override_rate)}
          hint="Lower is better"
        />
        <Headline
          label="Left out (planning reasons)"
          value={String(h.planning_rejections)}
          hint="Not a judgement about fit"
        />
      </dl>

      <section className="bg-surface rounded-xl border p-4" aria-label="Week by week">
        <h2 className="text-sm font-semibold">Week by week</h2>
        <ol className="mt-3 space-y-2">
          {h.weeks.map((w) => (
            <li key={w.week} className="grid grid-cols-[7rem_1fr_6rem] items-center gap-3 text-sm">
              <span className="text-muted-foreground">from {date(w.starts)}</span>
              <Bar value={w.rate} />
              <span className="tabular-nums">
                {rate(w.rate)} <span className="text-muted-foreground">· {w.decisions}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-surface rounded-xl border p-4" aria-label="By band">
          <h2 className="text-sm font-semibold">What managers did, by band</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {h.by_band.map((b) => (
              <li key={b.band} className="flex justify-between gap-3">
                <span>{BAND_NAMES[b.band] ?? b.band}</span>
                <span className="tabular-nums">
                  {b.accepted} accepted · {b.rejected} rejected
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="bg-surface rounded-xl border p-4" aria-label="By model">
          <h2 className="text-sm font-semibold">By model version</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {h.models.map((m) => (
              <li key={m.model} className="flex justify-between gap-3">
                <span className="truncate">{m.model}</span>
                <span className="shrink-0 tabular-nums">
                  {rate(m.rate)} · {m.decisions}
                </span>
              </li>
            ))}
          </ul>
          <Reasons reasons={h.reject_reasons} />
        </section>
      </div>
    </div>
  )
}

function rate(value: number | null): string {
  return value === null ? '—' : percent(value)
}

function Headline({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-surface rounded-xl border p-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-muted-foreground text-xs">{hint}</dd>
    </div>
  )
}

function Bar({ value }: { value: number | null }) {
  return (
    <span className="bg-muted block h-2.5 overflow-hidden rounded-full" aria-hidden>
      {value !== null && (
        <span className="bg-primary block h-full" style={{ width: `${value * 100}%` }} />
      )}
    </span>
  )
}

function Reasons({ reasons }: { reasons: ModelHealth['reject_reasons'] }) {
  const entries = Object.entries(reasons).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null
  return (
    <>
      <p className="mt-4 text-sm font-semibold">Why people were rejected</p>
      <ul className="mt-2 space-y-1 text-sm">
        {entries.map(([reason, n]) => (
          <li key={reason} className="flex justify-between">
            <span>{REJECT_REASON_LABELS[reason as keyof typeof REJECT_REASON_LABELS]}</span>
            <span className="tabular-nums">{n}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
