import { AlertTriangle, CheckCircle2, Clock, FileUp, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import type { Level } from '@/api/types'
import { type Column, DataTable, Pagination } from '@/components/DataTable'
import { FilterBar, FilterSelect, SortSelect } from '@/components/FilterBar'
import { Field, FormSection, FormSheet } from '@/components/FormSheet'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { useUrlState } from '@/components/useUrlState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateEmployee, useDataHealth, useEmployees } from '@/features/hr/api'
import type { DataHealth, EmployeeCreate, EmployeeSummary, HealthFilter } from '@/features/hr/types'
import { LEVEL_TITLES, date, humanize, levelLabel, locationLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

const LOCATIONS = ['hyderabad', 'bengaluru', 'pune', 'chennai', 'remote_india', 'usa', 'uk']
const PRACTICES = ['app_dev', 'data_analytics', 'cloud', 'devops', 'ai_ml', 'qa']
const COST_BANDS = ['A', 'B', 'C', 'D', 'E']

const months = (h: DataHealth) => Math.round(h.review_after_days / 30)

const HEALTH_CARDS: {
  key: HealthFilter
  title: string
  help: (h: DataHealth) => string
  icon: typeof CheckCircle2
  tone: string
}[] = [
  {
    key: 'missing',
    title: 'Missing information',
    help: (h) =>
      `Fewer than ${h.min_skills} skills or no project history. Matching may overlook these people.`,
    icon: AlertTriangle,
    tone: 'text-band-review-foreground',
  },
  {
    key: 'due',
    title: 'Due for a review',
    help: (h) =>
      `Not checked by HR in the last ${months(h)} months, or never. People learn new skills, so confirm each profile is still right.`,
    icon: Clock,
    tone: 'text-primary',
  },
  {
    key: 'ready',
    title: 'Ready',
    help: (h) => `Complete, and checked by HR in the last ${months(h)} months.`,
    icon: CheckCircle2,
    tone: 'text-band-shortlist-foreground',
  },
]

const SORTS = [
  { value: 'code', label: 'Employee code' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'reviewed', label: 'Oldest review first' },
  { value: 'available', label: 'Free soonest' },
]

const DEFAULTS = {
  show: '',
  q: '',
  level: '',
  location: '',
  practice: '',
  sort: 'code',
  page: '1',
  size: '50',
}

/** "8 months ago", "3 weeks ago", "today". */
export function ago(iso: string, now = Date.now()): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000)
  if (days < 1) return 'today'
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  if (days < 730) return `${Math.round(days / 30)} months ago`
  return `${Math.round(days / 365)} years ago`
}

/** Plain-language next steps for one employee's profile. */
export function whatToFix(e: EmployeeSummary, minSkills: number): string[] {
  const steps: string[] = []
  if (e.missing.includes('few_skills')) {
    steps.push(`Add skills (has ${e.skill_count} of ${minSkills})`)
  }
  if (e.missing.includes('no_projects')) steps.push('Add a project they worked on')
  if (e.needs_review) {
    steps.push(
      e.reviewed_at ? `Review it: last checked ${ago(e.reviewed_at)}` : 'Review it: never checked',
    )
  }
  return steps
}

export function ProfileStatus({ e }: { e: EmployeeSummary }) {
  if (e.missing.length > 0) return <StatusBadge tone="attention">Missing information</StatusBadge>
  if (e.needs_review) return <StatusBadge tone="info">Review due</StatusBadge>
  return (
    <StatusBadge tone="ready">
      <CheckCircle2 className="size-3" aria-hidden /> Ready
    </StatusBadge>
  )
}

/** The Employees tab of the Company screen: data health first, then the people to fix. */
export function EmployeesTab() {
  const [f, set] = useUrlState(DEFAULTS)
  const show = (f.show || undefined) as HealthFilter | undefined
  const page = Math.max(1, Number(f.page) || 1)
  const size = Number(f.size) || 50
  const [adding, setAdding] = useState(false)
  const health = useDataHealth()
  const employees = useEmployees({
    q: f.q || undefined,
    level: f.level || undefined,
    location: f.location || undefined,
    practice: f.practice || undefined,
    health: show,
    sort: f.sort,
    limit: String(size),
    offset: String((page - 1) * size),
  })
  const h = health.data
  const minSkills = h?.min_skills ?? 3
  const readyShare = h && h.total ? Math.round((h.ready / h.total) * 100) : 0

  const active: { label: string; key: keyof typeof DEFAULTS }[] = [
    ...(show
      ? [
          {
            label: `Status: ${HEALTH_CARDS.find((c) => c.key === show)?.title}`,
            key: 'show' as const,
          },
        ]
      : []),
    ...(f.level
      ? [{ label: `Level: ${levelLabel(f.level as Level)}`, key: 'level' as const }]
      : []),
    ...(f.location
      ? [{ label: `Location: ${locationLabel(f.location)}`, key: 'location' as const }]
      : []),
    ...(f.practice
      ? [{ label: `Practice: ${humanize(f.practice)}`, key: 'practice' as const }]
      : []),
    ...(f.q ? [{ label: `Search: “${f.q}”`, key: 'q' as const }] : []),
  ]
  const chips = active.map((c) => ({ label: c.label, onRemove: () => set({ [c.key]: '' }) }))

  const columns: Column<EmployeeSummary>[] = [
    {
      key: 'name',
      header: 'Employee',
      sortKey: 'name',
      cell: (e) => (
        <div className="min-w-0">
          <Link
            to={`/employees/${e.id}`}
            className="font-medium hover:underline"
            onClick={(x) => x.stopPropagation()}
          >
            {e.full_name}
          </Link>
          <div className="text-muted-foreground text-xs">{e.employee_code}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (e) => (
        <div>
          <div>{e.designation}</div>
          <div className="text-muted-foreground text-xs">{levelLabel(e.level)}</div>
        </div>
      ),
    },
    { key: 'location', header: 'Location', cell: (e) => locationLabel(e.location) },
    {
      key: 'available',
      header: 'Free from',
      sortKey: 'available',
      cell: (e) => (
        <div>
          <div>{date(e.available_from)}</div>
          <div className="text-muted-foreground text-xs">
            {e.current_allocation_pct}% booked now
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Profile',
      cell: (e) => {
        const steps = whatToFix(e, minSkills)
        return (
          <div className="space-y-1">
            <ProfileStatus e={e} />
            {steps.length > 0 && (
              <ul className="text-muted-foreground space-y-0.5 text-xs" aria-label="To do">
                {steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            )}
          </div>
        )
      },
    },
    {
      key: 'reviewed',
      header: 'Last reviewed',
      sortKey: 'reviewed',
      cell: (e) =>
        e.reviewed_at ? (
          <span title={date(e.reviewed_at)}>{ago(e.reviewed_at)}</span>
        ) : (
          <span className="text-muted-foreground">Never</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Matching can only recommend people as well as their profiles describe them. Fill in what
          is missing, and confirm each profile is still right at least every {h ? months(h) : 6}{' '}
          months.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/import">
              <FileUp aria-hidden /> Import from a file
            </Link>
          </Button>
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden /> Add employee
          </Button>
        </div>
      </div>
      {adding && <AddEmployeeSheet onClose={() => setAdding(false)} />}

      {health.isPending ? (
        <Skeleton className="h-36 w-full rounded-xl" />
      ) : health.isError ? (
        <ErrorState error={health.error} />
      ) : (
        <section aria-label="Employee data health" className="space-y-3">
          <div className="bg-surface rounded-xl border px-4 py-3">
            <p className="text-sm font-medium">
              {h?.ready} of {h?.total} employees are ready for matching ({readyShare}%)
            </p>
            <span className="bg-muted mt-2 block h-2 overflow-hidden rounded-full" aria-hidden>
              <span className="bg-primary block h-full" style={{ width: `${readyShare}%` }} />
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {HEALTH_CARDS.map((card) => {
              const Icon = card.icon
              const selected = show === card.key
              return (
                <button
                  key={card.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => set({ show: selected ? '' : card.key })}
                  className={cn(
                    'bg-surface hover:border-primary/40 rounded-xl border p-4 text-left transition-colors',
                    selected && 'border-primary ring-primary/20 ring-2',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Icon className={cn('size-4', card.tone)} aria-hidden /> {card.title}
                    </span>
                    <span className="text-2xl font-semibold tabular-nums">{h?.[card.key]}</span>
                  </span>
                  <span className="text-muted-foreground mt-2 block text-xs">
                    {h && card.help(h)}
                  </span>
                  <span className="text-primary mt-2 block text-xs font-medium">
                    {selected ? 'Showing only these people' : 'Show these people'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section aria-label="Employee list" className="space-y-3">
        <FilterBar
          search={{
            value: f.q,
            onChange: (q) => set({ q }),
            placeholder: 'Name, code or role',
            label: 'Search employees',
          }}
          filters={
            <>
              <FilterSelect
                label="Level"
                value={f.level}
                onChange={(level) => set({ level })}
                allLabel="All levels"
                options={(Object.keys(LEVEL_TITLES) as Level[]).map((l) => ({
                  value: l,
                  label: levelLabel(l),
                }))}
                className="w-48"
              />
              <FilterSelect
                label="Location"
                value={f.location}
                onChange={(location) => set({ location })}
                allLabel="All locations"
                options={LOCATIONS.map((l) => ({ value: l, label: locationLabel(l) }))}
              />
              <FilterSelect
                label="Practice"
                value={f.practice}
                onChange={(practice) => set({ practice })}
                allLabel="All practices"
                options={PRACTICES.map((p) => ({ value: p, label: humanize(p) }))}
              />
            </>
          }
          sort={<SortSelect value={f.sort} onChange={(sort) => set({ sort })} options={SORTS} />}
          chips={chips}
          onClear={() => set({ show: '', q: '', level: '', location: '', practice: '' })}
        />

        {employees.isPending ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : employees.isError ? (
          <ErrorState error={employees.error} />
        ) : (
          <>
            <DataTable
              label="Employees"
              rows={employees.data.items}
              columns={columns}
              rowKey={(e) => e.id}
              rowHref={(e) => `/employees/${e.id}`}
              sort={f.sort}
              onSort={(sort) => set({ sort })}
              empty={
                show === 'ready'
                  ? {
                      title: 'Nobody is ready yet',
                      body: 'Fill in the missing information and review profiles to get people ready.',
                    }
                  : show && active.length === 1
                    ? {
                        title: 'Nothing to fix here',
                        body: 'Every profile in this group is in order.',
                      }
                    : { title: 'Nobody matches', body: 'Clear the search or filters.' }
              }
            />
            {employees.data.total > 0 && (
              <Pagination
                total={employees.data.total}
                page={page}
                pageSize={size}
                noun="employees"
                onPage={(p) => set({ page: String(p) })}
                onPageSize={(n) => set({ size: String(n) })}
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}

function AddEmployeeSheet({ onClose }: { onClose: () => void }) {
  const create = useCreateEmployee()
  const navigate = useNavigate()
  const [v, setV] = useState<EmployeeCreate>({
    employee_code: '',
    full_name: '',
    designation: '',
    level: 'L3',
    practice: 'app_dev',
    years_experience: 0,
    location: 'hyderabad',
    cost_band: 'C',
    current_allocation_pct: 0,
    available_from: new Date().toISOString().slice(0, 10),
  })
  const ready = v.employee_code.trim() && v.full_name.trim() && v.designation.trim()
  const text = (
    key: 'employee_code' | 'full_name' | 'designation',
    label: string,
    placeholder: string,
    wide = false,
  ) => (
    <Field id={`n-${key}`} label={label} required wide={wide}>
      <Input
        id={`n-${key}`}
        placeholder={placeholder}
        value={v[key]}
        onChange={(x) => setV({ ...v, [key]: x.target.value })}
      />
    </Field>
  )
  const pick = (
    key: 'level' | 'practice' | 'location' | 'cost_band',
    label: string,
    options: string[],
    show: (o: string) => string,
    help?: string,
  ) => (
    <Field id={`n-${key}`} label={label} help={help}>
      <Select value={v[key]} onValueChange={(o) => setV({ ...v, [key]: o })}>
        <SelectTrigger id={`n-${key}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {show(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
  return (
    <FormSheet
      title="Add employee"
      description="Matching includes them from the next run. You add their skills and projects on their profile next."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!ready || create.isPending}
            onClick={() =>
              create.mutate(v, { onSuccess: (e) => void navigate(`/employees/${e.id}`) })
            }
          >
            Add employee
          </Button>
        </>
      }
    >
      <FormSection title="Who they are">
        {text('full_name', 'Full name', 'e.g. Priya Sharma')}
        {text('employee_code', 'Employee code', 'e.g. SPY-01234')}
        {text('designation', 'Role', 'e.g. Senior Data Engineer', true)}
      </FormSection>
      <FormSection title="Experience">
        {pick('level', 'Level', Object.keys(LEVEL_TITLES), (l) => levelLabel(l as Level))}
        {pick('practice', 'Practice', PRACTICES, humanize)}
        <Field id="n-years" label="Years of experience">
          <Input
            id="n-years"
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={v.years_experience}
            onChange={(x) => setV({ ...v, years_experience: Number(x.target.value) })}
          />
        </Field>
      </FormSection>
      <FormSection title="Where and when they can work">
        {pick('location', 'Location', LOCATIONS, locationLabel)}
        {pick(
          'cost_band',
          'Cost band',
          COST_BANDS,
          (b) => `Band ${b}`,
          'Used to respect a task’s budget.',
        )}
        <Field
          id="n-alloc"
          label="Booked now (%)"
          help="Share of their time already on other work."
        >
          <Input
            id="n-alloc"
            type="number"
            min={0}
            max={100}
            value={v.current_allocation_pct}
            onChange={(x) => setV({ ...v, current_allocation_pct: Number(x.target.value) })}
          />
        </Field>
        <Field id="n-free" label="Free from" help="First day they can start new work.">
          <Input
            id="n-free"
            type="date"
            value={v.available_from}
            onChange={(x) => setV({ ...v, available_from: x.target.value })}
          />
        </Field>
      </FormSection>
      {create.isError && <ErrorState error={create.error} />}
    </FormSheet>
  )
}
