import { ChevronRight, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import type { Task, TaskPriority } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PRIORITY_ORDER, PriorityDot, priorityLabel } from '@/features/tasks/PriorityBadge'
import { StartRunway, daysUntil } from '@/features/tasks/StartRunway'
import { useTasks } from '@/features/tasks/api'
import { domainLabel, levelLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

const ANY = 'any'
const NO_FILTERS = { q: '', priority: '', domain: '' }

interface Group {
  title: string
  tasks: Task[]
}

/** Staffing is about timing, so tasks are grouped by how soon they start, most urgent first. */
function groupByStart(tasks: Task[], today: Date): Group[] {
  const rank = (t: Task) => PRIORITY_ORDER.indexOf(t.priority)
  const sorted = [...tasks].sort(
    (a, b) => a.start_date.localeCompare(b.start_date) || rank(a) - rank(b),
  )
  const groups: Group[] = [
    { title: 'Starting this week', tasks: [] },
    { title: 'Starting in the next 4 weeks', tasks: [] },
    { title: 'Starting later', tasks: [] },
  ]
  for (const t of sorted) {
    const d = daysUntil(t.start_date, today)
    const group = d <= 7 ? groups[0] : d <= 28 ? groups[1] : groups[2]
    group?.tasks.push(t)
  }
  return groups.filter((g) => g.tasks.length > 0)
}

export default function TaskListPage() {
  // All tasks are loaded once and filtered here, so filters respond instantly.
  const tasks = useTasks(NO_FILTERS)
  const [q, setQ] = useState('')
  const [priority, setPriority] = useState<TaskPriority | null>(null)
  const [domain, setDomain] = useState<string | null>(null)
  const [today] = useState(() => new Date())
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        e.target.closest('input, textarea, [role=combobox]') !== null
      if (e.key === '/' && !typing) {
        e.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const all = useMemo(() => tasks.data?.items ?? [], [tasks.data])
  const matchesText = (t: Task) =>
    !q ||
    `${t.code} ${t.title} ${t.requirements.map((r) => r.skill.name).join(' ')}`
      .toLowerCase()
      .includes(q.toLowerCase())
  const base = all.filter((t) => matchesText(t) && (!domain || t.domain === domain))
  const visible = base.filter((t) => !priority || t.priority === priority)
  const domains = [...new Set(all.map((t) => t.domain))].sort()
  const filtered = q !== '' || priority !== null || domain !== null
  const clear = () => {
    setQ('')
    setPriority(null)
    setDomain(null)
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">Tasks</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {tasks.isSuccess ? `${all.length} open, soonest start first` : 'Loading open tasks'}
          </p>
        </div>
        <Button asChild size="lg" className="hidden h-10 rounded-xl px-4 sm:inline-flex">
          <Link to="/tasks/new">
            <Plus /> New task
          </Link>
        </Button>
      </header>

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              ref={search}
              aria-label="Search tasks"
              placeholder="Search tasks or skills"
              className="bg-surface h-11 rounded-xl pr-10 pl-9 text-[15px]"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q ? (
              <button
                type="button"
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md"
                onClick={() => setQ('')}
              >
                <X className="size-4" />
              </button>
            ) : (
              <kbd className="text-muted-foreground bg-muted pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded px-1.5 text-xs sm:block">
                /
              </kbd>
            )}
          </div>
          <DomainSelect
            domains={domains}
            value={domain}
            onChange={setDomain}
            className="bg-surface hidden h-11! w-44 rounded-xl sm:flex"
          />
        </div>

        <div
          className="-mx-4 flex items-center gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,black_85%,transparent)] px-4 pb-1 sm:mx-0 sm:[mask-image:none] sm:px-0"
          role="group"
          aria-label="Filter by priority"
        >
          <DomainSelect
            domains={domains}
            value={domain}
            onChange={setDomain}
            className="bg-surface h-9! w-auto shrink-0 gap-1.5 rounded-full px-3.5 text-sm font-medium sm:hidden"
          />
          <FilterPill
            active={priority === null}
            onClick={() => setPriority(null)}
            count={base.length}
          >
            All
          </FilterPill>
          {PRIORITY_ORDER.map((p) => (
            <FilterPill
              key={p}
              active={priority === p}
              onClick={() => setPriority(priority === p ? null : p)}
              count={base.filter((t) => t.priority === p).length}
            >
              <PriorityDot priority={p} />
              {priorityLabel(p)}
            </FilterPill>
          ))}
          {filtered && (
            <button
              type="button"
              onClick={clear}
              className="text-muted-foreground hover:text-foreground ml-auto h-9 shrink-0 px-2 text-sm underline-offset-4 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {tasks.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState title="No tasks match these filters">
          <Button variant="outline" className="mt-2" onClick={clear}>
            Clear filters
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {groupByStart(visible, today).map((g) => (
            <section key={g.title} aria-label={g.title} className="space-y-3">
              <h2 className="flex items-baseline gap-2 text-base font-semibold">
                {g.title}
                <span className="text-muted-foreground font-sans text-sm font-normal tabular-nums">
                  {g.tasks.length}
                </span>
              </h2>
              <ul className="bg-surface divide-y overflow-hidden rounded-2xl border">
                {g.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} today={today} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function DomainSelect({
  domains,
  value,
  onChange,
  className,
}: {
  domains: string[]
  value: string | null
  onChange: (domain: string | null) => void
  className: string
}) {
  return (
    <Select value={value ?? ANY} onValueChange={(v) => onChange(v === ANY ? null : v)}>
      <SelectTrigger aria-label="Filter by domain" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>All domains</SelectItem>
        {domains.map((d) => (
          <SelectItem key={d} value={d}>
            {domainLabel(d)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function FilterPill({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        active
          ? 'bg-foreground text-background border-foreground'
          : 'bg-surface text-foreground hover:bg-muted',
      )}
    >
      {children}
      <span className={cn('tabular-nums', active ? 'text-background/70' : 'text-muted-foreground')}>
        {count}
      </span>
    </button>
  )
}

function TaskRow({ task, today }: { task: Task; today: Date }) {
  const mustHave = task.requirements.filter((r) => r.must_have)
  return (
    <li>
      <Link
        to={`/tasks/${task.id}`}
        aria-label={`${task.title}, ${task.code}`}
        className="group hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-ring grid gap-4 px-4 py-4 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:px-5 md:grid-cols-[1fr_13rem_auto] md:items-center md:gap-6"
      >
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <PriorityDot priority={task.priority} />
            <span
              className={cn(
                'text-xs font-medium',
                task.priority === 'critical' ? 'text-priority-critical' : 'text-muted-foreground',
              )}
            >
              {priorityLabel(task.priority)}
            </span>
            <span className="text-muted-foreground text-xs">{task.code}</span>
          </div>
          <p className="font-heading text-[17px] leading-snug font-semibold">{task.title}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            <span className="text-muted-foreground">{domainLabel(task.domain)}</span>
            <span className="text-muted-foreground">{levelLabel(task.required_level)}</span>
            <span className="flex flex-wrap gap-1.5">
              {mustHave.map((r) => (
                <span
                  key={r.skill.id}
                  className="bg-muted text-foreground rounded-md px-2 py-0.5 text-xs font-medium"
                >
                  {r.skill.name}
                </span>
              ))}
            </span>
          </div>
        </div>
        <StartRunway
          startDate={task.start_date}
          durationWeeks={task.duration_weeks}
          today={today}
        />
        <ChevronRight
          className="text-muted-foreground group-hover:text-foreground hidden size-5 transition-transform group-hover:translate-x-0.5 md:block"
          aria-hidden
        />
      </Link>
    </li>
  )
}
