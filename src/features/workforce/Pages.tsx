import { FileText, Loader2, Search, X } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router'

import type { DraftTask, PeopleFilters, TaskCreate } from '@/api/types'

type Filters = Required<PeopleFilters>

const complete = (f: PeopleFilters): Filters => ({
  skill_ids: f.skill_ids ?? [],
  min_proficiency: f.min_proficiency,
  levels: f.levels ?? [],
  locations: f.locations ?? [],
  practices: f.practices ?? [],
  available_within_days: f.available_within_days ?? null,
  min_free_pct: f.min_free_pct,
})
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/AuthProvider'
import { useClients } from '@/features/clients/api'
import { useCreateTask } from '@/features/newTask/api'
import { UnitBadge } from '@/features/org/UnitBadge'
import { useInterpretSearch, useRfpDrafts, useSearchPeople } from '@/features/workforce/api'
import { date, humanize, locationLabel } from '@/lib/format'

/** "Free React people in Hyderabad next month": the AI turns the words into filters you can
 * see and remove; the search itself is code (ADR 031). */
export function PeopleSearchPage() {
  const role = useAuth().user?.role
  const interpret = useInterpretSearch()
  const search = useSearchPeople()
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<Filters | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  if (role === 'viewer') return <Navigate to="/tasks" replace />

  const run = (f: Filters) => {
    setFilters(f)
    search.mutate(f)
  }
  const chips: { key: string; label: string; drop: () => Filters }[] = []
  if (filters) {
    for (const id of filters.skill_ids) {
      chips.push({
        key: `s-${id}`,
        label: `${names[id] ?? id}${filters.min_proficiency > 1 ? ` ${filters.min_proficiency}+/5` : ''}`,
        drop: () => ({ ...filters, skill_ids: filters.skill_ids.filter((x) => x !== id) }),
      })
    }
    for (const l of filters.levels)
      chips.push({
        key: `l-${l}`,
        label: l,
        drop: () => ({ ...filters, levels: filters.levels.filter((x) => x !== l) }),
      })
    for (const l of filters.locations)
      chips.push({
        key: `loc-${l}`,
        label: locationLabel(l),
        drop: () => ({ ...filters, locations: filters.locations.filter((x) => x !== l) }),
      })
    for (const p of filters.practices)
      chips.push({
        key: `p-${p}`,
        label: humanize(p),
        drop: () => ({ ...filters, practices: filters.practices.filter((x) => x !== p) }),
      })
    if (filters.available_within_days != null)
      chips.push({
        key: 'avail',
        label:
          filters.available_within_days === 0
            ? 'Free now'
            : `Free within ${filters.available_within_days} days`,
        drop: () => ({ ...filters, available_within_days: null }),
      })
    if (filters.min_free_pct > 0)
      chips.push({
        key: 'free',
        label: `${filters.min_free_pct}% free`,
        drop: () => ({ ...filters, min_free_pct: 0 }),
      })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find people"
        description="Ask in plain words. The words become filters you can check and remove; the people are found and ranked by the app, not by the AI."
      />
      <form
        role="search"
        className="flex max-w-2xl gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          interpret.mutate(q, {
            onSuccess: (r) => {
              setNames(r.skill_names)
              run(complete(r.filters))
            },
          })
        }}
      >
        <Input
          aria-label="Who are you looking for?"
          placeholder="e.g. senior React people free next month in Hyderabad"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" disabled={q.trim().length < 3 || interpret.isPending}>
          {interpret.isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Search aria-hidden />
          )}
          Search
        </Button>
      </form>
      {interpret.isError && <ErrorState error={interpret.error} />}
      {interpret.data && interpret.data.unmatched_skills.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Not in the skills list, so not searched: {interpret.data.unmatched_skills.join(', ')}
        </p>
      )}
      {filters && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Search filters">
          {chips.length === 0 && (
            <span className="text-muted-foreground text-sm">No filters: everyone.</span>
          )}
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              className="bg-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
              aria-label={`Remove filter ${c.label}`}
              onClick={() => run(c.drop())}
            >
              {c.label} <X className="size-3" aria-hidden />
            </button>
          ))}
        </div>
      )}
      {search.isError && <ErrorState error={search.error} />}
      {search.data &&
        (search.data.items.length === 0 ? (
          <EmptyState title="Nobody matches every filter">
            Remove a filter to widen the search.
          </EmptyState>
        ) : (
          <section aria-label="People found" className="space-y-2">
            <p className="text-muted-foreground text-sm">
              {search.data.total} found
              {search.data.total > search.data.items.length &&
                `, showing ${search.data.items.length}`}
            </p>
            <ul className="bg-surface divide-y rounded-xl border">
              {search.data.items.map((p) => (
                <li
                  key={p.employee_id}
                  className="flex flex-wrap justify-between gap-2 px-4 py-2.5"
                >
                  <span className="space-y-0.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Link
                        to={`/planning/people/${p.employee_id}`}
                        className="font-medium hover:underline"
                      >
                        {p.full_name}
                      </Link>
                      <UnitBadge unit={p.business_unit} />
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {p.designation} · {p.level} · {locationLabel(p.location)} ·{' '}
                      {humanize(p.practice)}
                    </span>
                    {p.matched_skills.length > 0 && (
                      <span className="block text-xs">{p.matched_skills.join(' · ')}</span>
                    )}
                  </span>
                  <StatusBadge tone={p.free_pct_now === 100 ? 'ready' : 'neutral'}>
                    {p.free_pct_now === 100
                      ? 'Free now'
                      : `${p.free_pct_now}% free · from ${date(p.available_from)}`}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}

function inDays(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
}

/** Paste a client's request; get a draft task for every role it asks for (ADR 031). */
export function FromRequestPage() {
  const role = useAuth().user?.role
  const drafts = useRfpDrafts()
  const clients = useClients()
  const create = useCreateTask()
  const [text, setText] = useState('')
  const [client, setClient] = useState('')
  const [created, setCreated] = useState(0)
  const [busy, setBusy] = useState(false)
  if (role !== 'admin' && role !== 'resource_manager') return <Navigate to="/tasks" replace />

  const tasksFor = (d: DraftTask): TaskCreate[] => {
    const c = clients.data?.find((x) => x.code === client)
    return Array.from({ length: d.count }, (_, i) => ({
      title: d.count > 1 ? `${d.title} (${i + 1} of ${d.count})` : d.title,
      description: `From a client request: ${d.title}.`,
      client_code: client,
      domain: d.domain ?? c?.domain ?? 'retail',
      required_level: d.required_level,
      min_years_experience: 0,
      location_constraint: [],
      work_mode: 'hybrid',
      client_timezone: c?.timezone ?? 'Asia/Kolkata',
      min_timezone_overlap_hours: 0,
      start_date: inDays(d.start_in_weeks != null ? d.start_in_weeks * 7 : 14),
      duration_weeks: d.duration_weeks ?? 12,
      allocation_pct_required: 100,
      max_cost_band: 'E',
      clearance_required: null,
      priority: 'medium',
      requirements: d.skills.map((s) => ({
        skill_id: s.skill_id,
        min_proficiency: 3,
        must_have: s.must_have,
      })),
    }))
  }
  const ready = (drafts.data?.drafts ?? []).filter((d) => d.skills.some((s) => s.must_have))
  const createAll = async () => {
    setBusy(true)
    let n = 0
    try {
      for (const d of ready)
        for (const t of tasksFor(d)) {
          await create.mutateAsync(t)
          n += 1
        }
    } finally {
      setCreated(n)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks from a client request"
        description="Paste the client's request (RFP, statement of work or email). Each role becomes a draft task to check; nothing is saved until you create them."
        back={{ to: '/tasks', label: 'Tasks' }}
      />
      <form
        className="max-w-3xl space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          setCreated(0)
          drafts.mutate(text)
        }}
      >
        <Label htmlFor="rfp-text">Client&apos;s request</Label>
        <Textarea
          id="rfp-text"
          rows={8}
          placeholder="We need 3 senior data engineers (Databricks, Python) for 6 months from next month…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" disabled={text.trim().length < 20 || drafts.isPending}>
          {drafts.isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <FileText aria-hidden />
          )}
          Read the request
        </Button>
      </form>
      {drafts.isError && <ErrorState error={drafts.error} />}
      {drafts.data && (
        <section aria-label="Draft tasks" className="space-y-3">
          {drafts.data.notes.map((n) => (
            <p key={n} className="text-muted-foreground text-sm">
              {n}
            </p>
          ))}
          <ul className="bg-surface divide-y rounded-xl border">
            {drafts.data.drafts.map((d, i) => (
              <li key={i} className="space-y-1 px-4 py-3">
                <p className="font-medium">
                  {d.count} × {d.title}{' '}
                  <span className="text-muted-foreground text-xs">· {d.required_level}</span>
                </p>
                <p className="text-sm">
                  {d.skills.map((s) => `${s.name}${s.must_have ? '' : ' (nice)'}`).join(', ') ||
                    'No skills matched'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {d.duration_weeks ? `${d.duration_weeks} weeks` : 'Duration not stated: 12 weeks'}
                  {' · '}
                  {d.start_in_weeks != null
                    ? `starts in ${d.start_in_weeks} weeks`
                    : 'start not stated: in 2 weeks'}
                  {d.unmatched_skills.length > 0 &&
                    ` · not in the skills list: ${d.unmatched_skills.join(', ')}`}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rfp-client">Client</Label>
              <select
                id="rfp-client"
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              >
                <option value="">Choose…</option>
                {(clients.data ?? [])
                  .filter((c) => c.is_active)
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <Button
              onClick={() => void createAll()}
              disabled={!client || ready.length === 0 || busy}
            >
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              Create {ready.reduce((n, d) => n + d.count, 0)} tasks
            </Button>
          </div>
          {create.isError && <ErrorState error={create.error} />}
          {created > 0 && (
            <p role="status" className="text-sm">
              Created {created} task{created === 1 ? '' : 's'}.{' '}
              <Link to="/tasks" className="underline">
                Open the task list
              </Link>{' '}
              to run matching.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
