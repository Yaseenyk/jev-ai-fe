import { CalendarDays, ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { Task } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Badge } from '@/components/ui/badge'
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
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : tasks.data.items.length === 0 ? (
        <EmptyState title="No tasks match these filters">
          Try clearing the search or filters.
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-xl border">
          {tasks.data.items.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TaskRow({ task }: { task: Task }) {
  const mustHave = task.requirements.filter((r) => r.must_have)
  return (
    <li>
      <Link
        to={`/tasks/${task.id}`}
        className="hover:bg-muted/50 flex items-center gap-4 px-4 py-3 transition-colors"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground font-mono text-xs">{task.code}</span>
            <PriorityBadge priority={task.priority} />
          </div>
          <p className="truncate font-medium">{task.title}</p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>{domainLabel(task.domain)}</span>
            <span>{levelLabel(task.required_level)}</span>
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3" aria-hidden />
              Starts {date(task.start_date)}
            </span>
            <span className="flex flex-wrap gap-1">
              {mustHave.map((r) => (
                <Badge key={r.skill.id} variant="outline" className="font-normal">
                  {r.skill.name}
                </Badge>
              ))}
            </span>
          </div>
        </div>
        <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </Link>
    </li>
  )
}
