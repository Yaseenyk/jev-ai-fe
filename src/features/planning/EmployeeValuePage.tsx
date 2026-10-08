import { Briefcase, CalendarClock, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router'

import type { ProjectLine } from '@/api/types'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { StatusBadge, type Tone } from '@/components/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth, useManagesPeople } from '@/features/auth/AuthProvider'
import { MarginBadge, usd } from '@/features/planning/PlanningPage'
import { ActionList } from '@/features/planning/RollOffsTab'
import { useEmployeeValue } from '@/features/planning/api'
import { useEmployeeActions } from '@/features/planning/insightsApi'
import { date, domainLabel, humanize, locationLabel, percent } from '@/lib/format'

const OUTCOME: Record<string, { label: string; tone: Tone }> = {
  successful: { label: 'Completed well', tone: 'ready' },
  ongoing: { label: 'Ongoing', tone: 'info' },
  early_release: { label: 'Released early', tone: 'attention' },
  escalated: { label: 'Escalated', tone: 'danger' },
}
const outcome = (o: string) => OUTCOME[o] ?? { label: humanize(o), tone: 'neutral' as Tone }

/** A person's value to the company, for planners (ADR 024). Never a salary (docs/08 §2). */
export default function EmployeeValuePage() {
  const { employeeId = '' } = useParams()
  const role = useAuth().user?.role
  const card = useEmployeeValue(employeeId)
  const managesPeople = useManagesPeople()
  const actions = useEmployeeActions(employeeId)
  if (role === 'viewer') return <Navigate to="/tasks" replace />
  if (card.isPending) return <Skeleton className="h-[32rem] w-full rounded-xl" />
  if (card.isError) return <ErrorState error={card.error} />
  const v = card.data

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ to: '/planning', label: 'Bench' }}
        title={v.full_name}
        actions={
          <Link
            to={`/planning/people/${v.employee_id}/profile`}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md px-3 text-sm font-medium"
          >
            Client profile
          </Link>
        }
        description={`${v.designation} · ${v.level} · ${humanize(v.practice)} · ${locationLabel(v.location)} · ${v.years_experience} years`}
        status={
          <StatusBadge
            tone={v.free_now_pct === 100 ? 'attention' : v.free_now_pct > 0 ? 'info' : 'neutral'}
          >
            {v.free_now_pct === 0
              ? `Busy until ${date(v.fully_free_from)}`
              : `${v.free_now_pct}% free now`}
          </StatusBadge>
        }
        meta={
          <span className="text-muted-foreground text-xs">
            {v.employee_code} · cost band {v.cost_band}
            {managesPeople && (
              <>
                {' · '}
                <Link to={`/employees/${v.employee_id}`} className="hover:underline">
                  Full profile
                </Link>
              </>
            )}
          </span>
        }
      />

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Revenue billed (estimate)"
          value={usd(v.estimated_revenue_usd)}
          hint={`${v.billed_weeks} weeks on client work`}
        />
        <Stat
          label="Clients served"
          value={String(v.clients.length)}
          hint={v.clients[0] ? `Most with ${v.clients[0].client_name}` : 'No client work yet'}
        />
        <Stat
          label="Managers' rating"
          value={v.average_rating === null ? '—' : `${v.average_rating} / 5`}
          hint={
            Object.entries(v.outcomes)
              .map(([o, n]) => `${n} ${outcome(o).label.toLowerCase()}`)
              .join(' · ') || 'No projects yet'
          }
        />
        <div className="bg-surface rounded-xl border p-4">
          <dt className="text-muted-foreground text-sm">Margin on billable work</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{v.margin.margin_pct}%</dd>
          <dd className="mt-1">
            <MarginBadge margin={v.margin} />
          </dd>
        </div>
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel title="Best next tasks" icon={<Briefcase className="size-4" aria-hidden />}>
            {v.next_tasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No open task fits yet: none has half its must-have skills at their level, in their
                band and when they are free.
              </p>
            ) : (
              <ul className="divide-y">
                {v.next_tasks.map((t) => (
                  <li key={t.task_id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link to={`/tasks/${t.task_id}`} className="font-medium hover:underline">
                        {t.task_code} · {t.title}
                      </Link>
                      <span className="text-muted-foreground text-xs">
                        starts {date(t.start_date)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="bg-muted h-1.5 w-40 overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-1.5 rounded-full"
                          style={{ width: percent(t.must_have_coverage) }}
                        />
                      </div>
                      <span className="text-xs tabular-nums">
                        {percent(t.must_have_coverage)} of must-haves
                      </span>
                    </div>
                    {t.missing_must_haves.length > 0 && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Missing: {t.missing_must_haves.join(', ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {actions.data && actions.data.length > 0 && (
            <Panel title="Planning actions">
              <ActionList actions={actions.data} />
            </Panel>
          )}

          <Panel title="Now" icon={<CalendarClock className="size-4" aria-hidden />}>
            {v.current.length === 0 && v.upcoming_leave.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {v.free_now_pct === 100
                  ? 'Not on any client project: available for the next task.'
                  : `${v.current_allocation_pct}% allocated until ${date(v.fully_free_from)}.`}
              </p>
            ) : (
              <div className="space-y-3">
                <ul className="space-y-3">
                  {v.current.map((p) => (
                    <ProjectRow key={`${p.project_code}-${p.start_date}`} p={p} />
                  ))}
                </ul>
                {v.upcoming_leave.map(([from, to]) => (
                  <p key={from} className="text-sm">
                    <StatusBadge tone="neutral">Leave</StatusBadge> {date(from)} – {date(to)}
                  </p>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Project history" icon={<Star className="size-4" aria-hidden />}>
            {v.history.length === 0 ? (
              <EmptyState title="No past projects recorded" />
            ) : (
              <ol className="space-y-4">
                {v.history.map((p) => (
                  <ProjectRow key={`${p.project_code}-${p.start_date}`} p={p} />
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Revenue by client">
            {v.clients.length === 0 ? (
              <p className="text-muted-foreground text-sm">No client work yet.</p>
            ) : (
              <ul className="space-y-3">
                {v.clients.map((c) => (
                  <li key={c.client_code} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{c.client_name}</span>
                      <span className="tabular-nums">{usd(c.estimated_revenue_usd)}</span>
                    </div>
                    <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-1.5 rounded-full"
                        style={{
                          width: percent(
                            v.estimated_revenue_usd
                              ? c.estimated_revenue_usd / v.estimated_revenue_usd
                              : 0,
                          ),
                        }}
                      />
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {c.projects} project{c.projects === 1 ? '' : 's'} · {c.weeks} weeks
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted-foreground mt-4 text-xs">
              Estimated: weeks on each project × the rate card&apos;s bill rate for band{' '}
              {v.cost_band} ({usd(v.margin.weekly_bill_usd)} a week). Salaries are never stored.
            </p>
          </Panel>

          <Panel title={`Skills (${v.skills.length})`}>
            <ul className="space-y-2">
              {v.skills.map((s) => (
                <li key={s.skill_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{s.name}</span>
                    {s.certified && (
                      <StatusBadge tone="ready" className="ml-1.5">
                        Certified
                      </StatusBadge>
                    )}
                    <span className="text-muted-foreground block text-xs">
                      {s.years} yrs · last used {date(s.last_used)}
                    </span>
                  </span>
                  <span
                    className="flex shrink-0 gap-0.5"
                    aria-label={`Level ${s.proficiency} of 5`}
                    title={`Level ${s.proficiency} of 5`}
                  >
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`size-2 rounded-full ${i <= s.proficiency ? 'bg-primary' : 'bg-muted'}`}
                      />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
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

function Panel({
  title,
  icon,
  children,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="bg-surface rounded-xl border">
      <h2 className="flex items-center gap-2 border-b px-5 py-3 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function ProjectRow({ p }: { p: ProjectLine }) {
  const o = outcome(p.outcome)
  return (
    <li className="list-none">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          {p.project_name}{' '}
          <span className="text-muted-foreground font-normal">· {p.client_name}</span>
        </span>
        <span className="text-muted-foreground text-xs">
          {date(p.start_date)} – {date(p.end_date)} · {p.weeks} weeks
        </span>
      </div>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {p.role_title} · {domainLabel(p.domain)} · {usd(p.estimated_revenue_usd)} billed
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <StatusBadge tone={o.tone}>{p.current ? 'Current' : o.label}</StatusBadge>
        {p.manager_rating !== null && (
          <StatusBadge tone="neutral">Rated {p.manager_rating} / 5</StatusBadge>
        )}
      </div>
    </li>
  )
}
