import { useSearchParams } from 'react-router'

import type { EvalReportSummary } from '@/api/types'
import { type Column, DataTable, Pagination } from '@/components/DataTable'
import { FormSheet } from '@/components/FormSheet'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { useUrlState } from '@/components/useUrlState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useEvalReport, useEvalReports } from '@/features/admin/api'
import { date, dateTime, percent } from '@/lib/format'
import { cn } from '@/lib/utils'

const pct = (v: number | null) => (v === null ? '—' : percent(v))

const DEFAULTS = { report: '', sort: 'newest', page: '1', size: '25' }

const SORT_VALUE: Record<string, (r: EvalReportSummary) => number> = {
  top5: (r) => r.model_hit5 ?? -1,
  first: (r) => r.model_hit1 ?? -1,
}

const GLOSSARY: [string, string][] = [
  [
    'Right person in top 5',
    'How often the person who truly fits best was among the first five suggestions.',
  ],
  ['Right person first', 'How often that person was the very first suggestion.'],
  [
    'Simple ranking',
    'The same test with a plain skills-and-level score and no model, so you can see what the model adds.',
  ],
  [
    'Confidence error',
    'How far the model’s stated chances are from what really happened. Lower is better; under 10% is good.',
  ],
]

export function EvalTab() {
  const reports = useEvalReports()
  const [f, set] = useUrlState(DEFAULTS)
  const [params] = useSearchParams()

  if (reports.isPending) return <Skeleton className="h-64 w-full rounded-xl" />
  if (reports.isError) return <ErrorState error={reports.error} />
  if (reports.data.items.length === 0)
    return (
      <EmptyState title="No test reports yet">
        <p>
          A report appears here each time the model is tested on tasks it has never seen. Ask your
          technical team to run a test.
        </p>
        <p className="mt-2 text-xs">
          Technical: <code>scripts/run_eval.py</code>, then{' '}
          <code>scripts/import_eval_reports.py</code>.
        </p>
      </EmptyState>
    )

  const page = Math.max(1, Number(f.page) || 1)
  const size = Number(f.size) || 25
  const by = SORT_VALUE[f.sort]
  const sorted = [...reports.data.items].sort((a, b) =>
    by ? by(b) - by(a) : b.created_at.localeCompare(a.created_at),
  )
  const rows = sorted.slice((page - 1) * size, page * size)

  const columns: Column<EvalReportSummary>[] = [
    {
      key: 'model',
      header: 'Model tested',
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium">{r.model}</p>
          <p className="text-muted-foreground text-xs">
            {r.tasks ?? '?'} test tasks · data set {r.dataset_seed}
          </p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Tested on',
      sortKey: 'newest',
      cell: (r) => <span className="whitespace-nowrap">{date(r.created_at)}</span>,
    },
    {
      key: 'top5',
      header: 'Right person in top 5',
      sortKey: 'top5',
      cell: (r) => <Compare model={r.model_hit5} base={r.baseline_hit5} />,
      className: 'min-w-52',
    },
    {
      key: 'first',
      header: 'Right person first',
      sortKey: 'first',
      cell: (r) => <Compare model={r.model_hit1} base={r.baseline_hit1} />,
      className: 'min-w-52',
    },
    {
      key: 'ece',
      header: 'Confidence error',
      align: 'right',
      cell: (r) =>
        r.ece === null ? (
          '—'
        ) : (
          <StatusBadge tone={r.ece < 0.1 ? 'ready' : 'attention'}>{percent(r.ece)}</StatusBadge>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground max-w-3xl text-sm">
        Each report tests a model on tasks it never saw during training, against a simple ranking
        without the model. Open a report for its details.
      </p>
      <dl className="bg-surface grid gap-x-6 gap-y-2 rounded-xl border p-4 text-sm sm:grid-cols-2">
        {GLOSSARY.map(([term, meaning]) => (
          <div key={term}>
            <dt className="font-medium">{term}</dt>
            <dd className="text-muted-foreground text-xs">{meaning}</dd>
          </div>
        ))}
      </dl>

      <DataTable
        label="Test reports"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => {
          const next = new URLSearchParams(params)
          next.set('report', r.id)
          return `/admin?${next.toString()}`
        }}
        sort={f.sort}
        onSort={(sort) => set({ sort })}
        empty={{ title: 'No test reports yet' }}
      />
      <Pagination
        total={sorted.length}
        page={page}
        pageSize={size}
        noun="reports"
        onPage={(p) => set({ page: String(p) })}
        onPageSize={(n) => set({ size: String(n) })}
      />
      {reports.data.total > reports.data.items.length && (
        <p className="text-muted-foreground text-xs">
          The newest {reports.data.items.length} of {reports.data.total} reports are shown.
        </p>
      )}

      {f.report && <ReportDetail id={f.report} onClose={() => set({ report: '' }, true)} />}
    </div>
  )
}

function Compare({ model, base }: { model: number | null; base: number | null }) {
  return (
    <div className="space-y-1">
      <Bar label="Model" value={model} tone="bg-primary" strong />
      <Bar label="Simple" value={base} tone="bg-muted-foreground/40" />
    </div>
  )
}

function Bar({
  label,
  value,
  tone,
  strong = false,
}: {
  label: string
  value: number | null
  tone: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-12 shrink-0">{label}</span>
      <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <span className={cn('block h-1.5 rounded-full', tone)} style={{ width: pct(value) }} />
      </span>
      <span className={cn('w-9 text-right tabular-nums', strong && 'font-semibold')}>
        {pct(value)}
      </span>
    </div>
  )
}

function ReportDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const report = useEvalReport(id)
  const r = report.data
  const engine = (r?.metrics.engine ?? {}) as { bands?: Record<string, number> }
  const facts: [string, string][] = r
    ? [
        ['Report', r.name],
        ['Tested on', dateTime(r.created_at)],
        ['Decision questions version', r.decision_set_version],
        ['Best person reached the model', pct(r.retrieval_recall)],
        ['Right person in top 5', `${pct(r.model_hit5)} (simple ranking ${pct(r.baseline_hit5)})`],
        ['Right person first', `${pct(r.model_hit1)} (simple ranking ${pct(r.baseline_hit1)})`],
        ['Confidence error (lower is better; target under 10%)', pct(r.ece)],
        ...Object.entries(engine.bands ?? {}).map(([band, n]): [string, string] => [
          `People in ${band}`,
          String(n),
        ]),
      ]
    : []
  return (
    <FormSheet
      title={r ? `Test report: ${r.model}` : 'Test report'}
      description="How this model did on tasks it never saw during training."
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {report.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : report.isError ? (
        <ErrorState error={report.error} />
      ) : (
        <section aria-label="Report details" className="space-y-4">
          <dl className="divide-y text-sm">
            {facts.map(([k, v]) => (
              <div
                key={k}
                className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-4"
              >
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium break-words tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground text-xs">
            Scored against synthetic ground truth until managers’ labels arrive; then agreement with
            managers appears here too.
          </p>
        </section>
      )}
    </FormSheet>
  )
}
