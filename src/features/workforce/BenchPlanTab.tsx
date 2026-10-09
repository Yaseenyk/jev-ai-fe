import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, GraduationCap, Hand, Loader2, UserPen, X } from 'lucide-react'
import { Link } from 'react-router'

import { ApiError, apiFetch } from '@/api/client'
import type { BenchPlan, BenchStep } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { StatusBadge, type Tone } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { UnitBadge } from '@/features/org/UnitBadge'
import { usd } from '@/features/planning/PlanningPage'
import { useCreateAction, useUpdateAction } from '@/features/planning/insightsApi'
import { date } from '@/lib/format'

const STEP: Record<string, { label: string; tone: Tone }> = {
  propose: { label: 'Propose', tone: 'ready' },
  learn: { label: 'Learn', tone: 'info' },
  practise: { label: 'Practise', tone: 'info' },
  profile: { label: 'Fix profile', tone: 'attention' },
  wait: { label: 'Wait', tone: 'neutral' },
}

const useBenchPlan = () =>
  useQuery({
    queryKey: ['planning', 'bench-plan'],
    queryFn: () => apiFetch<BenchPlan>('/planning/bench-plan'),
  })

/** Taking a step: hold for the task, or upskill (and start the course when there is one). */
function useTakeStep() {
  const qc = useQueryClient()
  const create = useCreateAction()
  return useMutation({
    mutationFn: async (s: BenchStep) => {
      if (s.step === 'learn' && s.course_id) {
        await apiFetch(`/employees/${s.person.employee_id}/learning`, {
          method: 'POST',
          body: JSON.stringify({ course_id: s.course_id, due_date: null }),
        }).catch((e: unknown) => {
          // Already in their plan is fine: the step is still taken.
          if (!(e instanceof ApiError && e.problem?.code === 'already_assigned')) throw e
        })
      }
      return create.mutateAsync(
        s.step === 'propose'
          ? {
              kind: 'hold',
              employee_id: s.person.employee_id,
              task_id: s.task_id ?? null,
              note: 'From the bench plan',
            }
          : {
              kind: 'upskill',
              employee_id: s.person.employee_id,
              skill_id: s.skill_id ?? null,
              target_level: s.target_level ?? null,
              note: 'From the bench plan',
            },
      )
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['planning'] })
      void qc.invalidateQueries({ queryKey: ['learning'] })
    },
  })
}

function StepRow({ s }: { s: BenchStep }) {
  const take = useTakeStep()
  const update = useUpdateAction()
  const meta = STEP[s.step] ?? { label: s.step, tone: 'neutral' as Tone }
  const busy = take.isPending || update.isPending
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/planning/people/${s.person.employee_id}`}
            className="font-medium hover:underline"
          >
            {s.person.full_name}
          </Link>
          <span className="text-muted-foreground text-xs">
            {s.person.designation} · {s.person.level} ·{' '}
            {s.free_now_pct === 100
              ? s.days_on_bench > 0
                ? `${s.days_on_bench} days on the bench`
                : 'free now'
              : `free from ${date(s.free_from)}`}
            {s.weekly_idle_cost_usd > 0 && ` · ${usd(s.weekly_idle_cost_usd)} idle a week`}
          </span>
          <UnitBadge unit={s.person.business_unit} />
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          <span>{s.text}</span>
        </p>
        {take.isError && <ErrorState error={take.error} />}
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {s.action ? (
          <>
            <StatusBadge tone="info">
              {s.action.kind === 'hold'
                ? `Held for ${s.action.task_code ?? 'a task'}`
                : `Upskilling: ${s.action.skill_name ?? ''}`}
            </StatusBadge>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              aria-label={`Mark done for ${s.person.full_name}`}
              onClick={() => update.mutate({ id: s.action?.id ?? '', status: 'done' })}
            >
              <Check aria-hidden /> Done
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-label={`Drop the step for ${s.person.full_name}`}
              onClick={() => update.mutate({ id: s.action?.id ?? '', status: 'cancelled' })}
            >
              <X aria-hidden /> Drop
            </Button>
          </>
        ) : s.step === 'propose' ? (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => take.mutate(s)}
              aria-label={`Hold ${s.person.full_name} for ${s.task_code ?? 'the task'}`}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Hand aria-hidden />} Hold
              for {s.task_code}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/tasks/${s.task_id ?? ''}`}>Open task</Link>
            </Button>
          </>
        ) : s.step === 'learn' || s.step === 'practise' ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => take.mutate(s)}
            aria-label={`Start upskilling ${s.person.full_name}`}
          >
            {busy ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <GraduationCap aria-hidden />
            )}
            {s.step === 'learn' ? 'Start the course' : 'Plan the practice'}
          </Button>
        ) : s.step === 'profile' ? (
          <Button size="sm" variant="outline" asChild>
            <Link to={`/employees/${s.person.employee_id}`}>
              <UserPen aria-hidden /> Open profile
            </Link>
          </Button>
        ) : null}
      </div>
    </li>
  )
}

/** One next step for everyone on the bench or freeing up within two weeks (ADR 033). */
export function BenchPlanTab() {
  const q = useBenchPlan()
  if (q.isPending) return <Skeleton className="h-60 w-full" />
  if (q.isError) return <ErrorState error={q.error} />
  const p = q.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" aria-label="Bench plan summary">
        <StatusBadge tone="neutral">{p.people} people</StatusBadge>
        <StatusBadge tone="attention">{usd(p.weekly_idle_cost_usd)} idle a week</StatusBadge>
        <StatusBadge tone={p.waiting > 0 ? 'attention' : 'ready'}>
          {p.waiting} steps waiting
        </StatusBadge>
        {Object.entries(p.steps).map(([k, n]) => (
          <StatusBadge key={k} tone="neutral">
            {STEP[k]?.label ?? k}: {n}
          </StatusBadge>
        ))}
      </div>
      <p className="text-muted-foreground max-w-3xl text-sm">
        Everyone free now or within two weeks gets one next step: a task to propose them for, a
        course or skill that open work needs, or a profile to complete. Most idle cost first. Taking
        a step holds the person or plans the upskilling; nothing is assigned.
      </p>
      {p.items.length === 0 ? (
        <EmptyState title="Nobody is on the bench">
          Everyone is busy for at least two weeks.
        </EmptyState>
      ) : (
        <ul className="bg-surface divide-y rounded-xl border" aria-label="Next steps">
          {p.items.map((s) => (
            <StepRow key={s.person.employee_id} s={s} />
          ))}
        </ul>
      )}
    </div>
  )
}
