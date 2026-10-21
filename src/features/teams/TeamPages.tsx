import { GraduationCap, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'

import type { Team, TeamPerson } from '@/api/types'
import { type Column, DataTable } from '@/components/DataTable'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import { UnitBadge } from '@/features/org/UnitBadge'
import { useDeleteTeam, useTeam, useTeams } from '@/features/teams/api'
import { date } from '@/lib/format'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()

const planners = new Set(['admin', 'resource_manager', 'hr'])
const editors = new Set(['admin', 'resource_manager'])

/** Every team managers have put together (ADR 039). */
export function TeamsPage() {
  const role = useAuth().user?.role ?? ''
  const teams = useTeams()
  if (!planners.has(role)) return <Navigate to="/tasks" replace />

  const columns: Column<Team>[] = [
    {
      key: 'task',
      header: 'Task',
      sortValue: (t) => t.task.code,
      cell: (t) => (
        <div>
          <p className="font-medium">{t.task.title}</p>
          <p className="text-muted-foreground text-xs">
            {t.task.code} · {t.task.client_code}
          </p>
        </div>
      ),
    },
    {
      key: 'lead',
      header: 'Team Lead',
      sortValue: (t) => t.lead?.full_name ?? '',
      cell: (t) => t.lead?.full_name ?? '—',
    },
    {
      key: 'size',
      header: 'People',
      align: 'right',
      sortValue: (t) => t.members.length + 1,
      cell: (t) => `${t.members.length + (t.lead ? 1 : 0)} of ${t.task.headcount}`,
    },
    {
      key: 'shadow',
      header: 'Shadow',
      cell: (t) => t.shadow?.full_name ?? <span className="text-muted-foreground">None</span>,
    },
    {
      key: 'start',
      header: 'Starts',
      sortValue: (t) => t.task.start_date,
      cell: (t) => date(t.task.start_date),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Teams"
        description="Teams put together for tasks: a lead, the people under the lead, and sometimes a shadow who learns alongside."
        actions={
          editors.has(role) && (
            <Button asChild>
              <Link to="/teams/new">
                <Plus aria-hidden /> Build a team
              </Link>
            </Button>
          )
        }
      />
      {teams.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : teams.isError ? (
        <ErrorState error={teams.error} />
      ) : (
        <DataTable
          label="Teams"
          rows={teams.data}
          columns={columns}
          rowKey={(t) => t.id}
          rowHref={(t) => `/teams/${t.id}`}
          empty={{
            title: 'No teams yet',
            body: 'Build a team for a task: pick its lead, the people under the lead and an optional shadow.',
          }}
        />
      )}
    </div>
  )
}

function PersonCard({ p, note }: { p: TeamPerson; note?: string }) {
  return (
    <div className="bg-surface flex items-center gap-3 rounded-xl border p-4">
      <span className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold">
        {initials(p.full_name)}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          to={`/planning/people/${p.employee_id}`}
          className="block truncate font-medium hover:underline"
        >
          {p.full_name}
        </Link>
        <p className="text-muted-foreground text-xs">
          {p.employee_code} · {p.designation} · {p.level} · {p.allocation_pct}% of their time
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {note && <StatusBadge tone="neutral">{note}</StatusBadge>}
          <UnitBadge unit={p.business_unit} />
        </div>
      </div>
    </div>
  )
}

/** One team: its lead, members and shadow, with the task it is for. */
export function TeamPage() {
  const { teamId = '' } = useParams()
  const role = useAuth().user?.role ?? ''
  const team = useTeam(teamId)
  const remove = useDeleteTeam()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  if (!planners.has(role)) return <Navigate to="/tasks" replace />
  if (team.isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (team.isError) return <ErrorState error={team.error} />
  const t = team.data

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ to: '/teams', label: 'All teams' }}
        title={`Team for ${t.task.code}`}
        meta={
          <>
            {t.task.title} · {t.task.client_code} · starts {date(t.task.start_date)} for{' '}
            {t.task.duration_weeks} weeks
          </>
        }
        description={`Put together ${t.created_by ? `by ${t.created_by} ` : ''}on ${date(t.created_at.slice(0, 10))}. A plan: accept each person on the task.`}
        actions={
          <>
            <Button asChild>
              <Link to={`/tasks/${t.task.task_id}`}>
                <Users aria-hidden /> Open task to accept people
              </Link>
            </Button>
            {editors.has(role) && (
              <>
                <Button asChild variant="outline">
                  <Link to={`/teams/new?task=${t.task.task_id}`}>
                    <Pencil aria-hidden /> Change team
                  </Link>
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(true)}>
                  <Trash2 aria-hidden /> Delete
                </Button>
              </>
            )}
          </>
        }
      />

      <section aria-label="Team Lead" className="space-y-2">
        <h2 className="text-sm font-semibold">Team Lead</h2>
        {t.lead ? (
          <div className="max-w-md">
            <PersonCard p={t.lead} note="Leads the team" />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">The lead is no longer an employee.</p>
        )}
      </section>

      <section aria-label="Members" className="space-y-2">
        <h2 className="text-sm font-semibold">
          Members ({t.members.length + (t.lead ? 1 : 0)} of {t.task.headcount} with the lead)
        </h2>
        {t.members.length === 0 ? (
          <p className="text-muted-foreground text-sm">The lead is the whole team.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {t.members.map((m) => (
              <PersonCard key={m.employee_id} p={m} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Shadow" className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <GraduationCap className="size-4" aria-hidden /> Shadow
        </h2>
        {t.shadow ? (
          <div className="max-w-md rounded-xl border border-dashed p-1">
            <PersonCard p={t.shadow} note="Learning, not billed" />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No shadow for this team.</p>
        )}
      </section>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this team?</DialogTitle>
            <DialogDescription>
              The task and its matching results stay. You can build a new team for it later.
            </DialogDescription>
          </DialogHeader>
          {remove.isError && <ErrorState error={remove.error} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(t.id, { onSuccess: () => void navigate('/teams', { replace: true }) })
              }
            >
              Delete team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
