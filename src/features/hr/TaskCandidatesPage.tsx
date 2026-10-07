import { Upload } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import { useHiringRequests, useTaskCandidates } from '@/features/hr/api'
import { CandidateStatusBadge, MatchReasons, RequestStatusBadge, ScoreBar } from '@/features/hr/ui'
import { useTask } from '@/features/tasks/api'
import { levelLabel, locationLabel } from '@/lib/format'

/** External candidates ranked for one task — where "no internal fit" leads. */
export default function TaskCandidatesPage() {
  const { taskId = '' } = useParams()
  const allowed = useManagesPeople()
  const task = useTask(taskId)
  const ranked = useTaskCandidates(taskId)
  const requests = useHiringRequests()
  if (!allowed) return <Navigate to={`/tasks/${taskId}`} replace />
  const request = requests.data?.find((r) => r.task_id === taskId && r.status !== 'closed')

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ to: `/tasks/${taskId}`, label: 'Back to the task' }}
        title={task.data ? `External candidates for ${task.data.code}` : 'External candidates'}
        meta={task.data ? `${task.data.title} · ${task.data.client_code}` : undefined}
        status={request && <RequestStatusBadge status={request.status} />}
        description="Candidates from the pool, ranked with the same rules and facts as employees. Their availability is their notice period."
        actions={
          <>
            {request && (
              <Button asChild variant="outline">
                <Link to={`/hiring-requests/${request.id}`}>Open the manager’s request</Link>
              </Button>
            )}
            <Button asChild>
              <Link to={request ? `/candidates/new?request=${request.id}` : '/candidates/new'}>
                <Upload aria-hidden /> Upload resume
              </Link>
            </Button>
          </>
        }
      />

      {ranked.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : ranked.isError ? (
        <ErrorState error={ranked.error} />
      ) : ranked.data.length === 0 ? (
        <EmptyState title="Nobody in the candidate pool fits this task yet">
          Download resumes from job sites and upload them; each is scored against open tasks.
        </EmptyState>
      ) : (
        <section className="space-y-3" aria-label="Ranking">
          <p className="text-muted-foreground text-sm">
            {ranked.data.length} {ranked.data.length === 1 ? 'candidate fits' : 'candidates fit'},
            best first.
            {request
              ? ' Send the best ones from the manager’s request.'
              : ' No manager has asked for candidates for this task yet.'}
          </p>
          <ul className="bg-surface divide-y rounded-xl border" aria-label="Ranked candidates">
            {ranked.data.map((m, i) => (
              <li key={m.candidate.id} className="flex gap-4 p-4">
                <span className="text-muted-foreground w-8 shrink-0 pt-0.5 text-sm font-medium tabular-nums">
                  #{i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/candidates/${m.candidate.id}`}
                      className="font-medium hover:underline"
                    >
                      {m.candidate.full_name}
                    </Link>
                    <CandidateStatusBadge status={m.candidate.status} />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {m.candidate.designation} · {levelLabel(m.candidate.level)} ·{' '}
                    {m.candidate.years_experience} yrs · {locationLabel(m.candidate.location)}
                  </p>
                  <MatchReasons match={m} />
                </div>
                <ScoreBar score={m.score} band={m.band} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
