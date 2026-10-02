import { date } from '@/lib/format'

/** The runway is the next six weeks; the marker sits on the task's start date. */
export const RUNWAY_WEEKS = 6
const RUNWAY_DAYS = RUNWAY_WEEKS * 7
const DAY_MS = 86_400_000

export function daysUntil(isoDate: string, today: Date): number {
  const start = new Date(`${isoDate}T00:00:00`)
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((start.getTime() - base.getTime()) / DAY_MS)
}

export function startsLabel(days: number): string {
  if (days === 0) return 'Starts today'
  if (days === 1) return 'Starts tomorrow'
  if (days < 0) return `Started ${-days} ${days === -1 ? 'day' : 'days'} ago`
  if (days < 14) return `Starts in ${days} days`
  return `Starts in ${Math.round(days / 7)} weeks`
}

export function StartRunway({
  startDate,
  durationWeeks,
  today,
}: {
  startDate: string
  durationWeeks: number
  today: Date
}) {
  const days = daysUntil(startDate, today)
  const beyond = days > RUNWAY_DAYS
  const pos = Math.min(Math.max(days, 0), RUNWAY_DAYS) / RUNWAY_DAYS

  return (
    <div className="w-full space-y-2">
      <div
        role="img"
        aria-label={`Starts ${date(startDate)}, runs ${durationWeeks} weeks`}
        className="relative h-3"
      >
        {/* week marks */}
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between">
          {Array.from({ length: RUNWAY_WEEKS + 1 }, (_, i) => (
            <span key={i} className="bg-border h-2 w-px" />
          ))}
        </div>
        {/* time before the start, then the task itself */}
        <span
          className="bg-border absolute top-1/2 left-0 h-0.5 -translate-y-1/2"
          style={{ width: `${pos * 100}%` }}
        />
        <span
          className="bg-primary/25 absolute top-1/2 right-0 h-1 -translate-y-1/2 rounded-full"
          style={{ left: `${pos * 100}%` }}
        />
        <span
          className="bg-primary ring-surface absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
          style={{ left: `${pos * 100}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-foreground font-medium">
          {startsLabel(days)}
          {beyond && <span className="sr-only"> (beyond the 6-week view)</span>}
        </span>
        <span className="text-muted-foreground tabular-nums">for {durationWeeks} weeks</span>
      </div>
    </div>
  )
}
