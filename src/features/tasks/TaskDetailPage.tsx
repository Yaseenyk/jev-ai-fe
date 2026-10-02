import { ArrowLeft, ChevronRight, Loader2, Pencil, Play } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'

import type { MatchRun, Task } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RunStatusBadge } from '@/features/runs/RunStatusBadge'
import { PriorityBadge } from '@/features/tasks/PriorityBadge'
import { useCanEdit } from '@/features/auth/AuthProvider'
import { useStartRun, useTask, useTaskRuns } from '@/features/tasks/api'
import { date, dateTime, domainLabel, humanize, levelLabel, locationLabel } from '@/lib/format'

export default function TaskDetailPage() {
  const { taskId = '' } = useParams()
  const task = useTask(taskId)

  if (task.isPending) return <Skeleton className="h-64 w-full" />
  if (task.isError) return <ErrorState error={task.error} onRetry={() => void task.refetch()} />
  return <TaskDetail task={task.data} />
}

function TaskDetail({ task }: { task: Task }) {
  const navigate = useNavigate()
  const runs = useTaskRuns(task.id)
  const start = useStartRun(task.id)
  const canEdit = useCanEdit()

  const facts: [string, string][] = [
    ['Domain', domainLabel(task.domain)],
    ['Required level', levelLabel(task.required_level)],
    ['Minimum experience', `${task.min_years_experience} years`],
    ['Start date', date(task.start_date)],
    ['Duration', `${task.duration_weeks} weeks`],
    ['Allocation', `${task.allocation_pct_required}%`],
    ['Work mode', humanize(task.work_mode)],
    [
      'Location',
      task.location_constraint.length
        ? task.location_constraint.map(locationLabel).join(', ')
        : 'Any',
    ],
    ['Client timezone', task.client_timezone],
    ['Max cost band', task.max_cost_band],
    ['Client clearance', task.clearance_required ?? 'Not needed'],
  ]

  return (
    <div className="space-y-6">
      <Link
        to="/tasks"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> All tasks
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-sm">{task.code}</span>
            <PriorityBadge priority={task.priority} />
          </div>
          <h1 className="text-2xl font-semibold">{task.title}</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">{task.description}</p>
        </div>
        {canEdit && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to={`/tasks/${task.id}/edit`}>
                  <Pencil /> Edit task
                </Link>
              </Button>
              <Button
                onClick={() =>
                  start.mutate(undefined, { onSuccess: (r) => void navigate(`/runs/${r.run_id}`) })
                }
                disabled={start.isPending}
              >
                {start.isPending ? <Loader2 className="animate-spin" /> : <Play />}
                Run matching
              </Button>
            </div>
            <span className="text-muted-foreground text-xs">Recommends people; you decide.</span>
          </div>
        )}
      </div>
      {start.isError && <ErrorState error={start.error} />}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[true, false].map((must) => {
              const reqs = task.requirements.filter((r) => r.must_have === must)
              return (
                <div key={String(must)} className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium uppercase">
                    {must ? 'Must have' : 'Nice to have'}
                  </p>
                  {reqs.length === 0 ? (
                    <p className="text-muted-foreground text-sm">None</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {reqs.map((r) => (
                        <Badge key={r.skill.id} variant={must ? 'default' : 'outline'}>
                          {r.skill.name} · {r.min_proficiency}/5+
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground text-xs">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Matching runs</h2>
        {runs.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : runs.isError ? (
          <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
        ) : runs.data.items.length === 0 ? (
          <EmptyState title="No runs yet">
            Click “Run matching” to rank people for this task.
          </EmptyState>
        ) : (
          <ul className="divide-y rounded-xl border">
            {runs.data.items.map((r) => (
              <RunRow key={r.id} run={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function RunRow({ run }: { run: MatchRun }) {
  return (
    <li>
      <Link
        to={`/runs/${run.id}`}
        className="hover:bg-muted/50 flex items-center gap-4 px-4 py-3 text-sm"
      >
        <RunStatusBadge status={run.status} />
        <span className="flex-1">
          {run.status === 'completed'
            ? `${run.retrieved_count} people ranked out of ${run.candidate_count}`
            : 'In progress'}
        </span>
        <span className="text-muted-foreground text-xs">
          {run.finished_at
            ? dateTime(run.finished_at)
            : run.started_at
              ? dateTime(run.started_at)
              : ''}
        </span>
        <ChevronRight className="text-muted-foreground size-4" aria-hidden />
      </Link>
    </li>
  )
}
