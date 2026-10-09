import { ArrowUpRight, ChevronDown, Download } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import type { DashboardRing, MonthIdleCost, MonthTasks, OpenTaskLine } from '@/api/types'
import { ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboard } from '@/features/dashboard/api'
import { usd } from '@/features/planning/PlanningPage'
import { TaskStatusBadge } from '@/features/tasks/PriorityBadge'
import { date as formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const CARD = 'bg-surface min-w-0 rounded-2xl p-5 shadow-(--card-shadow)'

const monthShort = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleString('en-GB', { month: 'short' })
const monthLong = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleString('en-GB', { month: 'long', year: 'numeric' })

/** Round an axis maximum up to a tidy number, so gridlines land on readable values. */
function niceMax(n: number) {
  if (n <= 0) return 4
  const pow = 10 ** Math.floor(Math.log10(n))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow * 4 >= n) ?? 10
  return step * pow * 4
}

const compact = (n: number) =>
  n >= 1_000_000
    ? `${+(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${Math.round(n / 1000)}k`
      : `${n}`

function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  )
}

// --- rings -----------------------------------------------------------------------------------
const RING_COLOURS: Record<string, [string, string]> = {
  agreement: ['var(--chart-2)', '#f9a8d4'],
  profiles: ['var(--chart-1)', 'var(--chart-5)'],
  shortlisted: ['var(--chart-3)', '#93c5fd'],
}
const RING_LINKS: Record<string, string> = {
  agreement: '/admin?tab=health',
  profiles: '/company',
  shortlisted: '/tasks',
}

function Ring({ ring }: { ring: DashboardRing }) {
  const id = useId()
  const [from, to] = RING_COLOURS[ring.key] ?? ['var(--chart-1)', 'var(--chart-5)']
  const r = 26
  const length = 2 * Math.PI * r
  const shown = ring.value ?? 0
  return (
    <Link
      to={RING_LINKS[ring.key] ?? '/'}
      className="hover:bg-muted/60 -mx-2 flex items-center gap-4 rounded-xl px-2 py-2 transition-colors"
    >
      <span className="relative grid size-[68px] shrink-0 place-items-center">
        <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={from} />
              <stop offset="1" stopColor={to} />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
          {shown > 0 && (
            <circle
              cx="32"
              cy="32"
              r={r}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              stroke={`url(#${id})`}
              strokeDasharray={`${shown * length} ${length}`}
            />
          )}
        </svg>
        <span className="relative text-sm font-bold">
          {ring.value === null ? '—' : `${Math.round(ring.value * 100)}%`}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground block text-xs">{ring.label}</span>
        <span className="mt-0.5 block text-lg leading-tight font-bold">
          {ring.denominator ? `${ring.numerator} / ${ring.denominator}` : 'No data yet'}
        </span>
        <span className="text-muted-foreground block truncate text-xs">{ring.note}</span>
      </span>
      <span className="bg-band-shortlist text-band-shortlist-foreground grid size-8 shrink-0 place-items-center rounded-lg">
        <ArrowUpRight className="size-4" aria-hidden />
        <span className="sr-only">Open</span>
      </span>
    </Link>
  )
}

// --- bar charts --------------------------------------------------------------------------------
interface Series {
  key: string
  label: string
  bar: string // Tailwind classes for the bar fill
  swatch: string
}

function BarChart<T extends { month: string }>({
  rows,
  series,
  value,
  format,
  height,
  overlap = false,
  label,
}: {
  rows: T[]
  series: Series[]
  value: (row: T, key: string) => number
  format: (n: number) => string
  height: number
  overlap?: boolean // later series drawn on top of the first (a part of a whole)
  label: string
}) {
  const max = niceMax(Math.max(0, ...rows.flatMap((r) => series.map((s) => value(r, s.key)))))
  const ticks = [4, 3, 2, 1, 0].map((i) => (max / 4) * i)
  return (
    <figure aria-label={label}>
      <div className="flex gap-3" style={{ height }}>
        <div className="text-muted-foreground flex flex-col justify-between pb-6 text-right text-[11px] tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div
            className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between"
            aria-hidden
          >
            {ticks.map((t) => (
              <span key={t} className="border-border/80 border-t border-dashed" />
            ))}
          </div>
          <div className="absolute inset-x-0 top-0 bottom-0 flex items-stretch gap-1 sm:gap-2">
            {rows.map((row) => (
              <div key={row.month} className="group flex min-w-0 flex-1 flex-col">
                <div
                  className={cn(
                    'relative flex flex-1 items-end justify-center',
                    overlap ? '' : 'gap-1 sm:gap-1.5',
                  )}
                >
                  {series.map((s, i) => {
                    const v = value(row, s.key)
                    return (
                      <span
                        key={s.key}
                        title={`${s.label}, ${monthLong(row.month)}: ${format(v)}`}
                        className={cn(
                          'w-full max-w-5 rounded-t-full transition-[height] duration-500',
                          s.bar,
                          overlap && 'absolute bottom-0 left-1/2 -translate-x-1/2',
                          overlap && i > 0 && 'z-10',
                        )}
                        style={{ height: `${(v / max) * 100}%` }}
                      />
                    )
                  })}
                  <span className="bg-foreground text-background pointer-events-none absolute -top-7 left-1/2 z-20 hidden -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap group-hover:block">
                    {series.map((s) => format(value(row, s.key))).join(' · ')}
                  </span>
                </div>
                <span className="text-muted-foreground mt-2 h-4 truncate text-center text-[11px]">
                  {monthShort(row.month)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-2">
        {series.map((s) => (
          <span
            key={s.key}
            className="bg-muted/70 flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs"
          >
            <span className={cn('size-2.5 rounded-sm', s.swatch)} aria-hidden />
            {s.label}
          </span>
        ))}
      </figcaption>
      {/* In a hidden wrapper: a <caption> escapes a table that is itself sr-only. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              {series.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month}>
                <th scope="row">{monthLong(row.month)}</th>
                {series.map((s) => (
                  <td key={s.key}>{format(value(row, s.key))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

// --- open tasks ------------------------------------------------------------------------------
const CHIPS = [
  'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-400/15 dark:text-fuchsia-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
  'bg-slate-200 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300',
]

function OpenTasks({ lines, total }: { lines: OpenTaskLine[]; total: number }) {
  return (
    <section className={CARD} aria-labelledby="open-tasks-h">
      <CardTitle
        action={
          <Link to="/tasks" className="text-primary text-xs font-semibold hover:underline">
            All {total}
          </Link>
        }
      >
        <span id="open-tasks-h">Open tasks starting soonest</span>
      </CardTitle>
      <div className="text-muted-foreground mt-3 flex justify-between px-1 text-[11px]">
        <span>Task</span>
        <span>Recommended</span>
      </div>
      {lines.length === 0 ? (
        <p className="text-muted-foreground mt-6 text-sm">No open tasks. New tasks appear here.</p>
      ) : (
        <ul className="mt-1 divide-y">
          {lines.map((t, i) => (
            <li key={t.task_id}>
              <Link
                to={`/tasks/${t.task_id}`}
                className="hover:bg-muted/60 -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5"
              >
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold',
                    CHIPS[i % CHIPS.length],
                  )}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{t.title}</span>
                  <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    {t.code} · starts {formatDate(t.start_date)}
                    <TaskStatusBadge status={t.status} />
                  </span>
                </span>
                <span className="border-border text-muted-foreground min-w-10 rounded-md border px-2 py-1 text-center text-xs tabular-nums">
                  {t.recommended ?? '—'}
                  <span className="sr-only">
                    {t.recommended === null ? 'not matched yet' : 'people recommended'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// --- idle cost -------------------------------------------------------------------------------
const PERIODS = [12, 6, 3] as const

function downloadIdleCsv(rows: MonthIdleCost[]) {
  const lines = [
    'month,idle_cost_usd,recoverable_usd',
    ...rows.map((r) => `${r.month},${r.idle_cost_usd},${r.recoverable_usd}`),
  ]
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'bench-idle-cost.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function IdleCost({ rows }: { rows: MonthIdleCost[] }) {
  const [months, setMonths] = useState<(typeof PERIODS)[number]>(12)
  const shown = rows.slice(0, months)
  const total = shown.reduce((n, r) => n + r.idle_cost_usd, 0)
  const recoverable = shown.reduce((n, r) => n + r.recoverable_usd, 0)
  return (
    <section className={CARD} aria-labelledby="idle-h">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="idle-h" className="text-base font-semibold">
            Bench idle cost ahead
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Free capacity at the rate card&apos;s cost if nothing new is booked:{' '}
            <span className="text-foreground font-semibold">{usd(total)}</span>, of which{' '}
            <span className="text-foreground font-semibold">{usd(recoverable)}</span> sits with
            people who fit an open task.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Period</span>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value) as (typeof PERIODS)[number])}
              className="border-input bg-surface h-9 appearance-none rounded-xl border pr-8 pl-3 text-sm font-medium"
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  Next {p} months
                </option>
              ))}
            </select>
            <ChevronDown
              className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
          </label>
          <Button variant="secondary" onClick={() => downloadIdleCsv(shown)}>
            <Download aria-hidden /> Download
          </Button>
        </div>
      </div>
      <div className="mt-6">
        <BarChart
          label="Bench idle cost by month"
          rows={shown}
          height={300}
          overlap
          format={(n) => `$${compact(n)}`}
          series={[
            {
              key: 'idle',
              label: 'Idle cost if nothing is booked',
              bar: 'bg-chart-4',
              swatch: 'bg-chart-4',
            },
            {
              key: 'recoverable',
              label: 'Recoverable by open tasks',
              bar: 'bg-gradient-to-t from-blue-600 to-blue-400',
              swatch: 'bg-chart-3',
            },
          ]}
          value={(r, k) => (k === 'idle' ? r.idle_cost_usd : r.recoverable_usd)}
        />
      </div>
    </section>
  )
}

// --- page ------------------------------------------------------------------------------------
function TasksByMonth({ rows }: { rows: MonthTasks[] }) {
  return (
    <section className={CARD} aria-labelledby="tasks-month-h">
      <CardTitle>
        <span id="tasks-month-h">Tasks opened and filled</span>
      </CardTitle>
      <div className="mt-5">
        <BarChart
          label="Tasks opened and filled by month"
          rows={rows}
          height={200}
          format={(n) => compact(Math.round(n))}
          series={[
            {
              key: 'opened',
              label: 'Opened',
              bar: 'bg-gradient-to-t from-violet-600 to-violet-400',
              swatch: 'bg-chart-1',
            },
            {
              key: 'filled',
              label: 'Filled',
              bar: 'bg-gradient-to-t from-pink-500 to-pink-300',
              swatch: 'bg-chart-2',
            },
          ]}
          value={(r, k) => (k === 'opened' ? r.opened : r.filled)}
        />
      </div>
    </section>
  )
}

export default function DashboardPage() {
  const query = useDashboard()
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const d = query.data
  return (
    <div className="space-y-5">
      <h1 className="sr-only">Dashboard</h1>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section className={CARD} aria-labelledby="health-h">
          <CardTitle>
            <span id="health-h">Staffing health</span>
          </CardTitle>
          <div className="mt-3 space-y-1">
            {d
              ? d.rings.map((r) => <Ring key={r.key} ring={r} />)
              : [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        </section>
        {d ? <TasksByMonth rows={d.tasks_by_month} /> : <Skeleton className="h-80 rounded-2xl" />}
        {d ? (
          <OpenTasks lines={d.open_tasks} total={d.open_tasks_total} />
        ) : (
          <Skeleton className="h-80 rounded-2xl" />
        )}
      </div>
      {d ? <IdleCost rows={d.idle_cost_by_month} /> : <Skeleton className="h-96 rounded-2xl" />}
    </div>
  )
}
