import { Loader2, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router'

import type { BenchPerson, Margin, ProposedPerson, SkillGap, StaffedTask } from '@/api/types'
import { type Column, DataTable, Pagination } from '@/components/DataTable'
import { Segmented } from '@/components/FilterBar'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { StatusBadge, type Tone } from '@/components/StatusBadge'
import { useUrlState } from '@/components/useUrlState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/AuthProvider'
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
import { BAND_LABELS, chance, date, percent } from '@/lib/format'
import { UnitBadge } from '@/features/org/UnitBadge'

const HORIZONS = [
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '6 months' },
]

export const usd = (n: number): string => `$${n.toLocaleString('en-US')}`

export default function PlanningPage() {
  const role = useAuth().user?.role
  const [f, set] = useUrlState({ tab: 'bench' })
  if (role === 'viewer') return <Navigate to="/tasks" replace />
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planning"
        description="Who is free and what it costs, which skills open work is short of, and a first team for several tasks at once. Suggestions only: managers still decide on each task."
      />
      <Tabs value={f.tab} onValueChange={(tab) => set({ tab })}>
        <TabsList>
          <TabsTrigger value="bench">Bench</TabsTrigger>
          <TabsTrigger value="benchplan">Bench plan</TabsTrigger>
          <TabsTrigger value="rolloffs">Rolling off</TabsTrigger>
          <TabsTrigger value="skills">Skill gaps</TabsTrigger>
          <TabsTrigger value="staffing">Project staffing</TabsTrigger>
          <TabsTrigger value="whatif">What-if</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="team">Team builder</TabsTrigger>
          <TabsTrigger value="capacity">Capacity</TabsTrigger>
          <TabsTrigger value="keypeople">Key people</TabsTrigger>
          <TabsTrigger value="opportunity">Fair opportunity</TabsTrigger>
          <TabsTrigger value="learning">Learning</TabsTrigger>
        </TabsList>
        <TabsContent value="bench" className="mt-4">
          <BenchTab />
        </TabsContent>
        <TabsContent value="benchplan" className="mt-4">
          <BenchPlanTab />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <SkillGapsTab />
        </TabsContent>
        <TabsContent value="staffing" className="mt-4">
          <StaffingTab />
        </TabsContent>
        <TabsContent value="rolloffs" className="mt-4">
          <RollOffsTab />
        </TabsContent>
        <TabsContent value="whatif" className="mt-4">
          <WhatIfTab />
        </TabsContent>
        <TabsContent value="pipeline" className="mt-4">
          <PipelineTab />
        </TabsContent>
        <TabsContent value="team" className="mt-4">
          <TeamBuilderTab />
        </TabsContent>
        <TabsContent value="capacity" className="mt-4">
          <CapacityTab />
        </TabsContent>
        <TabsContent value="keypeople" className="mt-4">
          <KeyPeopleTab />
        </TabsContent>
        <TabsContent value="opportunity" className="mt-4">
          <OpportunityTab />
        </TabsContent>
        <TabsContent value="learning" className="mt-4">
          <LearningTab />
        </TabsContent>
      </Tabs>
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

function BenchTab() {
  const [f, set] = useUrlState({ horizon: '90', page: '1', size: '25' })
  const page = Math.max(1, Number(f.page) || 1)
  const size = Number(f.size) || 25
  const bench = useBench(Number(f.horizon), page, size)

  if (bench.isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (bench.isError) return <ErrorState error={bench.error} />
  const { summary: s, items, total } = bench.data

  const columns: Column<BenchPerson>[] = [
    {
      key: 'person',
      header: 'Person',
      cell: (p) => (
        <div className="min-w-0">
          <Link to={`/planning/people/${p.employee_id}`} className="font-medium hover:underline">
            {p.full_name}
          </Link>
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
      cell: (p) => <span className="whitespace-nowrap">{date(p.fully_free_from)}</span>,
    },
    {
      key: 'cost',
      header: 'Idle cost / week',
      align: 'right',
      cell: (p) => <span className="tabular-nums">{usd(p.weekly_idle_cost_usd)}</span>,
    },
    {
      key: 'next',
      header: 'Could take next',
      cell: (p) =>
        p.best_tasks.length === 0 ? (
          <span className="text-muted-foreground text-xs">No open task fits yet</span>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {p.best_tasks.map((t) => (
              <li key={t.task_id}>
                <Link to={`/tasks/${t.task_id}`} className="font-medium hover:underline">
                  {t.task_code}
                </Link>{' '}
                <span className="text-muted-foreground">
                  {percent(t.must_have_coverage)} of must-haves · starts {date(t.start_date)}
                </span>
              </li>
            ))}
          </ul>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          People with free capacity now or soon, what that idle time costs at the rate card, and
          open tasks each could take next.
        </p>
        <Segmented
          label="Look ahead"
          value={f.horizon}
          onChange={(horizon) => set({ horizon, page: '1' })}
          options={HORIZONS}
        />
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Free now"
          value={String(s.free_now)}
          hint={`${s.free_now_fte} full-time people`}
        />
        <Stat
          label="Idle cost per week"
          value={usd(s.weekly_idle_cost_usd)}
          hint="At the rate card's cost"
        />
        <Stat
          label="Freeing within 30 days"
          value={String(s.freeing_30)}
          hint={`${s.freeing_60} within 60`}
        />
        <Stat
          label="Freeing within 90 days"
          value={String(s.freeing_90)}
          hint="Plan their next task now"
        />
      </dl>
      <DataTable
        label="Bench"
        rows={items}
        columns={columns}
        rowKey={(p) => p.employee_id}
        empty={{ title: 'Nobody is free in this period', body: 'Everyone is fully booked.' }}
      />
      {total > 0 && (
        <Pagination
          total={total}
          page={page}
          pageSize={size}
          noun="people"
          onPage={(p) => set({ page: String(p) })}
          onPageSize={(n) => set({ size: String(n), page: '1' })}
        />
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

function SkillGapsTab() {
  const [f, set] = useUrlState({ horizon: '90', show: 'needs' })
  const gaps = useSkillGaps(Number(f.horizon))
  if (gaps.isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (gaps.isError) return <ErrorState error={gaps.error} />
  const all = gaps.data.gaps
  const needs = all.filter((g) => g.status !== 'covered')
  const rows = f.show === 'needs' ? needs : all

  const columns: Column<SkillGap>[] = [
    {
      key: 'skill',
      header: 'Skill',
      cell: (g) => (
        <div className="space-y-1">
          <p className="font-medium">{g.skill_name}</p>
          <StatusBadge tone={GAP_TONE[g.status]}>{GAP_LABEL[g.status]}</StatusBadge>
        </div>
      ),
    },
    {
      key: 'need',
      header: 'Tasks needing it',
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
                  className="font-medium hover:underline"
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
        <p className="text-muted-foreground max-w-2xl text-sm">
          Must-have skills of the {gaps.data.open_tasks} open tasks starting in this period, against
          free people who have them. Train the closest people before hiring.
        </p>
        <div className="flex flex-wrap gap-2">
          <Segmented
            label="Show"
            value={f.show}
            onChange={(show) => set({ show })}
            options={[
              { value: 'needs', label: 'Needs action', count: needs.length },
              { value: 'all', label: 'All skills', count: all.length },
            ]}
          />
          <Segmented
            label="Look ahead"
            value={f.horizon}
            onChange={(horizon) => set({ horizon })}
            options={HORIZONS}
          />
        </div>
      </div>
      <DataTable
        label="Skill gaps"
        rows={rows}
        columns={columns}
        rowKey={(g) => g.skill_id}
        empty={{
          title: 'No skill is short',
          body: 'Every must-have skill of upcoming tasks has at least twice as many free people as tasks. Choose "All skills" to see them.',
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
        {p.employee_code} · {p.level} · band {p.cost_band}
      </span>
      <UnitBadge unit={p.business_unit} />
      <StatusBadge tone={p.band === 'shortlist' ? 'ready' : 'info'}>
        {BAND_LABELS[p.band]} · {chance(p.score)}
      </StatusBadge>
      <MarginBadge margin={p.margin} />
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
              <Stat
                label="Gross margin per week"
                value={usd(staffing.data.total_weekly_margin_usd)}
                hint="Bill rate minus cost, at each task's allocation"
              />
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
