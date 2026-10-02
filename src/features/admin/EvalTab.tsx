import { useState } from 'react'

import type { EvalReportSummary } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Skeleton } from '@/components/ui/skeleton'
import { useEvalReport, useEvalReports } from '@/features/admin/api'
import { dateTime, percent } from '@/lib/format'
import { cn } from '@/lib/utils'

const pct = (v: number | null) => (v === null ? '—' : percent(v))

export function EvalTab() {
  const reports = useEvalReports()
  const [selected, setSelected] = useState<string | null>(null)

  if (reports.isPending) return <Skeleton className="h-64 w-full rounded-2xl" />
  if (reports.isError) return <ErrorState error={reports.error} />
  if (reports.data.items.length === 0)
    return (
      <EmptyState title="No evaluation reports yet">
        <p className="text-muted-foreground text-sm">
          Run <code>scripts/run_eval.py</code>, then <code>scripts/import_eval_reports.py</code>.
        </p>
      </EmptyState>
    )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <ul className="space-y-2" aria-label="Evaluation reports">
        {reports.data.items.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSelected(r.id)}
              aria-pressed={selected === r.id}
              className={cn(
                'bg-surface hover:border-primary/40 w-full rounded-2xl border p-4 text-left transition-colors',
                selected === r.id && 'border-primary ring-primary/15 ring-4',
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-semibold">{r.model}</p>
                <p className="text-muted-foreground shrink-0 text-xs">{dateTime(r.created_at)}</p>
              </div>
              <p className="text-muted-foreground text-xs">
                {r.tasks ?? '?'} tasks · seed {r.dataset_seed}
              </p>
              <Compare report={r} />
            </button>
          </li>
        ))}
      </ul>
      <ReportDetail id={selected} />
    </div>
  )
}

function Compare({ report }: { report: EvalReportSummary }) {
  const rows = [
    { label: 'Right person in top 5', model: report.model_hit5, base: report.baseline_hit5 },
    { label: 'Right person first', model: report.model_hit1, base: report.baseline_hit1 },
  ]
  return (
    <div className="mt-3 space-y-2">
      {rows.map((row) => (
        <div key={row.label}>
          <p className="text-muted-foreground text-xs">{row.label}</p>
          <Bar label="Model" value={row.model} tone="bg-primary" />
          <Bar label="Simple ranking" value={row.base} tone="bg-muted-foreground/50" />
        </div>
      ))}
    </div>
  )
}

function Bar({ label, value, tone }: { label: string; value: number | null; tone: string }) {
  return (
    <div className="mt-1 flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0">{label}</span>
      <span className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
        <span className={cn('block h-2 rounded-full', tone)} style={{ width: pct(value) }} />
      </span>
      <span className="w-10 text-right tabular-nums">{pct(value)}</span>
    </div>
  )
}

function ReportDetail({ id }: { id: string | null }) {
  const report = useEvalReport(id)
  if (id === null)
    return (
      <p className="text-muted-foreground rounded-2xl border border-dashed p-6 text-sm">
        Pick a report to see its details.
      </p>
    )
  if (report.isPending) return <Skeleton className="h-64 w-full rounded-2xl" />
  if (report.isError) return <ErrorState error={report.error} />
  const r = report.data
  const engine = (r.metrics.engine ?? {}) as { bands?: Record<string, number> }
  const facts: [string, string][] = [
    ['Report', r.name],
    ['Decisions', r.decision_set_version],
    ['Best person reached the model (retrieval)', pct(r.retrieval_recall)],
    [
      'Confidence error (ECE, lower is better; target < 10%)',
      r.ece === null ? '—' : percent(r.ece),
    ],
    ...Object.entries(engine.bands ?? {}).map(([band, n]): [string, string] => [
      `People in ${band}`,
      String(n),
    ]),
  ]
  return (
    <section className="bg-surface h-fit rounded-2xl border p-5" aria-label="Report details">
      <p className="text-sm font-semibold">{r.model}</p>
      <dl className="mt-3 divide-y text-sm">
        {facts.map(([k, v]) => (
          <div
            key={k}
            className="grid gap-1 py-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-4"
          >
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium break-words tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground mt-4 text-xs">
        Synthetic ground truth until the managers' labels arrive; then the gold-set agreement
        appears here too.
      </p>
    </section>
  )
}
