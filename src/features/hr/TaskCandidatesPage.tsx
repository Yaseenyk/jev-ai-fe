import { ArrowLeft, Upload } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router'

import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import { useHiringRequests, useTaskCandidates } from '@/features/hr/api'
import { CandidateStatusBadge, MatchReasons, ScoreBar } from '@/features/hr/ui'
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
      <Link
        to={`/tasks/${taskId}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to the task
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            External candidates{task.data ? ` for ${task.data.code} · ${task.data.title}` : ''}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Ranked with the same rules and facts as employees; availability is their notice period.
          </p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </header>

      {ranked.isPending ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : ranked.isError ? (
        <ErrorState error={ranked.error} />
      ) : ranked.data.length === 0 ? (
        <EmptyState title="Nobody in the candidate pool fits this task yet">
          Download resumes from job sites and upload them; each is scored against open tasks.
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-2xl border" aria-label="Ranked candidates">
          {ranked.data.map((m, i) => (
            <li key={m.candidate.id} className="flex gap-3 p-3">
              <span className="text-muted-foreground w-6 text-sm tabular-nums">#{i + 1}</span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/candidates/${m.candidate.id}`}
                    className="font-medium hover:underline"
                  >
                    {m.candidate.full_name}
                  </Link>
                  <span className="text-muted-foreground text-sm">
                    {m.candidate.designation} · {levelLabel(m.candidate.level)} ·{' '}
                    {locationLabel(m.candidate.location)}
                  </span>
                  <CandidateStatusBadge status={m.candidate.status} />
                </div>
                <MatchReasons match={m} />
              </div>
              <ScoreBar score={m.score} band={m.band} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
