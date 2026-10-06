import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import { useHiringRequests } from '@/features/hr/api'
import { REQUEST_STATUS_LABELS, REQUEST_STATUSES, type RequestStatus } from '@/features/hr/types'
import { RequestStatusBadge } from '@/features/hr/ui'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function HiringRequestsPage() {
  const isHr = useManagesPeople()
  const [status, setStatus] = useState<RequestStatus | ''>('')
  const requests = useHiringRequests(status || undefined)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">
          {isHr ? 'Hiring requests' : 'My requests to HR'}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isHr
            ? 'Requests from managers whose tasks have no internal fit. Send each one up to 10 candidates.'
            : 'Candidates HR found for your tasks. Open a request to mark each candidate fit or not a fit.'}
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        {(['', ...REQUEST_STATUSES] as const).map((s) => (
          <button
            key={s || 'all'}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              status === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-accent/50',
            )}
          >
            {s ? REQUEST_STATUS_LABELS[s] : 'All'}
          </button>
        ))}
      </div>

      {requests.isPending ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : requests.isError ? (
        <ErrorState error={requests.error} />
      ) : requests.data.length === 0 ? (
        <EmptyState title="No requests here">
          {isHr
            ? 'Requests appear when a manager asks for candidates.'
            : 'When nobody internal fits a task, use “Ask HR for candidates” on its results.'}
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-2xl border" aria-label="Requests">
          {requests.data.map((r) => (
            <li key={r.id}>
              <Link
                to={`/hiring-requests/${r.id}`}
                className="hover:bg-accent/40 flex flex-wrap items-center gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.task_code} · {r.task_title}
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    {r.client_code} · asked by {r.requested_by} · {dateTime(r.requested_at)}
                  </p>
                </div>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {r.sent_count
                    ? `${r.sent_count} sent · ${r.fit_count} fit`
                    : `${r.wanted} wanted`}
                </span>
                <RequestStatusBadge status={r.status} />
                <ArrowRight className="text-muted-foreground size-4" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
