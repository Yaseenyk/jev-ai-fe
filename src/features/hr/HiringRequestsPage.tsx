import { Link, Navigate } from 'react-router'

import { type Column, DataTable, Pagination } from '@/components/DataTable'
import { FilterBar, Segmented, SortSelect } from '@/components/FilterBar'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState } from '@/components/QueryStates'
import { useUrlState } from '@/components/useUrlState'
import { Skeleton } from '@/components/ui/skeleton'
import { useCanEdit, useManagesPeople } from '@/features/auth/AuthProvider'
import { useHiringRequests } from '@/features/hr/api'
import {
  type HiringRequestSummary,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUSES,
  type RequestStatus,
} from '@/features/hr/types'
import { RequestStatusBadge } from '@/features/hr/ui'
import { dateTime } from '@/lib/format'

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'task', label: 'Task code' },
]

const DEFAULTS = { status: '', q: '', sort: 'newest', page: '1', size: '25' }

/** New requests HR must start, and requests where the manager marked candidates fit. */
export const needsHr = (r: HiringRequestSummary) => r.status === 'new' || r.status === 'reviewed'

export default function HiringRequestsPage() {
  const isHr = useManagesPeople()
  const canEdit = useCanEdit()
  const [f, set] = useUrlState(DEFAULTS)
  const requests = useHiringRequests(undefined, isHr || canEdit)
  if (!isHr && !canEdit) return <Navigate to="/tasks" replace />

  const page = Math.max(1, Number(f.page) || 1)
  const size = Number(f.size) || 25
  const all = requests.data ?? []
  const q = f.q.trim().toLowerCase()
  const shown = all
    .filter((r) =>
      f.status === 'needs_you' ? needsHr(r) : !f.status || r.status === (f.status as RequestStatus),
    )
    .filter(
      (r) =>
        !q ||
        [r.task_code, r.task_title, r.client_code, r.requested_by].some((v) =>
          v.toLowerCase().includes(q),
        ),
    )
    .sort((a, b) =>
      f.sort === 'task'
        ? a.task_code.localeCompare(b.task_code)
        : f.sort === 'oldest'
          ? a.requested_at.localeCompare(b.requested_at)
          : b.requested_at.localeCompare(a.requested_at),
    )
  const rows = shown.slice((page - 1) * size, page * size)

  const statusOptions = [
    { value: '', label: 'All', count: all.length },
    ...(isHr
      ? [{ value: 'needs_you', label: 'Needs you', count: all.filter(needsHr).length }]
      : []),
    ...REQUEST_STATUSES.map((s) => ({
      value: s,
      label: REQUEST_STATUS_LABELS[s],
      count: all.filter((r) => r.status === s).length,
    })),
  ]
  const chips = [
    ...(f.status
      ? [
          {
            label: `Status: ${statusOptions.find((o) => o.value === f.status)?.label ?? f.status}`,
            onRemove: () => set({ status: '' }),
          },
        ]
      : []),
    ...(f.q ? [{ label: `Search: “${f.q}”`, onRemove: () => set({ q: '' }) }] : []),
  ]

  const columns: Column<HiringRequestSummary>[] = [
    {
      key: 'task',
      header: 'Task',
      sortKey: 'task',
      cell: (r) => (
        <div className="min-w-0">
          <Link
            to={`/hiring-requests/${r.id}`}
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {r.task_code} · {r.task_title}
          </Link>
          <div className="text-muted-foreground text-xs">{r.client_code}</div>
        </div>
      ),
    },
    {
      key: 'asked',
      header: 'Asked',
      sortKey: 'newest',
      cell: (r) => (
        <div>
          <div>{dateTime(r.requested_at)}</div>
          <div className="text-muted-foreground text-xs">by {r.requested_by}</div>
        </div>
      ),
    },
    { key: 'wanted', header: 'Wanted', align: 'right', cell: (r) => r.wanted },
    { key: 'sent', header: 'Sent', align: 'right', cell: (r) => r.sent_count },
    { key: 'fit', header: 'Marked fit', align: 'right', cell: (r) => r.fit_count },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <RequestStatusBadge status={r.status} />,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={isHr ? 'Hiring requests' : 'My requests to HR'}
        description={
          isHr
            ? 'Requests from managers whose tasks have no internal fit. Send each one up to 10 candidates.'
            : 'Candidates HR found for your tasks. Open a request to mark each candidate fit or not a fit.'
        }
      />

      <section aria-label="Request list" className="space-y-3">
        <FilterBar
          search={{
            value: f.q,
            onChange: (v) => set({ q: v }),
            placeholder: 'Task, client or manager',
            label: 'Search requests',
          }}
          sort={<SortSelect value={f.sort} onChange={(sort) => set({ sort })} options={SORTS} />}
          chips={chips}
          onClear={() => set({ status: '', q: '' })}
        />
        <div className="overflow-x-auto">
          <Segmented
            label="Filter by status"
            value={f.status}
            onChange={(status) => set({ status })}
            options={statusOptions}
          />
        </div>

        {requests.isPending ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : requests.isError ? (
          <ErrorState error={requests.error} />
        ) : (
          <>
            <DataTable
              label="Requests"
              rows={rows}
              columns={columns}
              rowKey={(r) => r.id}
              rowHref={(r) => `/hiring-requests/${r.id}`}
              sort={f.sort}
              onSort={(sort) => set({ sort })}
              empty={
                all.length === 0
                  ? {
                      title: 'No requests yet',
                      body: isHr
                        ? 'Requests appear here when a manager asks for candidates.'
                        : 'When nobody internal fits a task, use “Ask HR for candidates” on its results.',
                    }
                  : { title: 'No requests match', body: 'Clear the search or the status filter.' }
              }
            />
            {shown.length > 0 && (
              <Pagination
                total={shown.length}
                page={page}
                pageSize={size}
                noun="requests"
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
