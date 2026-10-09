import { CheckCircle2, Circle, Clock, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router'

import type { DealIn, DealStatus, Level, MonthNumbers } from '@/api/types'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import { useSkills } from '@/features/newTask/api'
import { usd } from '@/features/planning/PlanningPage'
import {
  useAddDeal,
  useDeals,
  useDeleteDeal,
  useDemand,
  useMyProfile,
  useRequestSkill,
  useSavings,
  useSaveMyPreferences,
  useSetup,
  useUpdateDeal,
  useWorkingOn,
} from '@/features/workforce/api'
import { date, domainLabel } from '@/lib/format'

const SELECT = 'border-input bg-background h-9 rounded-md border px-2 text-sm'
const LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']

function inDays(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface space-y-3 rounded-xl border p-4" aria-label={title}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

const DEAL_STATUS: Record<DealStatus, string> = { open: 'Open', won: 'Won', lost: 'Lost' }

/** Deals sales is chasing and the skills they would need in 30/60/90 days (ADR 032). */
export function PipelineTab() {
  const deals = useDeals()
  const demand = useDemand()
  const skills = useSkills()
  const add = useAddDeal()
  const update = useUpdateDeal()
  const remove = useDeleteDeal()
  const [window, setWindow] = useState(0)
  const [form, setForm] = useState({
    name: '',
    win: 50,
    start: inDays(30),
    weeks: 12,
    title: 'Engineer',
    level: 'L3' as Level,
    count: 2,
  })
  const [skillIds, setSkillIds] = useState<string[]>([])
  const name = (id: string) => skills.data?.find((s) => s.id === id)?.name ?? id
  const submit = () => {
    const body: DealIn = {
      name: form.name.trim(),
      client_code: null,
      win_pct: form.win,
      start_date: form.start,
      weeks: form.weeks,
      roles: [
        { title: form.title.trim(), level: form.level, count: form.count, skill_ids: skillIds },
      ],
    }
    add.mutate(body, {
      onSuccess: () => {
        setForm({ ...form, name: '' })
        setSkillIds([])
      },
    })
  }
  const shown = demand.data?.windows[window]
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground max-w-3xl text-sm">
        Add the deals sales is chasing with the people they would need. Each counts by its chance of
        winning; won deals count fully. The forecast shows which skills you will be short of, so you
        can train or hire before the deal closes.
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <form
          aria-label="Add a deal"
          className="bg-surface space-y-3 rounded-xl border p-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="deal-name">Deal</Label>
            <Input
              id="deal-name"
              placeholder="e.g. Claims platform rebuild"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="deal-win">Win %</Label>
              <Input
                id="deal-win"
                type="number"
                min={0}
                max={100}
                value={form.win}
                onChange={(e) =>
                  setForm({ ...form, win: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-start">Starts</Label>
              <Input
                id="deal-start"
                type="date"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-weeks">Weeks</Label>
              <Input
                id="deal-weeks"
                type="number"
                min={1}
                max={104}
                value={form.weeks}
                onChange={(e) =>
                  setForm({ ...form, weeks: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </div>
          </div>
          <fieldset className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-xs font-semibold">People needed</legend>
            <div className="flex flex-wrap gap-2">
              <Input
                aria-label="Role"
                className="w-36"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <Input
                aria-label="How many"
                type="number"
                min={1}
                max={20}
                className="w-16"
                value={form.count}
                onChange={(e) =>
                  setForm({
                    ...form,
                    count: Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
              />
              <select
                aria-label="Level"
                className={SELECT}
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value as Level })}
              >
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            <select
              aria-label="Add a skill the deal needs"
              className={`${SELECT} w-full`}
              value=""
              onChange={(e) =>
                e.target.value &&
                !skillIds.includes(e.target.value) &&
                setSkillIds([...skillIds, e.target.value])
              }
            >
              <option value="">Add a skill…</option>
              {(skills.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="flex flex-wrap gap-1">
              {skillIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="bg-muted rounded-full px-2 py-0.5 text-xs"
                  onClick={() => setSkillIds(skillIds.filter((x) => x !== id))}
                >
                  {name(id)} ×
                </button>
              ))}
            </p>
          </fieldset>
          <Button
            type="submit"
            disabled={
              form.name.trim().length < 2 ||
              !form.title.trim() ||
              skillIds.length === 0 ||
              add.isPending
            }
          >
            <Plus aria-hidden /> Add deal
          </Button>
          {add.isError && <ErrorState error={add.error} />}
        </form>
        <div className="space-y-4">
          <Section title="Deals">
            {deals.data && deals.data.length === 0 ? (
              <p className="text-muted-foreground text-sm">No deals yet.</p>
            ) : (
              <ul className="-my-1 divide-y" aria-label="Deal list">
                {(deals.data ?? []).map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium">{d.name}</span>{' '}
                      <span className="text-muted-foreground text-xs">
                        · {d.people} people from {date(d.start_date)} · {d.win_pct}% likely
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <select
                        className={SELECT}
                        aria-label={`Status of ${d.name}`}
                        value={d.status}
                        onChange={(e) =>
                          update.mutate({ id: d.id, status: e.target.value as DealStatus })
                        }
                      >
                        {(Object.keys(DEAL_STATUS) as DealStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {DEAL_STATUS[s]}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${d.name}`}
                        onClick={() => remove.mutate(d.id)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Skills you will need">
            {demand.isPending ? (
              <Skeleton className="h-32 w-full" />
            ) : demand.isError ? (
              <ErrorState error={demand.error} />
            ) : (
              <>
                <div className="flex gap-1" role="group" aria-label="Within">
                  {demand.data.windows.map((w, i) => (
                    <Button
                      key={w.days}
                      size="sm"
                      variant={i === window ? 'default' : 'outline'}
                      onClick={() => setWindow(i)}
                    >
                      {w.days} days
                    </Button>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" aria-label="Skill demand">
                    <thead>
                      <tr className="text-muted-foreground border-b text-left text-xs">
                        <th className="py-1.5 font-medium">Skill</th>
                        <th className="py-1.5 text-right font-medium">Open tasks</th>
                        <th className="py-1.5 text-right font-medium">From deals</th>
                        <th className="py-1.5 text-right font-medium">Free people</th>
                        <th className="py-1.5 text-right font-medium">Short by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(shown?.skills ?? []).map((s) => (
                        <tr key={s.skill_id} className="border-b last:border-0">
                          <td className="py-1.5">{s.name}</td>
                          <td className="py-1.5 text-right tabular-nums">{s.open_tasks}</td>
                          <td className="py-1.5 text-right tabular-nums">
                            {s.expected_from_deals}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{s.free_people}</td>
                          <td className="py-1.5 text-right tabular-nums">
                            {s.shortage > 0 ? (
                              <StatusBadge tone="attention">{s.shortage}</StatusBadge>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

function monthInput(d = new Date()): string {
  return d.toISOString().slice(0, 7)
}

function Numbers({ m, title }: { m: MonthNumbers; title: string }) {
  return (
    <Section title={title}>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {[
          ['Tasks filled', String(m.tasks_filled)],
          ['Filled from inside', String(m.filled_inside)],
          ['External hires', String(m.hires)],
          ['Days to fill (average)', m.avg_days_to_fill == null ? '—' : String(m.avg_days_to_fill)],
          ['Billing placed a week', usd(m.weekly_bill_placed_usd)],
          ['Margin placed a week', usd(m.weekly_margin_placed_usd)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-muted-foreground text-xs">{k}</dt>
            <dd className="text-lg font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

/** What the product saved this month, for the business case (ADR 032). */
export function SavingsPage() {
  const role = useAuth().user?.role
  const [month, setMonth] = useState(monthInput())
  const q = useSavings(`${month}-01`)
  if (role === 'viewer' || role === 'employee') return <Navigate to="/" replace />
  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings"
        description="Work filled from inside instead of hiring, how fast, and the margin it brings, against the month before."
        actions={
          <Input
            aria-label="Month"
            type="month"
            className="w-40"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        }
      />
      {q.isPending ? (
        <Skeleton className="h-60 w-full" />
      ) : q.isError ? (
        <ErrorState error={q.error} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" aria-label="Headline">
            <StatusBadge tone="ready">
              {usd(q.data.hire_cost_avoided_usd)} hiring cost avoided
            </StatusBadge>
            <StatusBadge tone="neutral">{q.data.bench_people_now} on the bench now</StatusBadge>
            <StatusBadge tone="attention">
              {usd(q.data.weekly_idle_cost_now_usd)} idle a week
            </StatusBadge>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Numbers m={q.data.this_month} title="This month" />
            <Numbers m={q.data.last_month} title="Month before" />
          </div>
          <ul className="text-muted-foreground list-disc pl-5 text-xs">
            {q.data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** What a new company still has to do before matching is useful (ADR 032). */
export function SetupPage() {
  const role = useAuth().user?.role
  const q = useSetup()
  if (role !== 'admin' && role !== 'hr') return <Navigate to="/" replace />
  return (
    <div className="space-y-6">
      <PageHeader
        title="Setup"
        description="The steps to get a company ready. Each links to the screen that does it."
      />
      {q.isPending ? (
        <Skeleton className="h-60 w-full" />
      ) : q.isError ? (
        <ErrorState error={q.error} />
      ) : (
        <section aria-label="Setup steps" className="space-y-3">
          <p className="text-sm">
            {q.data.done} of {q.data.total} done
          </p>
          <ol className="bg-surface divide-y rounded-xl border">
            {q.data.steps.map((s) => (
              <li key={s.key} className="flex items-start gap-3 px-4 py-3">
                {s.done ? (
                  <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0" aria-label="Done" />
                ) : (
                  <Circle
                    className="text-muted-foreground mt-0.5 size-5 shrink-0"
                    aria-label="To do"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <Link to={s.link} className="font-medium hover:underline">
                    {s.title}
                  </Link>
                  <p className="text-muted-foreground text-xs">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

/** Hours, latest lines and skills mentioned, from imported timesheets (ADR 032). */
export function WorkingOnPanel({ employeeId }: { employeeId: string }) {
  const q = useWorkingOn(employeeId)
  return (
    <section className="bg-surface space-y-2 rounded-xl border p-4" aria-label="Working on now">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Clock className="size-4" aria-hidden /> Working on now
      </h2>
      {q.data && q.data.last_logged === null ? (
        <p className="text-muted-foreground text-sm">No timesheets imported yet.</p>
      ) : q.data ? (
        <>
          <p className="text-sm">
            {q.data.hours_last_14_days} hours on {q.data.days_logged} days in the last two weeks
            {q.data.skills_mentioned.length > 0 &&
              ` · mentions ${q.data.skills_mentioned.join(', ')}`}
          </p>
          <ul className="space-y-1.5 text-sm" aria-label="Latest timesheet lines">
            {q.data.latest.map((l, i) => (
              <li key={i}>
                <span className="text-muted-foreground text-xs">
                  {date(l.work_date)} · {l.hours} h
                </span>
                <span className="block">{l.description}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}

/** An employee's own page: profile, learning, preferences, career (ADR 032). */
export function MyProfilePage() {
  const q = useMyProfile()
  const skills = useSkills()
  const ask = useRequestSkill()
  const savePrefs = useSaveMyPreferences()
  const [skill, setSkill] = useState('')
  const [level, setLevel] = useState(3)
  if (q.isPending) return <Skeleton className="h-96 w-full" />
  if (q.isError) return <ErrorState error={q.error} />
  const p = q.data
  return (
    <div className="space-y-6">
      <PageHeader
        title={p.full_name}
        description={`${p.designation} · ${p.level}. Your profile as managers see it when matching.`}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="My skills">
          <ul className="flex flex-wrap gap-1.5" aria-label="Skills on my profile">
            {p.skills.map((s) => (
              <li key={s.skill_id} className="bg-muted rounded-full px-2 py-0.5 text-xs">
                {s.name} {s.proficiency}/5
              </li>
            ))}
          </ul>
          {p.pending_skills.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Waiting for HR: {p.pending_skills.map((s) => s.skill_name).join(', ')}
            </p>
          )}
          <form
            aria-label="Tell HR about a skill"
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              ask.mutate({ skill_id: skill, proficiency: level }, { onSuccess: () => setSkill('') })
            }}
          >
            <select
              aria-label="Skill"
              className={SELECT}
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
            >
              <option value="">A skill you have…</option>
              {(skills.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Your level"
              className={SELECT}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}/5
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" disabled={!skill || ask.isPending}>
              Send to HR
            </Button>
          </form>
          {ask.isError && <ErrorState error={ask.error} />}
          {ask.isSuccess && (
            <p role="status" className="text-sm">
              Sent. HR confirms it on your profile.
            </p>
          )}
        </Section>
        <Section title="Work I would like">
          <p className="text-sm">
            {p.preferences
              ? [
                  p.preferences.domains.map(domainLabel).join(', '),
                  p.preferences.skill_names.join(', '),
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Nothing chosen.'
              : 'Nothing chosen.'}
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Areas I would like">
            {(
              [
                'bfsi',
                'healthcare',
                'retail',
                'manufacturing',
                'public_sector',
                'education',
                'telecom',
                'logistics',
              ] as const
            ).map((d) => {
              const on = p.preferences?.domains.includes(d) ?? false
              return (
                <Button
                  key={d}
                  size="sm"
                  variant={on ? 'default' : 'outline'}
                  aria-pressed={on}
                  onClick={() => {
                    const now = p.preferences?.domains ?? []
                    savePrefs.mutate({
                      domains: on ? now.filter((x) => x !== d) : [...now, d],
                      skill_ids: p.preferences?.skill_ids ?? [],
                      locations: p.preferences?.locations ?? [],
                      consent: true,
                    })
                  }}
                >
                  {domainLabel(d)}
                </Button>
              )
            })}
          </div>
          <p className="text-muted-foreground text-xs">
            Managers see this next to a match; it never changes your score.
          </p>
        </Section>
        <Section title="My learning">
          {p.learning.length === 0 ? (
            <p className="text-muted-foreground text-sm">No courses yet. Ask your manager or HR.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {p.learning.map((a) => (
                <li key={a.id}>
                  {a.course.name}{' '}
                  <span className="text-muted-foreground text-xs">
                    · {a.status.replace('_', ' ')}
                    {a.due_date && ` · due ${date(a.due_date)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="What to learn next">
          {p.career && p.career.paths.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {p.career.paths.slice(0, 3).map((path, i) => (
                <li key={i}>
                  {path.skills
                    .map((s) => `${s.name} (${s.has_level} → ${s.needs_level})`)
                    .join(' + ')}{' '}
                  <span className="text-muted-foreground text-xs">opens {path.tasks} tasks</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No suggestions yet.</p>
          )}
        </Section>
      </div>
      <WorkingOnPanel employeeId={p.employee_id} />
    </div>
  )
}

const GUIDE: { title: string; roles: string[]; steps: string[] }[] = [
  {
    title: 'Find someone for a role',
    roles: ['admin', 'resource_manager'],
    steps: [
      'Tasks → New task: describe the role in plain words, check the fields, save.',
      'Open the task and press Run matching. In a few seconds you get a ranked list with reasons.',
      'Accept or reject each person, with a reason. Your decisions teach the system what you value.',
      'Nobody fits? Ask HR from the task; they send outside candidates back to you.',
      'Many roles at once? Tasks → From a client request: paste the request, check the drafts, create.',
    ],
  },
  {
    title: 'Plan ahead',
    roles: ['admin', 'resource_manager', 'hr'],
    steps: [
      'Planning → Bench: who is free and what idle time costs. Rolling off: who frees up soon.',
      'Planning → Pipeline: add the deals sales is chasing; see which skills you will be short of.',
      'Planning → Team builder: a whole team within a budget. Capacity: free people per practice and month.',
      'Planning → Key people and Fair opportunity: who the work depends on, and who is being missed.',
      'Find people: ask in plain words, e.g. “senior React people free next month”.',
    ],
  },
  {
    title: 'Keep people data right (HR)',
    roles: ['admin', 'hr'],
    steps: [
      'Import: employees, skills and timesheets (CSV or Excel). Unknown values are mapped once.',
      'Company → Data quality: whose profiles to fix first. Skills: add missing skills and other names.',
      'A person’s page: confirm suggested skills, record preferences with consent, assign courses.',
      'Candidates: upload resumes (personal details are removed first), check fit, suggest interview questions.',
      'Setup: the checklist for a new company.',
    ],
  },
  {
    title: 'Your own profile',
    roles: ['employee'],
    steps: [
      'My profile shows what managers see when matching.',
      'Tell HR about a skill you have; they confirm it.',
      'Choose the kind of work you would like; managers see it next to a match.',
    ],
  },
]

/** How to use the product, for the signed-in role (ADR 032). */
export function HelpPage() {
  const role = useAuth().user?.role ?? ''
  const mine = GUIDE.filter((g) => g.roles.includes(role))
  return (
    <div className="space-y-6">
      <PageHeader
        title="Help"
        description="How to get things done. The app only recommends; people always make the final call."
      />
      {mine.length === 0 ? (
        <EmptyState title="Nothing to set up">
          You can look around; ask an admin for more access.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {mine.map((g) => (
            <Section key={g.title} title={g.title}>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                {g.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </Section>
          ))}
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Privacy: names, contact details and personal attributes never reach the AI; it only reads
        text into fixed fields and never ranks people. Everything is audited.
      </p>
    </div>
  )
}
