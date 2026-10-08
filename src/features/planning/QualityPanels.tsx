import { Check, Loader2, RefreshCw, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { CostBand } from '@/api/types'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useClients } from '@/features/clients/api'
import { MarginBadge, usd } from '@/features/planning/PlanningPage'
import {
  useCareer,
  useClientRates,
  useDataQuality,
  useDecideSuggestion,
  useDeleteClientRate,
  useRefreshSkills,
  useSaveClientRate,
  useSkillSuggestions,
} from '@/features/planning/qualityApi'
import { date, percent } from '@/lib/format'

const SELECT =
  'border-input bg-background h-8 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none'
const BANDS: CostBand[] = ['A', 'B', 'C', 'D', 'E']

/** HR's employee page: skills this person's work used that the profile lacks (ADR 027). */
export function SkillSuggestionsPanel({ employeeId }: { employeeId: string }) {
  const found = useSkillSuggestions(employeeId)
  const decide = useDecideSuggestion(employeeId)
  const [levels, setLevels] = useState<Record<string, number>>({})
  if (found.isPending) return <Skeleton className="h-16 w-full rounded-xl" />
  if (found.isError) return <ErrorState error={found.error} />
  if (found.data.length === 0) return null
  return (
    <section aria-label="Suggested skills" className="bg-surface rounded-xl border">
      <div className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Suggested skills ({found.data.length})</h2>
        <p className="text-muted-foreground text-xs">
          Used in this person&apos;s projects or placements but missing from the profile. “Last
          used” dates are updated from their work automatically.
        </p>
      </div>
      <ul className="divide-y">
        {found.data.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
            <div className="text-sm">
              <span className="font-medium">{s.skill_name}</span>
              <span className="text-muted-foreground text-xs">
                {' '}
                · {s.source} · used {date(s.evidence_date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                className={SELECT}
                aria-label={`Level for ${s.skill_name}`}
                value={levels[s.id] ?? 2}
                onChange={(e) => setLevels((l) => ({ ...l, [s.id]: Number(e.target.value) }))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    Level {n}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: s.id, accept: true, level: levels[s.id] ?? 2 })}
              >
                <Check aria-hidden /> Add {s.skill_name}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={decide.isPending}
                aria-label={`Dismiss ${s.skill_name}`}
                onClick={() => decide.mutate({ id: s.id, accept: false })}
              >
                <X aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Value card: what to learn next, from real demand (ADR 027). */
export function CareerPanel({
  employeeId,
  printable = false,
}: {
  employeeId: string
  printable?: boolean
}) {
  const career = useCareer(employeeId)
  if (career.isPending) return <Skeleton className="h-32 w-full rounded-xl" />
  if (career.isError) return <ErrorState error={career.error} />
  const c = career.data
  return (
    <section aria-label="Career paths" className="bg-surface rounded-xl border print:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Career paths</h2>
          <p className="text-muted-foreground text-xs">
            Already fits {c.fits_now} of the {c.looked_at} tasks at this level or one above in the
            last year ({c.fits_open_now} open now).
          </p>
        </div>
        {!printable && (
          <Link
            to={`/planning/people/${employeeId}/career`}
            className="text-primary text-xs font-medium hover:underline print:hidden"
          >
            Printable plan
          </Link>
        )}
      </div>
      <div className="px-5 py-4">
        {c.paths.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No task in the last year is one or two skills away.
          </p>
        ) : (
          <ol className="space-y-3">
            {c.paths.map((p, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium">
                  {p.skills.length === 1 ? '1 skill' : `${p.skills.length} skills`} away from{' '}
                  {p.tasks} task{p.tasks === 1 ? '' : 's'}
                  {p.open_now > 0 && ` (${p.open_now} open now)`}
                  {p.next_level && ' · includes the next level'}
                </p>
                <p className="text-muted-foreground text-xs">
                  Learn{' '}
                  {p.skills
                    .map((s) => `${s.name} (level ${s.has_level} → ${s.needs_level})`)
                    .join(' and ')}
                  . For example: {p.examples.join('; ')}.
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

/** Company page: how far matching can trust the profiles, and who to fix first (ADR 027). */
export function DataQualityCard() {
  const q = useDataQuality()
  const refresh = useRefreshSkills()
  if (q.isPending) return <Skeleton className="h-40 w-full rounded-xl" />
  if (q.isError) return <ErrorState error={q.error} />
  const d = q.data
  return (
    <section aria-label="Data quality" className="bg-surface space-y-4 rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Data quality</h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {percent(d.score)}{' '}
            <span className="text-muted-foreground text-sm font-normal">
              of {d.people} profiles matching can trust
            </span>
          </p>
          <p className="text-sm">{d.headline}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          {refresh.isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <RefreshCw aria-hidden />
          )}
          Refresh skills from work
        </Button>
      </div>
      {refresh.data && (
        <p className="text-muted-foreground text-xs">
          Updated {refresh.data.dates_updated} “last used” dates; {refresh.data.suggestions_added}{' '}
          new skill suggestions for HR.
        </p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {d.issues.map((i) => (
          <li key={i.issue} className="text-sm">
            <div className="flex justify-between gap-2">
              <span>{i.label}</span>
              <span className="tabular-nums">{percent(i.share)}</span>
            </div>
            <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
              <div className="bg-primary h-1.5 rounded-full" style={{ width: percent(i.share) }} />
            </div>
          </li>
        ))}
      </ul>
      {d.fix_first.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold">Fix these first ({d.fix_first.length})</h3>
          <ul className="mt-2 divide-y text-sm">
            {d.fix_first.map((p) => (
              <li
                key={p.employee_id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-1.5"
              >
                <Link to={`/employees/${p.employee_id}`} className="font-medium hover:underline">
                  {p.full_name}
                </Link>
                <span className="text-muted-foreground text-xs">
                  {p.issues.join(', ')} · {p.why_first}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** Admin rate card: clients' own bill rates per band (ADR 027). */
export function ClientRatesPanel() {
  const rates = useClientRates()
  const clients = useClients()
  const save = useSaveClientRate()
  const remove = useDeleteClientRate()
  const [client, setClient] = useState('')
  const [band, setBand] = useState<CostBand>('C')
  const [bill, setBill] = useState(2500)
  if (rates.isPending) return <Skeleton className="h-32 w-full rounded-xl" />
  if (rates.isError) return <ErrorState error={rates.error} />
  return (
    <section aria-label="Client rates" className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Client rates</h2>
        <p className="text-muted-foreground text-sm">
          A client&apos;s own weekly bill rate for a band replaces the default above for that
          client&apos;s tasks and projects: margins in staffing, hire or move and revenue on the
          value card.
        </p>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        aria-label="Add a client rate"
        onSubmit={(e) => {
          e.preventDefault()
          if (client) save.mutate({ client_code: client, cost_band: band, weekly_bill_usd: bill })
        }}
      >
        <select
          className={SELECT}
          aria-label="Client"
          value={client}
          onChange={(e) => setClient(e.target.value)}
        >
          <option value="">Choose a client…</option>
          {(clients.data ?? []).map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
        <select
          className={SELECT}
          aria-label="Band"
          value={band}
          onChange={(e) => setBand(e.target.value as CostBand)}
        >
          {BANDS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <Input
          type="number"
          min={0}
          aria-label="Bill rate per week"
          className="h-8 w-32"
          value={bill}
          onChange={(e) => setBill(Math.max(0, Number(e.target.value) || 0))}
        />
        <Button type="submit" size="sm" disabled={!client || save.isPending}>
          Save client rate
        </Button>
      </form>
      {save.isError && <ErrorState error={save.error} />}
      {rates.data.length === 0 ? (
        <p className="text-muted-foreground text-sm">No client has its own rates yet.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {rates.data.map((r) => (
            <li
              key={`${r.client_code}-${r.cost_band}`}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{r.client_code}</span> · band {r.cost_band} ·{' '}
                {usd(r.weekly_bill_usd)} a week{' '}
                <span className="text-muted-foreground text-xs">
                  (default {usd(r.default_bill_usd)})
                </span>
              </span>
              <span className="flex items-center gap-2">
                <MarginBadge margin={r.margin} />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${r.client_code} band ${r.cost_band}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ client: r.client_code, band: r.cost_band })}
                >
                  <Trash2 aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <StatusBadge tone="neutral">Bands without a client rate use the default</StatusBadge>
    </section>
  )
}
