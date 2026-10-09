import { Loader2, Plus, Users, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { LearningStatus, Level, PersonRef, TeamIn } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import { useSkills } from '@/features/newTask/api'
import { UnitBadge } from '@/features/org/UnitBadge'
import { usd } from '@/features/planning/PlanningPage'
import {
  useAddCourse,
  useBuildTeam,
  useCapacity,
  useCourses,
  useKeyPersonRisk,
  useLearningOverview,
  useOpportunity,
  useUpdateAssignment,
} from '@/features/workforce/api'
import { date, humanize } from '@/lib/format'

const LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']
const SELECT =
  'border-input bg-background h-9 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none'

function Person({ p, extra }: { p: PersonRef; extra?: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Link to={`/planning/people/${p.employee_id}`} className="font-medium hover:underline">
        {p.full_name}
      </Link>
      <span className="text-muted-foreground text-xs">
        {p.designation} · {p.level}
        {extra && ` · ${extra}`}
      </span>
      <UnitBadge unit={p.business_unit} />
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface space-y-3 rounded-xl border p-4" aria-label={title}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

/** Skills only one or two experts hold, and running work one person carries (ADR 031). */
export function KeyPeopleTab() {
  const q = useKeyPersonRisk()
  if (q.isPending) return <Skeleton className="h-40 w-full" />
  if (q.isError) return <ErrorState error={q.error} />
  const { scarce_skills: scarce, projects } = q.data
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground max-w-3xl text-sm">
        If one of these people leaves or is on leave, open work stalls. Grow a backup early: the
        people listed are one level short of expert.
      </p>
      <Section title="Skills open work needs, held by one or two experts">
        {scarce.length === 0 ? (
          <EmptyState title="No skill depends on one or two people">
            Every skill open tasks need has at least three experts.
          </EmptyState>
        ) : (
          <ul className="-my-2 divide-y">
            {scarce.map((s) => (
              <li key={s.skill_id} className="space-y-1.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <StatusBadge tone={s.experts.length === 1 ? 'attention' : 'neutral'}>
                    {s.experts.length === 1 ? 'One expert' : 'Two experts'}
                  </StatusBadge>
                  <span className="text-muted-foreground text-xs">
                    needed by {s.open_tasks} open task{s.open_tasks === 1 ? '' : 's'}
                    {s.courses > 0 && ` · ${s.courses} course${s.courses === 1 ? '' : 's'}`}
                  </span>
                </div>
                <p className="text-sm">
                  Experts:{' '}
                  {s.experts.map((e, i) => (
                    <span key={e.employee_id}>
                      {i > 0 && ', '}
                      <Person p={e} />
                    </span>
                  ))}
                </p>
                <p className="text-muted-foreground text-sm">
                  {s.backups.length === 0 ? 'Nobody is one level short yet.' : 'Closest backups: '}
                  {s.backups.map((b, i) => (
                    <span key={b.employee_id}>
                      {i > 0 && ', '}
                      <Person p={b} extra={`${b.proficiency}/5, ${b.free_pct_now}% free`} />
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Running work carried by one person">
        {projects.length === 0 ? (
          <EmptyState title="Nothing running depends on one person">
            Work in progress shows here once projects and placements are recorded.
          </EmptyState>
        ) : (
          <ul className="-my-2 divide-y">
            {projects.map((r) => (
              <li key={`${r.project}-${r.person.employee_id}`} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.project}</span>
                  <StatusBadge tone={r.severity === 'high' ? 'attention' : 'neutral'}>
                    {r.severity === 'high' ? 'High' : 'Medium'}
                  </StatusBadge>
                  <span className="text-muted-foreground text-xs">
                    {r.client_code} · ends {date(r.ends_on)}
                    {r.leave_before_end && ' · on leave before it ends'}
                  </span>
                </div>
                <p className="text-sm">
                  <Person p={r.person} /> is the only one with{' '}
                  {r.sole_skills.map((s) => s.name).join(', ')}
                </p>
                {r.backups.length > 0 && (
                  <p className="text-muted-foreground text-sm">
                    Backups:{' '}
                    {r.backups.map((b, i) => (
                      <span key={b.employee_id}>
                        {i > 0 && ', '}
                        <Person p={b} extra={`${b.proficiency}/5`} />
                      </span>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

interface RoleDraft {
  title: string
  level: Level
  count: number
  skills: string[]
}

function inDays(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
}

/** Staff a whole team within a budget, preferring people who worked together (ADR 031). */
export function TeamBuilderTab() {
  const skills = useSkills()
  const build = useBuildTeam()
  const [start, setStart] = useState(inDays(30))
  const [budget, setBudget] = useState('')
  const [roles, setRoles] = useState<RoleDraft[]>([
    { title: 'Engineer', level: 'L3', count: 2, skills: [] },
  ])
  const edit = (i: number, c: Partial<RoleDraft>) =>
    setRoles((rs) => rs.map((r, j) => (j === i ? { ...r, ...c } : r)))
  const name = (id: string) => skills.data?.find((s) => s.id === id)?.name ?? id
  const ready = roles.every((r) => r.title.trim() && r.skills.length > 0)
  const run = () => {
    const body: TeamIn = {
      start_date: start,
      allocation_pct: 100,
      weekly_budget_usd: budget ? Number(budget) : null,
      client_code: null,
      roles: roles.map((r) => ({
        title: r.title.trim(),
        level: r.level,
        count: r.count,
        skills: r.skills.map((id) => ({ skill_id: id, min_proficiency: 3, must_have: true })),
      })),
    }
    build.mutate(body)
  }
  const plan = build.data
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <section className="bg-surface space-y-4 rounded-xl border p-4" aria-label="Team to build">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="tb-start">Starts</Label>
            <Input
              id="tb-start"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tb-budget">Weekly budget (USD)</Label>
            <Input
              id="tb-budget"
              type="number"
              min={0}
              placeholder="No limit"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
        </div>
        {roles.map((r, i) => (
          <fieldset
            key={i}
            className="space-y-2 rounded-lg border p-3"
            aria-label={`Team role ${i + 1}`}
          >
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Team role ${i + 1} title`}
                value={r.title}
                onChange={(e) => edit(i, { title: e.target.value })}
              />
              {roles.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove team role ${i + 1}`}
                  onClick={() => setRoles((rs) => rs.filter((_, j) => j !== i))}
                >
                  <X aria-hidden />
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <label>
                People{' '}
                <Input
                  type="number"
                  min={1}
                  max={10}
                  aria-label={`Team role ${i + 1} people`}
                  className="inline-block h-9 w-16"
                  value={r.count}
                  onChange={(e) =>
                    edit(i, { count: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })
                  }
                />
              </label>
              <label>
                Level{' '}
                <select
                  className={SELECT}
                  aria-label={`Team role ${i + 1} level`}
                  value={r.level}
                  onChange={(e) => edit(i, { level: e.target.value as Level })}
                >
                  {LEVELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
            </div>
            <select
              className={`${SELECT} w-full`}
              aria-label={`Team role ${i + 1} add skill`}
              value=""
              onChange={(e) => {
                const id = e.target.value
                if (id && !r.skills.includes(id)) edit(i, { skills: [...r.skills, id] })
              }}
            >
              <option value="">Add a must-have skill…</option>
              {(skills.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1">
              {r.skills.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="bg-muted rounded-full px-2 py-0.5 text-xs"
                  aria-label={`Remove ${name(id)}`}
                  onClick={() => edit(i, { skills: r.skills.filter((x) => x !== id) })}
                >
                  {name(id)} ×
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={roles.length >= 10}
            onClick={() =>
              setRoles((rs) => [...rs, { title: '', level: 'L3', count: 1, skills: [] }])
            }
          >
            <Plus aria-hidden /> Add role
          </Button>
          <Button onClick={run} disabled={!ready || build.isPending}>
            {build.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Users aria-hidden />
            )}
            Build team
          </Button>
        </div>
      </section>
      <section className="space-y-3" aria-label="Proposed team">
        {build.isError && <ErrorState error={build.error} />}
        {!plan ? (
          <EmptyState title="No team yet">
            Add the roles and skills, then build. People who have worked together before are
            preferred. Nothing is assigned.
          </EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-sm">
              <StatusBadge tone="neutral">{plan.members.length} people</StatusBadge>
              <StatusBadge tone="neutral">{usd(plan.weekly_cost_usd)} cost a week</StatusBadge>
              <StatusBadge tone="neutral">{usd(plan.weekly_bill_usd)} billed a week</StatusBadge>
              <StatusBadge tone="ready">{plan.margin_pct}% margin</StatusBadge>
              {plan.within_budget === false && (
                <StatusBadge tone="attention">Over budget</StatusBadge>
              )}
            </div>
            <ul className="bg-surface divide-y rounded-xl border">
              {plan.members.map((m) => (
                <li key={m.employee_id} className="space-y-0.5 px-4 py-2.5">
                  <p className="text-muted-foreground text-xs">{m.role}</p>
                  <Person
                    p={m}
                    extra={`fit ${Math.round(m.fit * 100)}%, ${usd(m.weekly_cost_usd)}/wk`}
                  />
                  {m.worked_with.length > 0 && (
                    <p className="text-xs">Worked with {m.worked_with.join(', ')}</p>
                  )}
                </li>
              ))}
            </ul>
            {plan.gaps.map((g) => (
              <p key={g.role} className="text-sm" role="status">
                {g.role}: {g.missing} still needed, {g.reason}.
              </p>
            ))}
          </>
        )}
      </section>
    </div>
  )
}

const MONTHS = [3, 6, 12]

/** Free and booked people per practice and month, and what the free time costs (ADR 031). */
export function CapacityTab() {
  const [months, setMonths] = useState(6)
  const q = useCapacity(months)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground max-w-3xl text-sm">
          Free people (FTE) per practice and month. Darker means more of the practice is idle.
          Bookings run until each person&apos;s &quot;available from&quot; date.
        </p>
        <select
          className={SELECT}
          aria-label="Months ahead"
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m} months
            </option>
          ))}
        </select>
      </div>
      {q.isPending ? (
        <Skeleton className="h-60 w-full" />
      ) : q.isError ? (
        <ErrorState error={q.error} />
      ) : (
        <div className="bg-surface overflow-x-auto rounded-xl border">
          <table className="w-full text-sm" aria-label="Capacity by practice and month">
            <thead>
              <tr className="border-b text-left">
                <th className="px-3 py-2 font-medium">Practice</th>
                {q.data.months.map((m) => (
                  <th key={m} className="px-3 py-2 text-right font-medium">
                    {new Date(m).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data.rows.map((r) => (
                <tr key={r.practice} className="border-b last:border-0">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    {humanize(r.practice)}
                  </th>
                  {r.cells.map((c) => {
                    const idle = c.people ? c.free_fte / c.people : 0
                    return (
                      <td
                        key={c.month}
                        className="px-3 py-2 text-right tabular-nums"
                        style={{
                          background: `color-mix(in oklab, var(--primary) ${Math.round(idle * 45)}%, transparent)`,
                        }}
                        title={`${c.people} people · ${c.booked_fte} booked · ${c.leave_fte} on leave · idle ${usd(c.idle_cost_usd)}`}
                      >
                        {c.free_fte}
                        <span className="text-muted-foreground block text-[11px]">
                          {usd(c.idle_cost_usd)}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="bg-muted/40">
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  Open tasks need (FTE)
                </th>
                {q.data.open_task_fte.map((d, i) => (
                  <td key={i} className="px-3 py-2 text-right font-medium tabular-nums">
                    {d}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** People who may be missing out: long bench, one client too long, passed over (ADR 031). */
export function OpportunityTab() {
  const q = useOpportunity()
  if (q.isPending) return <Skeleton className="h-40 w-full" />
  if (q.isError) return <ErrorState error={q.error} />
  const lists = [
    { title: 'On the bench 30 days or more', items: q.data.long_bench, unit: 'days on the bench' },
    {
      title: 'Mostly on one client for two years',
      items: q.data.same_client,
      unit: 'days on that client',
    },
    { title: 'Recommended often, never accepted', items: q.data.passed_over, unit: '' },
  ]
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground max-w-3xl text-sm">
        A check that good work is shared fairly. Each person here is worth a look when the next task
        opens: someone stuck may be ready for a change.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {lists.map((l) => (
          <Section key={l.title} title={`${l.title} (${l.items.length})`}>
            {l.items.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nobody.</p>
            ) : (
              <ul className="-my-1 space-y-2">
                {l.items.slice(0, 25).map((f) => (
                  <li key={f.employee_id} className="text-sm">
                    <Person p={f} />
                    <span className="text-muted-foreground block text-xs">
                      {f.days != null && l.unit ? `${f.days} ${l.unit}` : f.reason}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ))}
      </div>
    </div>
  )
}

const STATUS_LABELS: Record<LearningStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  done: 'Done',
  dropped: 'Dropped',
}

/** Courses, who is learning what, and what it costs (ADR 031). */
export function LearningTab() {
  const role = useAuth().user?.role
  const canAdd = role === 'admin' || role === 'hr'
  const overview = useLearningOverview()
  const courses = useCourses()
  const skills = useSkills()
  const add = useAddCourse()
  const update = useUpdateAssignment()
  const [form, setForm] = useState({
    name: '',
    provider: '',
    skill_id: '',
    reaches_level: 3,
    hours: 10,
    cost_usd: 0,
  })
  return (
    <div className="space-y-4">
      {overview.data && (
        <div className="flex flex-wrap gap-2 text-sm" aria-label="Learning summary">
          <StatusBadge tone="neutral">{overview.data.courses} courses</StatusBadge>
          <StatusBadge tone="neutral">{overview.data.in_progress} in progress</StatusBadge>
          <StatusBadge tone="ready">{overview.data.done_last_90_days} done in 90 days</StatusBadge>
          {overview.data.overdue > 0 && (
            <StatusBadge tone="attention">{overview.data.overdue} overdue</StatusBadge>
          )}
          <StatusBadge tone="neutral">{usd(overview.data.spend_usd)} spent</StatusBadge>
        </div>
      )}
      <p className="text-muted-foreground max-w-3xl text-sm">
        Train instead of hire. Assign a course from a person&apos;s page; when it is done, the skill
        is suggested on their profile for HR to accept at a level.
      </p>
      {canAdd && (
        <form
          aria-label="Add a course"
          className="bg-surface flex flex-wrap items-end gap-3 rounded-xl border p-4"
          onSubmit={(e) => {
            e.preventDefault()
            add.mutate(form, {
              onSuccess: () => setForm({ ...form, name: '', provider: '' }),
            })
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Course</Label>
            <Input
              id="c-name"
              className="w-56"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-provider">Provider</Label>
            <Input
              id="c-provider"
              className="w-40"
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-skill">Teaches</Label>
            <select
              id="c-skill"
              className={SELECT}
              value={form.skill_id}
              onChange={(e) => setForm({ ...form, skill_id: e.target.value })}
            >
              <option value="">Choose a skill…</option>
              {(skills.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-level">Up to level</Label>
            <select
              id="c-level"
              className={SELECT}
              value={form.reaches_level}
              onChange={(e) => setForm({ ...form, reaches_level: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}/5
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-hours">Hours</Label>
            <Input
              id="c-hours"
              type="number"
              min={1}
              className="w-20"
              value={form.hours}
              onChange={(e) =>
                setForm({ ...form, hours: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-cost">Cost (USD)</Label>
            <Input
              id="c-cost"
              type="number"
              min={0}
              className="w-24"
              value={form.cost_usd}
              onChange={(e) =>
                setForm({ ...form, cost_usd: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </div>
          <Button
            type="submit"
            disabled={!form.name.trim() || !form.provider.trim() || !form.skill_id || add.isPending}
          >
            <Plus aria-hidden /> Add course
          </Button>
          {add.isError && (
            <div className="w-full">
              <ErrorState error={add.error} />
            </div>
          )}
        </form>
      )}
      <Section title="Courses">
        {courses.data && courses.data.length === 0 ? (
          <p className="text-muted-foreground text-sm">No courses yet.</p>
        ) : (
          <ul className="-my-1 divide-y" aria-label="Course list">
            {(courses.data ?? []).map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{c.name}</span>{' '}
                  <span className="text-muted-foreground">· {c.provider}</span>
                </span>
                <span className="text-muted-foreground text-xs">
                  {c.skill_name} up to {c.reaches_level}/5 · {c.hours} h · {usd(c.cost_usd)} ·{' '}
                  {c.learners} learning
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Who is learning what">
        {overview.data && overview.data.assignments.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nobody has a course yet.</p>
        ) : (
          <ul className="-my-1 divide-y" aria-label="Assignments">
            {(overview.data?.assignments ?? []).map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span>
                  <Link to={`/employees/${a.employee_id}`} className="font-medium hover:underline">
                    {a.full_name}
                  </Link>{' '}
                  <span className="text-muted-foreground">· {a.course.name}</span>
                  {a.overdue && (
                    <StatusBadge tone="attention" className="ml-2">
                      Overdue
                    </StatusBadge>
                  )}
                </span>
                <select
                  className={SELECT}
                  aria-label={`Status of ${a.course.name} for ${a.full_name}`}
                  value={a.status}
                  onChange={(e) =>
                    update.mutate({ id: a.id, status: e.target.value as LearningStatus })
                  }
                >
                  {(Object.keys(STATUS_LABELS) as LearningStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
