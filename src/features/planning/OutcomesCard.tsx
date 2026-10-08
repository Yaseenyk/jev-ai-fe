import { HeartPulse } from 'lucide-react'
import { Link } from 'react-router'

import type { OutcomeResult } from '@/api/types'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge, type Tone } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAnswerOutcome, useTaskOutcomes } from '@/features/planning/insightsApi'
import { date } from '@/lib/format'

export const RESULTS: { value: OutcomeResult; label: string; tone: Tone }[] = [
  { value: 'working_well', label: 'Working well', tone: 'ready' },
  { value: 'struggling', label: 'Struggling', tone: 'attention' },
  { value: 'released_early', label: 'Released early', tone: 'danger' },
]

/** How the people placed on a filled task are doing (ADR 025): the model's real report card. */
export function OutcomesCard({ taskId, canAnswer }: { taskId: string; canAnswer: boolean }) {
  const outcomes = useTaskOutcomes(taskId, true)
  const answer = useAnswerOutcome(taskId)
  return (
    <section aria-label="How is it going?" className="bg-surface rounded-xl border">
      <div className="border-b px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <HeartPulse className="size-4" aria-hidden /> How is it going?
        </h2>
        <p className="text-muted-foreground text-xs">
          One click per person, any time after the start. It shows whether the model&apos;s
          recommendations work out, not just who was accepted.
        </p>
      </div>
      <div className="px-5 py-4">
        {outcomes.isPending ? (
          <Skeleton className="h-12" />
        ) : outcomes.isError ? (
          <ErrorState error={outcomes.error} />
        ) : outcomes.data.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nobody was accepted on this task&apos;s results, so there is nobody to check on.
          </p>
        ) : (
          <ul className="space-y-3">
            {outcomes.data.map((o) => {
              const current = RESULTS.find((r) => r.value === o.result)
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <Link
                      to={`/planning/people/${o.employee_id}`}
                      className="font-medium hover:underline"
                    >
                      {o.full_name}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {' '}
                      · ranked #{o.rank} · check due {date(o.due_on)}
                    </span>
                  </div>
                  {current && !canAnswer ? (
                    <StatusBadge tone={current.tone}>{current.label}</StatusBadge>
                  ) : canAnswer ? (
                    <div
                      className="flex flex-wrap gap-1"
                      role="group"
                      aria-label={`${o.full_name} outcome`}
                    >
                      {RESULTS.map((r) => (
                        <Button
                          key={r.value}
                          size="sm"
                          variant={o.result === r.value ? 'default' : 'outline'}
                          aria-pressed={o.result === r.value}
                          disabled={answer.isPending}
                          onClick={() => answer.mutate({ id: o.id, result: r.value })}
                        >
                          {r.label}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <StatusBadge tone="neutral">Not answered yet</StatusBadge>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
