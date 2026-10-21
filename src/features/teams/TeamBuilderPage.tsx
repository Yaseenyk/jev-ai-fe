import { Check, Loader2, Play, Sparkles, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'

import type { TeamCandidate } from '@/api/types'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { useUrlState } from '@/components/useUrlState'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import { UnitBadge } from '@/features/org/UnitBadge'
import { useStartRun, useTasks } from '@/features/tasks/api'
import {
  useLeadOptions,
  useMemberOptions,
  useSaveTeam,
  useShadowOptions,
} from '@/features/teams/api'
import { chance, date, percent } from '@/lib/format'
import { cn } from '@/lib/utils'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Build a team for a task (ADR 039): a lead, members under the lead, an optional shadow. */
export default function TeamBuilderPage() {
  const role = useAuth().user?.role
  const [f, set] = useUrlState({ task: '' })
  const tasks = useTasks({ q: '', priority: '', domain: '' }, 'open')
  if (role !== 'admin' && role !== 'resource_manager') return <Navigate to="/teams" replace />
  return (
    <div className="space-y-6">
      <PageHeader
        back={{ to: '/teams', label: 'All teams' }}
        title="Build a team"
        description="Pick a task, then its Team Lead, the people under the lead, and if you like a shadow who learns alongside. Suggestions come from the matching rules and our model; you choose every person."
      />
      <Step n={1} title="Choose the task" done={Boolean(f.task)}>
        {tasks.isPending ? (
          <Skeleton className="h-10 w-96" />
        ) : tasks.isError ? (
          <ErrorState error={tasks.error} />
        ) : tasks.data.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No open tasks.</p>
        ) : (
          <Select value={f.task} onValueChange={(task) => set({ task })}>
            <SelectTrigger className="w-full max-w-xl" aria-label="Task">
              <SelectValue placeholder="Choose an open task" />
            </SelectTrigger>
            <SelectContent>
              {tasks.data.items.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.code} · {t.title} · needs {plural(t.headcount, 'person', 'people')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Step>
      {f.task && <Builder key={f.task} taskId={f.task} />}
    </div>
  )
}

function Step({
  n,
  title,
  done,
  hint,
  children,
}: {
  n: number
  title: string
  done: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="bg-surface space-y-4 rounded-xl border p-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold',
            done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {done ? <Check className="size-4" aria-hidden /> : n}
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function Builder({ taskId }: { taskId: string }) {
  const navigate = useNavigate()
  const [started, setStarted] = useState(false)
  const startRun = useStartRun(taskId)
  const [leadId, setLeadId] = useState('')
  const [memberIds, setMemberIds] = useState<string[] | null>(null)
  const [shadowId, setShadowId] = useState<string | null | undefined>(undefined)
  // Poll the options while a run started here is still going.
  const leads = useLeadOptions(taskId, started)
  const runId = leads.data?.run_id ?? null
  const waiting = started && !runId
  const members = useMemberOptions(taskId, leadId, runId)
  const chosenMembers = memberIds ?? members.data?.members.map((m) => m.employee_id) ?? []
  const needed = members.data?.needed ?? 0
  const membersDone = Boolean(members.data) && chosenMembers.length === needed
  const shadows = useShadowOptions(taskId, [leadId, ...chosenMembers], membersDone)
  const save = useSaveTeam()

  if (leads.isPending) return <Skeleton className="h-64 w-full rounded-xl" />
  if (leads.isError) return <ErrorState error={leads.error} />
  const task = leads.data.task
  const all = [...(members.data?.members ?? []), ...(members.data?.alternates ?? [])]
  const pick = (id: string) => {
    setLeadId(id)
    setMemberIds(null)
    setShadowId(undefined)
  }
  const toggle = (id: string) => {
    const now = chosenMembers.includes(id)
      ? chosenMembers.filter((x) => x !== id)
      : chosenMembers.length < needed
        ? [...chosenMembers, id]
        : chosenMembers
    setMemberIds(now)
    setShadowId(undefined)
  }
  const byId = new Map(
    [...leads.data.leads, ...all, ...(shadows.data ?? [])].map((p) => [p.employee_id, p]),
  )
  const create = () =>
    save.mutate(
      { task_id: taskId, lead_id: leadId, member_ids: chosenMembers, shadow_id: shadowId ?? null },
      { onSuccess: (team) => void navigate(`/teams/${team.id}`) },
    )

  return (
    <>
      <p className="text-muted-foreground text-sm">
        <Link to={`/tasks/${task.task_id}`} className="text-foreground font-medium underline">
          {task.code} {task.title}
        </Link>{' '}
        · {task.client_code} · needs {plural(task.headcount, 'person', 'people')} (the lead counts
        as one) · starts {date(task.start_date)} for {task.duration_weeks} weeks
      </p>

      <Step
        n={2}
        title="Choose the Team Lead"
        done={Boolean(leadId)}
        hint="Lead level or above, or strong Technical Leadership, who covers the task's skills and is free when it starts. The best one is suggested."
      >
        {leads.data.leads.length === 0 ? (
          <EmptyState title="Nobody can lead this task yet">
            Nobody at Lead level is free with the task's skills. Ask HR from the task page.
          </EmptyState>
        ) : (
          <PeopleGrid
            label="Team Lead options"
            people={leads.data.leads}
            chosen={leadId ? [leadId] : []}
            onPick={pick}
            action="Choose as lead"
          />
        )}
      </Step>

      {leadId && (
        <Step
          n={3}
          title="Choose the people under the lead"
          done={membersDone}
          hint={
            needed === 0
              ? 'This task needs one person: the lead is the whole team.'
              : `Pick ${plural(needed, 'person', 'people')}: the best matches for the task, below the lead's level; people from the lead's unit or practice come first.`
          }
        >
          {!runId ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <p>The task has no matching results yet, so members cannot be suggested.</p>
              <Button
                variant="outline"
                disabled={startRun.isPending || waiting}
                onClick={() => startRun.mutate(undefined, { onSuccess: () => setStarted(true) })}
              >
                {waiting || startRun.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Play aria-hidden />
                )}
                {waiting ? 'Matching…' : 'Run matching'}
              </Button>
              {startRun.isError && <ErrorState error={startRun.error} />}
            </div>
          ) : members.isPending ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : members.isError ? (
            <ErrorState error={members.error} />
          ) : needed === 0 ? null : all.length === 0 ? (
            <EmptyState title="Nobody fits under this lead">
              Try another lead, or ask HR for outside candidates from the task page.
            </EmptyState>
          ) : (
            <>
              <p className="text-sm font-medium" role="status">
                {chosenMembers.length} of {needed} chosen
              </p>
              <PeopleGrid
                label="Member options"
                people={all}
                chosen={chosenMembers}
                onPick={toggle}
                action="Add to team"
                chosenAction="In the team"
              />
            </>
          )}
        </Step>
      )}

      {leadId && membersDone && (
        <Step
          n={4}
          title="Add a shadow (optional)"
          done={shadowId !== undefined}
          hint="A learner who works alongside the team for 25% of their time to grow the skills. Not counted in the team and not billed."
        >
          {shadows.isPending ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : shadows.isError ? (
            <ErrorState error={shadows.error} />
          ) : (
            <div className="space-y-3">
              {shadows.data.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nobody is learning these skills now.
                </p>
              ) : (
                <PeopleGrid
                  label="Shadow options"
                  people={shadows.data}
                  chosen={shadowId ? [shadowId] : []}
                  onPick={(id) => setShadowId(shadowId === id ? null : id)}
                  action="Choose as shadow"
                />
              )}
              <Button
                variant={shadowId === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShadowId(null)}
              >
                No shadow
              </Button>
            </div>
          )}
        </Step>
      )}

      {leadId && membersDone && shadowId !== undefined && (
        <Step n={5} title="Create the team" done={false}>
          <ul className="space-y-1 text-sm" aria-label="Team summary">
            <li>
              <span className="text-muted-foreground">Lead:</span> {byId.get(leadId)?.full_name}
            </li>
            {chosenMembers.length > 0 && (
              <li>
                <span className="text-muted-foreground">Members:</span>{' '}
                {chosenMembers.map((id) => byId.get(id)?.full_name).join(', ')}
              </li>
            )}
            <li>
              <span className="text-muted-foreground">Shadow:</span>{' '}
              {shadowId ? byId.get(shadowId)?.full_name : 'none'}
            </li>
          </ul>
          <Button disabled={save.isPending} onClick={create}>
            {save.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Users aria-hidden />
            )}
            Create team
          </Button>
          {save.isError && <ErrorState error={save.error} />}
          <p className="text-muted-foreground text-xs">
            A plan you can change later. Nobody is assigned: accept each person on the task.
          </p>
        </Step>
      )}
    </>
  )
}

function PeopleGrid({
  label,
  people,
  chosen,
  onPick,
  action,
  chosenAction = 'Chosen',
}: {
  label: string
  people: TeamCandidate[]
  chosen: string[]
  onPick: (employeeId: string) => void
  action: string
  chosenAction?: string
}) {
  return (
    <ul aria-label={label} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {people.map((p) => {
        const on = chosen.includes(p.employee_id)
        return (
          <li
            key={p.employee_id}
            aria-label={p.full_name}
            className={cn(
              'flex flex-col gap-2 rounded-xl border p-4 transition-colors',
              on ? 'border-primary bg-primary/5' : 'bg-surface',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to={`/planning/people/${p.employee_id}`}
                  className="block truncate font-medium hover:underline"
                >
                  {p.full_name}
                </Link>
                <p className="text-muted-foreground text-xs">
                  {p.employee_code} · {p.designation} · {p.level}
                </p>
              </div>
              {p.suggested && (
                <StatusBadge tone="ready">
                  <Sparkles className="size-3" aria-hidden /> Suggested
                </StatusBadge>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge tone="info">{percent(p.coverage)} of must-haves</StatusBadge>
              {p.score !== null && <StatusBadge tone="neutral">{chance(p.score)} fit</StatusBadge>}
              <UnitBadge unit={p.business_unit} />
            </div>
            <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 text-xs">
              {p.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <Button
              size="sm"
              variant={on ? 'default' : 'outline'}
              className="mt-auto h-8"
              aria-pressed={on}
              onClick={() => onPick(p.employee_id)}
            >
              {on ? (
                <>
                  <Check aria-hidden /> {chosenAction}
                </>
              ) : (
                action
              )}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
