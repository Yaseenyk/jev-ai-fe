import { ArrowRight, Loader2, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router'

import type {
  BenchPerson,
  DashboardPointers,
  Level,
  Margin,
  ProposedPerson,
  SkillGap,
  StaffedTask,
} from '@/api/types'
import { type Column, DataTable, Pagination } from '@/components/DataTable'
import { FilterBar, FilterSelect, Segmented } from '@/components/FilterBar'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { StatusBadge, type Tone } from '@/components/StatusBadge'
import { useUrlState } from '@/components/useUrlState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import { usePointers } from '@/features/dashboard/api'
import { RollOffsTab } from '@/features/planning/RollOffsTab'
import { WhatIfTab } from '@/features/planning/WhatIfTab'
import {
  CapacityTab,
  KeyPeopleTab,
  LearningTab,
  OpportunityTab,
  TeamBuilderTab,
} from '@/features/workforce/PlanningTabs'
import { PipelineTab } from '@/features/workforce/MorePages'
import { BenchPlanTab } from '@/features/workforce/BenchPlanTab'
import { useBench, useSkillGaps, useStaffing, useStartRuns } from '@/features/planning/api'
import { useTasks } from '@/features/tasks/api'
import { BAND_LABELS, LEVEL_TITLES, chance, date, percent } from '@/lib/format'
import { UnitBadge } from '@/features/org/UnitBadge'
import { showBilling } from '@/lib/features'

const HORIZONS = [
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '6 months' },
]

export const usd = (n: number): string => `$${n.toLocaleString('en-US')}`

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** One planning tool: a plain question on the hub, and how to use it once opened. */
interface Tool {
  tab: string
  group: string
  title: string
  question: string
  what: string
  steps: [string, string, string]
  number?: (p: DashboardPointers) => string
  view: () => ReactNode
}

const GROUPS = ['People without work', 'Skills', 'Staff a project', 'Look ahead']

const TOOLS: Tool[] = [
  {
    tab: 'bench',
    group: 'People without work',
    title: 'Who is free',
    question: 'Who is free now or soon?',
    what: 'Everyone with free time in the period you choose, and the open tasks each of them could take.',
    steps: [
      'Search for a name, or filter by level or by "can take a task".',
      'Click a column title to sort, for example by best task match.',
      'Click a person to see their profile, or a task button to open that task and decide.',
    ],
    number: (p) => `${p.bench_free_now} free now`,
    view: () => <BenchTab />,
  },
  {
    tab: 'benchplan',
    group: 'People without work',
    title: 'Next step for each free person',
    question: 'What should each free person do next?',
    what: 'One suggested step for everyone free within two weeks: a task to propose them for, a skill to learn, or a profile to complete.',
    steps: [
      'Start with people whose step is to propose them for a task.',
      'Take the step: it holds the person for the task or plans the training.',
      'Open the task to accept or reject them; nothing is assigned automatically.',
    ],
    number: (p) => `${p.bench_with_fit} could take a task`,
    view: () => <BenchPlanTab />,
  },
  {
    tab: 'rolloffs',
    group: 'People without work',
    title: 'Who finishes soon',
    question: 'Whose current work ends soon?',
    what: 'People whose project ends in the period, the open tasks they could move to, and the one skill that would open the closest task.',
    steps: [
      'Choose "No next task" to see who needs help first.',
      'Hold a person for a task they fit, so nobody else books them.',
      'Or plan training in the one missing skill before their work ends.',
    ],
    number: (p) => `${p.rolling_off} in 30 days`,
    view: () => <RollOffsTab />,
  },
  {
    tab: 'skills',
    group: 'Skills',
    title: 'Skills we are short of',
    question: 'Which skills are we short of?',
    what: 'Must-have skills of upcoming tasks, against the free people who have them.',
    steps: [
      'Look at the Shortage rows first; click a column title to sort.',
      'See who is closest to each skill: train them before hiring.',
      'If nobody is close, ask HR for outside candidates from the task.',
    ],
    number: (p) => `${p.skill_gaps.length} short in 30 days`,
    view: () => <SkillGapsTab />,
  },
  {
    tab: 'keypeople',
    group: 'Skills',
    title: 'Key people',
    question: 'Which work depends on only one or two people?',
    what: 'Skills only one or two experts hold, and people who alone carry a skill on running work, with the closest backups.',
    steps: [
      'Look at high-risk people first.',
      'Pick a backup from the people one level short of expert.',
      'Assign the backup a course or pair them on the work.',
    ],
    number: (p) => `${p.key_person_high} at high risk`,
    view: () => <KeyPeopleTab />,
  },
  {
    tab: 'learning',
    group: 'Skills',
    title: 'Learning',
    question: 'Who is learning what?',
    what: 'Courses and who is assigned to them. Train instead of hire.',
    steps: [
      'Add a course for a skill open work needs.',
      "Assign it from a person's page.",
      'When it is done, HR confirms the new skill on their profile.',
    ],
    view: () => <LearningTab />,
  },
  {
    tab: 'staffing',
    group: 'Staff a project',
    title: 'Staff several tasks',
    question: 'Who should take each task of a project?',
    what: 'Pick the open tasks of one project and get one proposed person per task, without booking anyone twice.',
    steps: [
      'Tick the tasks of one project on the left.',
      'Click "Propose a team".',
      'Open each task to accept the proposed person.',
    ],
    view: () => <StaffingTab />,
  },
  {
    tab: 'team',
    group: 'Staff a project',
    title: 'Build a team',
    question: 'Who would make the best team for new work?',
    what: 'Describe the roles and skills you need and get the best free people for each role.',
    steps: [
      'Add each role with its skills and level.',
      'Set the start date and click to build the team.',
      'Open the people to check them before you propose them.',
    ],
    view: () => <TeamBuilderTab />,
  },
  {
    tab: 'whatif',
    group: 'Staff a project',
    title: 'Can we take this work?',
    question: 'Could we staff a project we might win?',
    what: 'Try a project before it exists: who would fit each role, and when they are free.',
    steps: [
      'Enter the roles, skills, level and start date.',
      'Check how many roles we could fill from inside.',
      'If it looks good, create the tasks when the work is won.',
    ],
    view: () => <WhatIfTab />,
  },
  {
    tab: 'capacity',
    group: 'Look ahead',
    title: 'Free time by month',
    question: 'How much free time will each practice have?',
    what: 'Free people per practice for the coming months. Darker cells mean more of the practice is idle.',
    steps: [
      'Choose how many months to look ahead.',
      'Find the dark cells: practices that will be idle.',
      'Look for work for them now, or move people between practices.',
    ],
    view: () => <CapacityTab />,
  },
  {
    tab: 'pipeline',
    group: 'Look ahead',
    title: 'Sales pipeline',
    question: 'What work is coming from sales?',
    what: 'Deals that may start soon, the people and skills they need, and whether we have them.',
    steps: [
      'Add a deal with its win chance, start and the people needed.',
      'See the skills demand against the people free by then.',
      'Plan hiring or training for skills that will be short.',
    ],
    view: () => <PipelineTab />,
  },
  {
    tab: 'opportunity',
    group: 'Look ahead',
    title: 'Fair opportunity',
    question: 'Is good work shared fairly?',
    what: 'People who have stayed on one client for a long time, or rarely get picked, and may be ready for a change.',
    steps: [
      'Read through the list when a new task opens.',
      'Open a person to see what they could take next.',
      'Consider them for the next task that fits.',
    ],
    view: () => <OpportunityTab />,
  },
]

export default function PlanningPage() {
  const role = useAuth().user?.role
  const [f] = useUrlState({ tab: '' })
  if (role === 'viewer') return <Navigate to="/tasks" replace />
  const tool = TOOLS.find((t) => t.tab === f.tab)
  return tool ? <ToolView tool={tool} /> : <Hub />
}

function Hub() {
  const pointers = usePointers()
  return (
    <div className="space-y-8">
      <PageHeader
        title="Planning"
        description="Pick what you want to find out. Every tool suggests; you decide on each task."
      />
      {GROUPS.map((group) => (
        <section key={group} aria-labelledby={`group-${group}`} className="space-y-3">
          <h2 id={`group-${group}`} className="text-base font-semibold">
            {group}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {TOOLS.filter((t) => t.group === group).map((t) => (
              <li key={t.tab}>
                <Link
                  to={`/planning?tab=${t.tab}`}
                  className="bg-surface hover:border-primary/50 focus-visible:ring-ring group flex h-full flex-col gap-2 rounded-xl border p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="font-semibold">{t.question}</span>
                  <span className="text-muted-foreground text-sm">{t.what}</span>
                  <span className="mt-auto flex items-end justify-between gap-3 pt-2">
                    <span className="text-lg font-semibold tabular-nums">
                      {t.number && pointers.data ? t.number(pointers.data) : ''}
                    </span>
                    <span className="text-primary inline-flex items-center gap-1 text-sm font-medium group-hover:underline">
                      Open <ArrowRight className="size-4" aria-hidden />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ToolView({ tool }: { tool: Tool }) {
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/planning', label: 'All planning tools' }}
        title={tool.question}
        description={tool.what}
      />
      <section aria-label="How to use" className="bg-accent/40 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">How to use</h2>
        <ol className="mt-2 grid gap-2 text-sm md:grid-cols-3">
          {tool.steps.map((s, i) => (
            <li key={s} className="flex gap-2">
              <span className="bg-primary text-primary-foreground grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>
      {tool.view()}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface rounded-xl border p-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="text-muted-foreground mt-0.5 text-xs">{hint}</dd>}
    </div>
  )
}

const LEVEL_OPTIONS = (['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as Level[]).map((l) => ({
  value: l,
  label: `${l} · ${LEVEL_TITLES[l]}`,
}))
// The server's sort keys; "free" and "fit" put the most first, so their arrow points down.
const MOST_FIRST = new Set(['free', 'fit'])

function BenchTab() {
  const [f, set] = useUrlState({
    horizon: '90',
    page: '1',
    size: '25',
    q: '',
    level: '',
    fit: '',
    sort: 'free',
    desc: '',
  })
  const page = Math.max(1, Number(f.page) || 1)
  const size = Number(f.size) || 25
  const bench = useBench(Number(f.horizon), page, size, {
    q: f.q,
    level: f.level,
    hasFit: f.fit,
    sort: f.sort,
    descending: f.desc === '1',
  })

  const columns: Column<BenchPerson>[] = [
    {
      key: 'person',
      header: 'Person',
      sortKey: 'name',
      cell: (p) => (
        <div className="min-w-0">
          <p className="font-medium">{p.full_name}</p>
          <p className="text-muted-foreground text-xs">
            {p.employee_code} · {p.designation} · {p.level}
          </p>
          <UnitBadge unit={p.business_unit} />
        </div>
      ),
    },
    {
      key: 'free',
      header: 'Free now',
      sortKey: 'free',
      cell: (p) =>
        p.on_leave_today ? (
          <StatusBadge tone="neutral">On leave</StatusBadge>
        ) : (
          <StatusBadge
            tone={p.free_now_pct === 100 ? 'attention' : p.free_now_pct > 0 ? 'info' : 'neutral'}
          >
            {p.free_now_pct}%
          </StatusBadge>
        ),
    },
    {
      key: 'from',
      header: 'Fully free from',
      sortKey: 'from',
      cell: (p) => <span className="whitespace-nowrap">{date(p.fully_free_from)}</span>,
    },
    ...(showBilling()
      ? [
          {
            key: 'cost',
            header: 'Idle cost / week',
            align: 'right' as const,
            cell: (p: BenchPerson) => (
              <span className="tabular-nums">{usd(p.weekly_idle_cost_usd)}</span>
            ),
          },
        ]
      : []),
    {
      key: 'next',
      header: 'Best task match',
      sortKey: 'fit',
      cell: (p) =>
        p.best_tasks.length === 0 ? (
          <span className="text-muted-foreground text-xs">No open task fits yet</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {p.best_tasks.map((t) => (
              <Button
                key={t.task_id}
                asChild
                variant="outline"
                size="sm"
                className="h-auto py-1 text-xs"
              >
                <Link
                  to={`/tasks/${t.task_id}`}
                  onClick={(e) => e.stopPropagation()}
                  title={`${t.title}, starts ${date(t.start_date)}`}
                >
                  Open {t.task_code}
                  <span className="text-muted-foreground">
                    {percent(t.must_have_coverage)} match
                  </span>
                </Link>
              </Button>
            ))}
          </div>
        ),
    },
  ]

  const chips = [
    ...(f.q ? [{ label: `"${f.q}"`, onRemove: () => set({ q: '' }) }] : []),
    ...(f.level ? [{ label: `Level ${f.level}`, onRemove: () => set({ level: '' }) }] : []),
    ...(f.fit
      ? [
          {
            label: f.fit === 'true' ? 'Can take a task' : 'No task fits yet',
            onRemove: () => set({ fit: '' }),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">Free now or within:</p>
        <Segmented
          label="Look ahead"
          value={f.horizon}
          onChange={(horizon) => set({ horizon })}
          options={HORIZONS}
        />
      </div>
      {bench.data && (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Free now"
            value={String(bench.data.summary.free_now)}
            hint={`${bench.data.summary.free_now_fte} full-time people`}
          />
          {showBilling() && (
            <Stat
              label="Idle cost per week"
              value={usd(bench.data.summary.weekly_idle_cost_usd)}
              hint="At the rate card's cost"
            />
          )}
          <Stat
            label="Freeing within 30 days"
            value={String(bench.data.summary.freeing_30)}
            hint={`${bench.data.summary.freeing_60} within 60`}
          />
          <Stat
            label="Freeing within 90 days"
            value={String(bench.data.summary.freeing_90)}
            hint="Plan their next task now"
          />
        </dl>
      )}
      <FilterBar
        search={{
          value: f.q,
          onChange: (q) => set({ q }),
          placeholder: 'Search name, code or job title',
          label: 'Search people',
        }}
        filters={
          <>
            <FilterSelect
              label="Level"
              value={f.level}
              onChange={(level) => set({ level })}
              allLabel="All levels"
              options={LEVEL_OPTIONS}
              className="w-44"
            />
            <FilterSelect
              label="Task match"
              value={f.fit}
              onChange={(fit) => set({ fit })}
              allLabel="Any task match"
              options={[
                { value: 'true', label: 'Can take a task' },
                { value: 'false', label: 'No task fits yet' },
              ]}
              className="w-44"
            />
          </>
        }
        chips={chips}
        onClear={() => set({ q: '', level: '', fit: '' })}
      />
      {bench.isError ? (
        <ErrorState error={bench.error} />
      ) : !bench.data ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : (
        <>
          <DataTable
            label="Bench"
            rows={bench.data.items}
            columns={columns}
            rowKey={(p) => p.employee_id}
            rowHref={(p) => `/planning/people/${p.employee_id}`}
            sort={f.sort}
            descending={MOST_FIRST.has(f.sort) ? f.desc !== '1' : f.desc === '1'}
            onSort={(sort) => set({ sort, desc: sort === f.sort && f.desc !== '1' ? '1' : '' })}
            empty={{
              title: chips.length
                ? 'Nobody matches these filters'
                : 'Nobody is free in this period',
              body: chips.length
                ? 'Clear the filters to see everyone.'
                : 'Everyone is fully booked.',
            }}
          />
          {bench.data.total > 0 && (
            <Pagination
              total={bench.data.total}
              page={page}
              pageSize={size}
              noun="people"
              onPage={(p) => set({ page: String(p) })}
              onPageSize={(n) => set({ size: String(n) })}
            />
          )}
        </>
      )}
    </div>
  )
}

const GAP_TONE: Record<SkillGap['status'], Tone> = {
  shortage: 'danger',
  tight: 'attention',
  covered: 'ready',
}
const GAP_LABEL: Record<SkillGap['status'], string> = {
  shortage: 'Shortage',
  tight: 'Tight',
  covered: 'Covered',
}
const GAP_ORDER: Record<SkillGap['status'], number> = { shortage: 0, tight: 1, covered: 2 }

function SkillGapsTab() {
  const [f, set] = useUrlState({ horizon: '90', show: 'needs', q: '' })
  const gaps = useSkillGaps(Number(f.horizon))
  if (gaps.isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (gaps.isError) return <ErrorState error={gaps.error} />
  const all = gaps.data.gaps
  const needs = all.filter((g) => g.status !== 'covered')
  const needle = f.q.trim().toLowerCase()
  const rows = (f.show === 'needs' ? needs : all).filter(
    (g) => !needle || g.skill_name.toLowerCase().includes(needle),
  )

  const columns: Column<SkillGap>[] = [
    {
      key: 'skill',
      header: 'Skill',
      sortValue: (g) => g.skill_name.toLowerCase(),
      cell: (g) => <p className="font-medium">{g.skill_name}</p>,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (g) => GAP_ORDER[g.status],
      cell: (g) => <StatusBadge tone={GAP_TONE[g.status]}>{GAP_LABEL[g.status]}</StatusBadge>,
    },
    {
      key: 'need',
      header: 'Tasks needing it',
      sortValue: (g) => g.tasks_needing,
      cell: (g) => (
        <div>
          <span className="tabular-nums">{g.tasks_needing}</span>
          <p className="text-muted-foreground text-xs">{g.task_codes.join(', ')}</p>
        </div>
      ),
    },
    {
      key: 'free',
      header: 'Free people with it',
      align: 'right',
      sortValue: (g) => g.available_now,
      cell: (g) => <span className="tabular-nums">{g.available_now}</span>,
    },
    {
      key: 'closest',
      header: 'Closest to it (train first)',
      cell: (g) =>
        g.closest.length === 0 ? (
          <span className="text-muted-foreground text-xs">
            {g.status === 'covered' ? 'Enough people have it' : 'Nobody close: hire'}
          </span>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {g.closest.map((c) => (
              <li key={c.employee_id}>
                <Link
                  to={`/planning/people/${c.employee_id}`}
                  className="text-primary font-medium hover:underline"
                >
                  {c.full_name}
                </Link>{' '}
                <span className="text-muted-foreground">{c.why}</span>
              </li>
            ))}
          </ul>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {plural(gaps.data.open_tasks, 'open task')} starting within:
        </p>
        <Segmented
          label="Look ahead"
          value={f.horizon}
          onChange={(horizon) => set({ horizon })}
          options={HORIZONS}
        />
      </div>
      <FilterBar
        search={{
          value: f.q,
          onChange: (q) => set({ q }),
          placeholder: 'Search a skill',
          label: 'Search skills',
        }}
        filters={
          <Segmented
            label="Show"
            value={f.show}
            onChange={(show) => set({ show })}
            options={[
              { value: 'needs', label: 'Needs action', count: needs.length },
              { value: 'all', label: 'All skills', count: all.length },
            ]}
          />
        }
      />
      <DataTable
        label="Skill gaps"
        rows={rows}
        columns={columns}
        rowKey={(g) => g.skill_id}
        empty={{
          title: needle ? 'No skill matches your search' : 'No skill is short',
          body: needle
            ? 'Try another name, or choose "All skills".'
            : 'Every must-have skill of upcoming tasks has at least twice as many free people as tasks. Choose "All skills" to see them.',
        }}
      />
    </div>
  )
}

export function MarginBadge({ margin }: { margin: Margin }) {
  return (
    <StatusBadge tone={margin.below_target ? 'attention' : 'ready'}>
      {margin.margin_pct}% margin{margin.below_target ? ' (below target)' : ''}
    </StatusBadge>
  )
}

function PersonLine({ p }: { p: ProposedPerson }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link to={`/planning/people/${p.employee_id}`} className="font-medium hover:underline">
        {p.full_name}
      </Link>
      <span className="text-muted-foreground text-xs">
        {p.employee_code} · {p.level}
        {showBilling() && ` · band ${p.cost_band}`}
      </span>
      <UnitBadge unit={p.business_unit} />
      <StatusBadge tone={p.band === 'shortlist' ? 'ready' : 'info'}>
        {BAND_LABELS[p.band]} · {chance(p.score)}
      </StatusBadge>
      {showBilling() && <MarginBadge margin={p.margin} />}
    </div>
  )
}

function StaffingTab() {
  const tasks = useTasks({ q: '', priority: '', domain: '' }, 'open')
  const staffing = useStaffing()
  const startRuns = useStartRuns()
  const [picked, setPicked] = useState<string[]>([])
  const NO_RUN = 'Run matching for this task first.'
  const needRun = (staffing.data?.tasks ?? [])
    .filter((t) => t.unfilled_reason === NO_RUN)
    .map((t) => t.task_id)

  if (tasks.isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (tasks.isError) return <ErrorState error={tasks.error} />
  const open = tasks.data.items
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(0, 30)))

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <section className="bg-surface space-y-3 rounded-xl border p-4" aria-label="Tasks to staff">
        <h2 className="text-sm font-semibold">Tasks to staff together</h2>
        <p className="text-muted-foreground text-xs">
          Pick the tasks of one project (up to 30). Each needs a finished matching run.
        </p>
        {open.length === 0 ? (
          <EmptyState title="No open tasks" />
        ) : (
          <ul className="max-h-96 space-y-1 overflow-y-auto pr-1">
            {open.map((t) => (
              <li key={t.id}>
                <label className="hover:bg-muted flex cursor-pointer items-start gap-2 rounded-md p-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={picked.includes(t.id)}
                    onChange={() => toggle(t.id)}
                  />
                  <span>
                    <span className="font-medium">{t.code}</span> {t.title}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <Button
          className="w-full"
          disabled={picked.length === 0 || staffing.isPending}
          onClick={() => {
            startRuns.reset()
            staffing.mutate(picked)
          }}
        >
          {staffing.isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Users aria-hidden />
          )}
          Propose a team ({picked.length})
        </Button>
      </section>

      <section className="space-y-3" aria-label="Proposed team">
        {staffing.isError && <ErrorState error={staffing.error} />}
        {!staffing.data && !staffing.isError && (
          <EmptyState title="No proposal yet">
            Pick tasks and choose Propose a team. Each person is proposed for one task at most, and
            never beyond the time they have free.
          </EmptyState>
        )}
        {staffing.data && (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Stat
                label="Tasks filled"
                value={`${staffing.data.filled} of ${staffing.data.tasks.length}`}
              />
              {showBilling() && (
                <Stat
                  label="Gross margin per week"
                  value={usd(staffing.data.total_weekly_margin_usd)}
                  hint="Bill rate minus cost, at each task's allocation"
                />
              )}
            </dl>
            {needRun.length > 0 && (
              <div className="bg-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm">
                <p>
                  {startRuns.data
                    ? `Matching started for ${startRuns.data.started} of ${startRuns.data.asked} tasks. Propose again in a minute.`
                    : `${needRun.length} task${needRun.length === 1 ? ' has' : 's have'} no finished matching run yet.`}
                </p>
                <Button
                  variant="outline"
                  disabled={startRuns.isPending || Boolean(startRuns.data)}
                  onClick={() => startRuns.mutate(needRun)}
                >
                  {startRuns.isPending && <Loader2 className="animate-spin" aria-hidden />}
                  Run matching for {needRun.length === 1 ? 'it' : `these ${needRun.length}`}
                </Button>
              </div>
            )}
            {startRuns.isError && <ErrorState error={startRuns.error} />}
            <ol className="space-y-3">
              {staffing.data.tasks.map((t) => (
                <StaffedCard key={t.task_id} t={t} />
              ))}
            </ol>
            <p className="text-muted-foreground text-xs">
              A proposal only. Open each task to accept or reject the person on its shortlist.
            </p>
          </>
        )}
      </section>
    </div>
  )
}

function StaffedCard({ t }: { t: StaffedTask }) {
  return (
    <li className="bg-surface rounded-xl border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link to={`/tasks/${t.task_id}`} className="font-medium hover:underline">
          {t.task_code} · {t.title}
        </Link>
        {t.proposed ? (
          <StatusBadge tone="ready">Proposed</StatusBadge>
        ) : (
          <StatusBadge tone="attention">Not filled</StatusBadge>
        )}
      </div>
      <div className="mt-2 space-y-2 text-sm">
        {t.proposed ? <PersonLine p={t.proposed} /> : <p>{t.unfilled_reason}</p>}
        {t.alternates.length > 0 && (
          <div className="text-muted-foreground space-y-1 text-xs">
            <p>Also possible:</p>
            {t.alternates.map((a) => (
              <PersonLine key={a.employee_id} p={a} />
            ))}
          </div>
        )}
      </div>
    </li>
  )
}
