import { ArrowRightLeft } from 'lucide-react'
import { Link } from 'react-router'

import type { HireOrMove } from '@/api/types'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge, type Tone } from '@/components/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { MarginBadge } from '@/features/planning/PlanningPage'
import { useHireOrMove } from '@/features/planning/api'
import { BAND_LABELS, date, percent } from '@/lib/format'

const NEITHER = { label: 'Nobody fits yet', tone: 'attention' as Tone }
const ANSWER: Record<string, { label: string; tone: Tone }> = {
  move_internal: { label: 'Move someone inside', tone: 'ready' },
  hire: { label: 'Hire from outside', tone: 'info' },
  neither: { label: 'Nobody fits yet', tone: 'attention' },
}

/** The best person inside next to the best outside candidate, and which way to go (ADR 024). */
export function HireOrMoveCard({ taskId }: { taskId: string }) {
  const q = useHireOrMove(taskId)
  return (
    <section aria-label="Hire or move internally" className="bg-surface rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ArrowRightLeft className="size-4" aria-hidden /> Hire or move internally
          </h2>
          <p className="text-muted-foreground text-xs">
            Best person inside against the best outside candidate, by fit, start date and margin.
          </p>
        </div>
        {q.data && (
          <StatusBadge tone={(ANSWER[q.data.recommendation] ?? NEITHER).tone}>
            {(ANSWER[q.data.recommendation] ?? NEITHER).label}
          </StatusBadge>
        )}
      </div>
      <div className="px-5 py-4">
        {q.isPending ? (
          <Skeleton className="h-16" />
        ) : q.isError ? (
          <ErrorState error={q.error} />
        ) : (
          <Body h={q.data} />
        )}
      </div>
    </section>
  )
}

function Body({ h }: { h: HireOrMove }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">Inside</p>
          {h.internal ? (
            <div className="mt-1 space-y-1">
              <Link
                to={`/employees/${h.internal.employee_id}`}
                className="font-medium hover:underline"
              >
                {h.internal.full_name}
              </Link>
              <p className="text-muted-foreground text-xs">
                {h.internal.employee_code} · free from {date(h.internal.available_from)}
              </p>
              <div className="flex flex-wrap gap-1">
                <StatusBadge tone="ready">
                  {BAND_LABELS[h.internal.band]} · {percent(h.internal.score)}
                </StatusBadge>
                <MarginBadge margin={h.internal.margin} />
              </div>
            </div>
          ) : (
            <p className="mt-1">No recommended person yet.</p>
          )}
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">Outside</p>
          {h.external ? (
            <div className="mt-1 space-y-1">
              <Link
                to={`/candidates/${h.external.candidate_id}`}
                className="font-medium hover:underline"
              >
                {h.external.full_name}
              </Link>
              <p className="text-muted-foreground text-xs">
                {h.external.notice_days} days&apos; notice
              </p>
              <div className="flex flex-wrap gap-1">
                <StatusBadge tone="info">
                  {BAND_LABELS[h.external.band]} · {percent(h.external.score)}
                </StatusBadge>
                {h.external.margin && <MarginBadge margin={h.external.margin} />}
              </div>
            </div>
          ) : (
            <p className="mt-1">No outside candidate passes this task&apos;s rules.</p>
          )}
        </div>
      </div>
      <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-xs">
        {h.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  )
}
