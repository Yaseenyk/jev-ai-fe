import { GraduationCap, Pin } from 'lucide-react'
import { Link } from 'react-router'

import type { PlanningActionRead, RollOff } from '@/api/types'
import { Segmented } from '@/components/FilterBar'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { useUrlState } from '@/components/useUrlState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usd } from '@/features/planning/PlanningPage'
import { useCreateAction, useRollOffs, useUpdateAction } from '@/features/planning/insightsApi'
import { date, percent } from '@/lib/format'
import { UnitBadge } from '@/features/org/UnitBadge'

const WINDOWS = [
  { value: '30', label: '30 days' },
  { value: '45', label: '45 days' },
  { value: '90', label: '90 days' },
]

/** People whose work ends soon, before they reach the bench (ADR 025). */
export function RollOffsTab() {
  const [f, set] = useUrlState({ within: '45' })
  const report = useRollOffs(Number(f.within))
  if (report.isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (report.isError) return <ErrorState error={report.error} />
  const r = report.data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          People whose current work ends soon. Hold them for an upcoming task, or train the one
          skill that stands between them and the closest one, before they cost bench time.
        </p>
        <Segmented
          label="Ending within"
          value={f.within}
          onChange={(within) => set({ within })}
          options={WINDOWS}
        />
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Stat label="Rolling off" value={String(r.people)} hint={`within ${r.days} days`} />
        <Stat
          label="With a next task in view"
          value={String(r.with_next_task)}
          hint="An open task fits them"
        />
        <Stat
          label="Weekly cost at risk"
          value={usd(r.weekly_cost_at_risk_usd)}
          hint="Nothing fits and nobody is held"
        />
      </dl>
      {r.items.length === 0 ? (
        <EmptyState title="Nobody rolls off in this period" />
      ) : (
        <ul className="space-y-3">
          {r.items.map((p) => (
            <RollOffCard key={p.employee_id} p={p} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-surface rounded-xl border p-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-muted-foreground mt-0.5 text-xs">{hint}</dd>
    </div>
  )
}

function RollOffCard({ p }: { p: RollOff }) {
  const create = useCreateAction()
  const held = new Set(p.actions.filter((a) => a.kind === 'hold').map((a) => a.task_id))
  return (
    <li
      className="bg-surface rounded-xl border p-4"
      aria-label={`${p.full_name} rolls off ${date(p.rolls_off_on)}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link to={`/planning/people/${p.employee_id}`} className="font-medium hover:underline">
            {p.full_name}
          </Link>
          <span className="text-muted-foreground text-xs">
            {' '}
            · {p.designation} · {p.level}
          </span>{' '}
          <UnitBadge unit={p.business_unit} />
        </div>
        <StatusBadge tone="attention">Free from {date(p.rolls_off_on)}</StatusBadge>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        {p.current_project
          ? `Now on ${p.current_project} (${p.current_client ?? ''}), ${p.current_allocation_pct}%`
          : `${p.current_allocation_pct}% allocated`}{' '}
        · {usd(p.weekly_cost_usd)} a week if idle
      </p>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Could move to</p>
          {p.next_tasks.length === 0 ? (
            <p className="text-muted-foreground text-xs">No open task fits yet.</p>
          ) : (
            p.next_tasks.map((t) => (
              <div key={t.task_id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link to={`/tasks/${t.task_id}`} className="font-medium hover:underline">
                  {t.task_code}
                </Link>
                <span className="text-muted-foreground text-xs">
                  {percent(t.must_have_coverage)} of must-haves · starts {date(t.start_date)}
                </span>
                {held.has(t.task_id) ? (
                  <StatusBadge tone="ready">Held</StatusBadge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={create.isPending}
                    onClick={() =>
                      create.mutate({
                        kind: 'hold',
                        employee_id: p.employee_id,
                        task_id: t.task_id,
                        note: `Hold for ${t.task_code}`,
                      })
                    }
                  >
                    <Pin aria-hidden /> Hold for {t.task_code}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium">One skill short</p>
          {p.near_miss ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                {p.near_miss.skill_name} for{' '}
                <Link to={`/tasks/${p.near_miss.task_id}`} className="hover:underline">
                  {p.near_miss.task_code}
                </Link>{' '}
                <span className="text-muted-foreground text-xs">
                  (has level {p.near_miss.has_level}, needs {p.near_miss.needs_level})
                </span>
              </span>
              {p.actions.some(
                (a) => a.kind === 'upskill' && a.skill_id === p.near_miss?.skill_id,
              ) ? (
                <StatusBadge tone="info">Upskilling planned</StatusBadge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={create.isPending}
                  onClick={() => {
                    const n = p.near_miss
                    if (!n) return
                    create.mutate({
                      kind: 'upskill',
                      employee_id: p.employee_id,
                      skill_id: n.skill_id,
                      target_level: n.needs_level,
                      due_on: p.rolls_off_on,
                      note: `For ${n.task_code}`,
                    })
                  }}
                >
                  <GraduationCap aria-hidden /> Plan upskilling
                </Button>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">No near miss.</p>
          )}
        </div>
      </div>
      {p.actions.length > 0 && <ActionList actions={p.actions} />}
    </li>
  )
}

export function ActionList({ actions }: { actions: PlanningActionRead[] }) {
  const update = useUpdateAction()
  return (
    <ul className="mt-3 space-y-1 border-t pt-3">
      {actions.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge tone={a.status === 'open' ? 'info' : 'neutral'}>
            {a.kind === 'hold'
              ? `Held for ${a.task_code ?? 'a task'}`
              : `Train ${a.skill_name ?? ''}`}
            {a.status !== 'open' && ` · ${a.status}`}
          </StatusBadge>
          {a.due_on && <span className="text-muted-foreground">by {date(a.due_on)}</span>}
          {a.status === 'open' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: a.id, status: 'done' })}
              >
                Mark done
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: a.id, status: 'cancelled' })}
              >
                Cancel
              </Button>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
