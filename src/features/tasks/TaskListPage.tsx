import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import type { Task, TaskPriority } from '@/api/types'
import { type Column, DataTable, Pagination } from '@/components/DataTable'
import { FilterBar, FilterSelect, Segmented, SortSelect } from '@/components/FilterBar'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState } from '@/components/QueryStates'
import { useUrlState } from '@/components/useUrlState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCanEdit } from '@/features/auth/AuthProvider'
import {
  PRIORITY_ORDER,
  PriorityBadge,
  TaskStatusBadge,
  priorityLabel,
} from '@/features/tasks/PriorityBadge'
import { daysUntil, startsLabel } from '@/features/tasks/StartRunway'
import { type TaskView, useTasks } from '@/features/tasks/api'
import { date, domainLabel, levelLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

const NO_FILTERS = { q: '', priority: '', domain: '' }

const SORTS = [
  { value: 'start', label: 'Soonest start' },
  { value: 'priority', label: 'Highest priority' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'code', label: 'Task code' },
]

const DEFAULTS = {
  view: 'open',
  q: '',
  priority: '',
  domain: '',
  client: '',
  sort: 'start',
  page: '1',
  size: '25',
}

const rank = (t: Task) => PRIORITY_ORDER.indexOf(t.priority)

const byStart = (a: Task, b: Task) => a.start_date.localeCompare(b.start_date) || rank(a) - rank(b)

const COMPARE: Record<string, (a: Task, b: Task) => number> = {
  start: byStart,
  priority: (a, b) => rank(a) - rank(b) || a.start_date.localeCompare(b.start_date),
  title: (a, b) => a.title.localeCompare(b.title),
  code: (a, b) => a.code.localeCompare(b.code),
}

export default function TaskListPage() {
  const [f, set] = useUrlState(DEFAULTS)
  const view: TaskView = f.view === 'closed' ? 'closed' : 'open'
  // All tasks of the view are loaded once and filtered here, so filters respond instantly.
  const tasks = useTasks(NO_FILTERS, view)
  const canEdit = useCanEdit()
  const [today] = useState(() => new Date())
  const page = Math.max(1, Number(f.page) || 1)
  const size = Number(f.size) || 25

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        e.target.closest('input, textarea, [role=combobox]') !== null
      if (e.key === '/' && !typing) {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('input[aria-label="Search tasks"]')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const all = useMemo(() => tasks.data?.items ?? [], [tasks.data])
  const domains = [...new Set(all.map((t) => t.domain))].sort()
  const clients = [...new Set(all.map((t) => t.client_code))].sort()
  const q = f.q.toLowerCase()
  const visible = all
    .filter(
      (t) =>
        (!q ||
          `${t.code} ${t.title} ${t.requirements.map((r) => r.skill.name).join(' ')}`
            .toLowerCase()
            .includes(q)) &&
        (!f.priority || t.priority === f.priority) &&
        (!f.domain || t.domain === f.domain) &&
        (!f.client || t.client_code === f.client),
    )
    .sort(COMPARE[f.sort] ?? byStart)
  const rows = visible.slice((page - 1) * size, page * size)

  const active: { label: string; key: keyof typeof DEFAULTS }[] = [
    ...(f.priority
      ? [
          {
            label: `Priority: ${priorityLabel(f.priority as TaskPriority)}`,
            key: 'priority' as const,
          },
        ]
      : []),
    ...(f.domain ? [{ label: `Domain: ${domainLabel(f.domain)}`, key: 'domain' as const }] : []),
    ...(f.client ? [{ label: `Client: ${f.client}`, key: 'client' as const }] : []),
    ...(f.q ? [{ label: `Search: “${f.q}”`, key: 'q' as const }] : []),
  ]
  const chips = active.map((c) => ({ label: c.label, onRemove: () => set({ [c.key]: '' }) }))
  const clear = () => set({ q: '', priority: '', domain: '', client: '' })

  const columns: Column<Task>[] = [
    {
      key: 'title',
      header: 'Task',
      sortKey: 'title',
      cell: (t) => (
        <div className="min-w-0">
          <Link
            to={`/tasks/${t.id}`}
            aria-label={`${t.title}, ${t.code}`}
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {t.title}
          </Link>
          <div className="text-muted-foreground text-xs">
            {t.code} · {domainLabel(t.domain)} · {levelLabel(t.required_level)}
          </div>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      sortKey: 'priority',
      cell: (t) => <PriorityBadge priority={t.priority} short />,
    },
    { key: 'client', header: 'Client', cell: (t) => t.client_code },
    {
      key: 'skills',
      header: 'Must-have skills',
      cell: (t) => {
        const must = t.requirements.filter((r) => r.must_have)
        return (
          <div className="flex max-w-64 flex-wrap gap-1">
            {must.slice(0, 3).map((r) => (
              <span key={r.skill.id} className="bg-muted rounded-md px-1.5 py-0.5 text-xs">
                {r.skill.name}
              </span>
            ))}
            {must.length > 3 && (
              <span className="text-muted-foreground px-1 py-0.5 text-xs">
                +{must.length - 3} more
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'start',
      header: 'Start',
      sortKey: 'start',
      cell: (t) => {
        const days = daysUntil(t.start_date, today)
        return (
          <div className="whitespace-nowrap">
            <div>{date(t.start_date)}</div>
            <div
              className={cn(
                'text-xs',
                view === 'open' && days <= 7
                  ? 'text-band-review-foreground font-medium'
                  : 'text-muted-foreground',
              )}
            >
              {view === 'open' ? startsLabel(days) : `for ${t.duration_weeks} weeks`}
            </div>
          </div>
        )
      },
    },
    { key: 'status', header: 'Status', cell: (t) => <TaskStatusBadge status={t.status} /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Roles that need people. Open a task to run matching and review the people it recommends."
        actions={
          canEdit && (
            <Button asChild>
              <Link to="/tasks/new">
                <Plus aria-hidden /> New task
              </Link>
            </Button>
          )
        }
      />

      <section aria-label="Task list" className="space-y-3">
        <Segmented
          label="Show tasks"
          value={view}
          onChange={(v) => set({ view: v })}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
        <FilterBar
          search={{
            value: f.q,
            onChange: (v) => set({ q: v }),
            placeholder: 'Search tasks or skills',
            label: 'Search tasks',
          }}
          filters={
            <>
              <FilterSelect
                label="Priority"
                value={f.priority}
                onChange={(v) => set({ priority: v })}
                allLabel="All priorities"
                options={PRIORITY_ORDER.map((p) => ({ value: p, label: priorityLabel(p) }))}
              />
              <FilterSelect
                label="Domain"
                value={f.domain}
                onChange={(v) => set({ domain: v })}
                allLabel="All domains"
                options={domains.map((d) => ({ value: d, label: domainLabel(d) }))}
              />
              <FilterSelect
                label="Client"
                value={f.client}
                onChange={(v) => set({ client: v })}
                allLabel="All clients"
                options={clients.map((c) => ({ value: c, label: c }))}
              />
            </>
          }
          sort={<SortSelect value={f.sort} onChange={(v) => set({ sort: v })} options={SORTS} />}
          chips={chips}
          onClear={clear}
        />

        {tasks.isPending ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : tasks.isError ? (
          <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
        ) : (
          <>
            <DataTable
              label="Tasks"
              rows={rows}
              columns={columns}
              rowKey={(t) => t.id}
              rowHref={(t) => `/tasks/${t.id}`}
              sort={f.sort}
              onSort={(v) => set({ sort: v })}
              empty={
                active.length > 0
                  ? { title: 'No tasks match these filters', body: 'Clear the search or filters.' }
                  : view === 'open'
                    ? {
                        title: 'No open tasks',
                        body: canEdit
                          ? 'Create a task to start finding people for it.'
                          : 'Tasks appear here when a manager creates them.',
                      }
                    : {
                        title: 'No closed tasks yet',
                        body: 'Tasks you mark as filled or cancel appear here.',
                      }
              }
            />
            {visible.length > 0 && (
              <Pagination
                total={visible.length}
                page={page}
                pageSize={size}
                noun="tasks"
                onPage={(p) => set({ page: String(p) })}
                onPageSize={(n) => set({ size: String(n) })}
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}
