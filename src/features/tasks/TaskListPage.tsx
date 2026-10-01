import { ArrowRight, Briefcase, CalendarDays, Clock, GraduationCap, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { Task } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PriorityBadge } from '@/features/tasks/PriorityBadge'
import { type TaskFilters, useTasks } from '@/features/tasks/api'
import { date, domainLabel, levelLabel } from '@/lib/format'

const ANY = 'any'
const PRIORITIES = ['critical', 'high', 'medium', 'low']
const DOMAINS = [
  'bfsi',
  'healthcare',
  'retail',
  'manufacturing',
  'public_sector',
  'education',
  'telecom',
  'logistics',
]

export default function TaskListPage() {
  const [filters, setFilters] = useState<TaskFilters>({ q: '', priority: '', domain: '' })
  const tasks = useTasks(filters)
  const set = (k: keyof TaskFilters) => (v: string) =>
    setFilters((f) => ({ ...f, [k]: v === ANY ? '' : v }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Open tasks</h1>
        <p className="text-muted-foreground text-sm">
          Pick a task to see who fits it, or run matching again.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="text-muted-foreground absolute top-2 left-2.5 size-4" aria-hidden />
          <Input
            aria-label="Search tasks"
            placeholder="Search by code or title"
            className="pl-8"
            value={filters.q}
            onChange={(e) => set('q')(e.target.value)}
          />
        </div>
        <Select value={filters.priority || ANY} onValueChange={set('priority')}>
          <SelectTrigger aria-label="Filter by priority" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any priority</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.domain || ANY} onValueChange={set('domain')}>
          <SelectTrigger aria-label="Filter by domain" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any domain</SelectItem>
            {DOMAINS.map((d) => (
              <SelectItem key={d} value={d}>
                {domainLabel(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tasks.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : tasks.data.items.length === 0 ? (
        <EmptyState title="No tasks match these filters">
          Try clearing the search or filters.
        </EmptyState>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {tasks.data.total} {tasks.data.total === 1 ? 'task' : 'tasks'}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tasks.data.items.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

const ACCENT: Record<Task['priority'], string> = {
  critical: 'bg-destructive',
  high: 'bg-primary',
  medium: 'bg-transparent',
  low: 'bg-transparent',
}

function TaskCard({ task }: { task: Task }) {
  const mustHave = task.requirements.filter((r) => r.must_have)
  const facts = [
    { icon: Briefcase, label: 'Domain', value: domainLabel(task.domain) },
    { icon: GraduationCap, label: 'Level', value: levelLabel(task.required_level) },
    { icon: CalendarDays, label: 'Starts', value: date(task.start_date) },
    { icon: Clock, label: 'Duration', value: `${task.duration_weeks} weeks` },
  ]
  return (
    <li className="flex">
      <Link
        to={`/tasks/${task.id}`}
        aria-label={`${task.code} ${task.title}`}
        className="focus-visible:ring-ring group flex w-full rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      >
        <Card className="relative w-full gap-4 overflow-hidden py-5 transition-shadow group-hover:shadow-md">
          <span className={`absolute inset-y-0 left-0 w-1 ${ACCENT[task.priority]}`} aria-hidden />
          <div className="flex items-center justify-between gap-2 px-5">
            <span className="text-muted-foreground font-mono text-xs">{task.code}</span>
            <PriorityBadge priority={task.priority} />
          </div>

          <h2 className="line-clamp-2 min-h-12 px-5 text-base leading-6 font-semibold">
            {task.title}
          </h2>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 px-5">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex min-w-0 items-start gap-2">
                <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <dt className="text-muted-foreground text-[11px] leading-none">{label}</dt>
                  <dd className="mt-1 truncate text-sm font-medium">{value}</dd>
                </div>
              </div>
            ))}
          </dl>

          <div className="space-y-1.5 px-5">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Must-have skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {mustHave.map((r) => (
                <Badge key={r.skill.id} variant="secondary" className="font-normal">
                  {r.skill.name}
                </Badge>
              ))}
            </div>
          </div>

          <div className="text-primary mt-auto flex items-center gap-1 border-t px-5 pt-3 text-sm font-medium">
            View matches
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </div>
        </Card>
      </Link>
    </li>
  )
}
