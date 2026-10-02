import { ArrowLeft, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import type { Band, DecisionDefinition, MatchRun, ShortlistItem } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RunStatusBadge } from '@/features/runs/RunStatusBadge'
import { isActive, useDecisionDefinitions, useMatchRun } from '@/features/runs/api'
import { ExcludedPanel, ReasonCounts } from '@/features/shortlist/ExcludedPanel'
import { ShortlistItemCard } from '@/features/shortlist/ShortlistItemCard'
import { useExcluded, useShortlist, useSubmitFeedback } from '@/features/shortlist/api'
import {
  BAND_LABELS,
  dateTime,
  FILTER_REASON_FIXES,
  FILTER_REASON_LABELS,
  humanize,
} from '@/lib/format'

const OPEN_BY_DEFAULT = 3

export default function RunPage() {
  const { runId = '' } = useParams()
  const run = useMatchRun(runId)

  if (run.isPending) return <Skeleton className="h-48 w-full" />
  if (run.isError) return <ErrorState error={run.error} onRetry={() => void run.refetch()} />

  return (
    <div className="space-y-5">
      <Link
        to={`/tasks/${run.data.task_id}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to task
      </Link>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Matching results</h1>
        <RunStatusBadge status={run.data.status} />
      </div>

      {isActive(run.data) ? (
        <RunProgress run={run.data} />
      ) : run.data.status === 'failed' ? (
        <Alert variant="destructive">
          <AlertTitle>This run failed</AlertTitle>
          <AlertDescription>
            {run.data.error ?? 'Unknown error'}. No partial shortlist is shown. Go back to the task
            to run it again.
          </AlertDescription>
        </Alert>
      ) : (
        <CompletedRun run={run.data} />
      )}
    </div>
  )
}

function RunProgress({ run }: { run: MatchRun }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-6">
        <Loader2 className="text-primary size-5 animate-spin" aria-hidden />
        <div>
          <p className="font-medium">
            {run.status === 'queued' ? 'Waiting to start…' : 'Matching in progress…'}
          </p>
          <p className="text-muted-foreground text-sm">
            Checking availability and constraints, then scoring each remaining person. This page
            updates by itself.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function CompletedRun({ run }: { run: MatchRun }) {
  const definitions = useDecisionDefinitions()
  const items = useShortlist(run.id, true)
  const excluded = useExcluded(run.id, true)
  const feedback = useSubmitFeedback(run.id)
  const [showHidden, setShowHidden] = useState(false)

  if (items.isPending || definitions.isPending) return <Skeleton className="h-64 w-full" />
  if (items.isError) return <ErrorState error={items.error} onRetry={() => void items.refetch()} />
  if (definitions.isError) return <ErrorState error={definitions.error} />

  const byBand = (b: Band) => items.data.filter((i) => i.band === b)
  const counts = {
    shortlist: byBand('shortlist'),
    review: byBand('review'),
    hidden: byBand('hidden'),
  }

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="People considered" value={run.candidate_count} />
        <Stat label="Ranked by AI" value={run.retrieved_count} />
        <Stat label={BAND_LABELS.shortlist} value={counts.shortlist.length} />
        <Stat label={BAND_LABELS.review} value={counts.review.length} />
      </dl>

      <OutcomeNotice
        run={run}
        excludedTotal={excluded.data?.total ?? null}
        ranked={items.data.length}
      />

      {feedback.isError && <ErrorState error={feedback.error} />}

      {items.data.length > 0 && (
        <>
          <BandSection
            title="Shortlist"
            hint="High confidence and no warnings."
            items={counts.shortlist}
            definitions={definitions.data}
            feedback={feedback}
          />
          <BandSection
            title="Review"
            hint="Worth a look: medium confidence, or a warning stopped it from being shortlisted."
            items={counts.review}
            definitions={definitions.data}
            feedback={feedback}
          />
          {counts.hidden.length > 0 && (
            <div className="space-y-2">
              <Button variant="outline" size="sm" onClick={() => setShowHidden((s) => !s)}>
                {showHidden ? 'Hide' : 'Show'} {counts.hidden.length} low-confidence people
              </Button>
              {showHidden && (
                <BandSection
                  title="Hidden"
                  hint="Low confidence. Shown only on request."
                  items={counts.hidden}
                  definitions={definitions.data}
                  feedback={feedback}
                />
              )}
            </div>
          )}
        </>
      )}

      {excluded.isSuccess && excluded.data.total > 0 && (
        <ExcludedPanel
          excluded={excluded.data.items}
          total={excluded.data.total}
          counts={run.filter_reason_counts}
        />
      )}

      <footer className="text-muted-foreground border-t pt-3 text-xs">
        Model {run.model ?? 'not needed (nobody reached scoring)'} · Decisions{' '}
        {run.decision_set_version} · Thresholds {run.thresholds_version} · Finished{' '}
        {run.finished_at ? dateTime(run.finished_at) : 'n/a'}
      </footer>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border px-4 py-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function BandSection({
  title,
  hint,
  items,
  definitions,
  feedback,
}: {
  title: string
  hint: string
  items: ShortlistItem[]
  definitions: DecisionDefinition[]
  feedback: ReturnType<typeof useSubmitFeedback>
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold">
          {title}{' '}
          <span className="text-muted-foreground text-sm font-normal">({items.length})</span>
        </h2>
        <p className="text-muted-foreground text-sm">{hint}</p>
      </div>
      {items.length === 0 ? (
        <EmptyState title={`Nobody in ${title.toLowerCase()}`} />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ShortlistItemCard
              key={item.id}
              item={item}
              definitions={definitions}
              defaultOpen={item.rank <= OPEN_BY_DEFAULT}
              saving={feedback.isPending && feedback.variables.itemId === item.id}
              onFeedback={(input) => feedback.mutate({ itemId: item.id, input })}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function biggestBlocker(counts: Record<string, number>): [string, number] | null {
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top ?? null
}

function OutcomeNotice({
  run,
  excludedTotal,
  ranked,
}: {
  run: MatchRun
  excludedTotal: number | null
  ranked: number
}) {
  const blocker = biggestBlocker(run.filter_reason_counts)
  const blockerLine = blocker && (
    <p>
      Biggest blocker:{' '}
      <span className="font-medium">
        {FILTER_REASON_LABELS[blocker[0]] ?? humanize(blocker[0])}
      </span>{' '}
      ({blocker[1]} of {run.candidate_count} people). {FILTER_REASON_FIXES[blocker[0]] ?? ''}
    </p>
  )

  if (run.run_flags.includes('no_eligible_candidates')) {
    return (
      <Alert>
        <AlertTitle>Nobody matched: no one passed the rules for this task</AlertTitle>
        <AlertDescription className="space-y-2">
          {blockerLine}
          <p>Rules are never relaxed automatically. Change the task to widen the search.</p>
          <ReasonCounts counts={run.filter_reason_counts} />
        </AlertDescription>
      </Alert>
    )
  }
  // Runs saved before the no_skill_match flag existed carry few_candidates with nobody ranked.
  const noSkillMatch =
    run.run_flags.includes('no_skill_match') ||
    (run.run_flags.includes('few_candidates') && ranked === 0)
  if (noSkillMatch) {
    const passed = excludedTotal === null ? null : run.candidate_count - excludedTotal
    return (
      <Alert>
        <AlertTitle>Nobody matched: no one has the must-have skills</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            {passed === null ? 'Some people' : `${passed} ${passed === 1 ? 'person' : 'people'}`}{' '}
            passed the rules, but none has a must-have skill at the required level. Lower the
            minimum proficiency, or move a skill from must-have to nice-to-have.
          </p>
          {blockerLine}
        </AlertDescription>
      </Alert>
    )
  }
  if (run.run_flags.includes('few_candidates')) {
    return (
      <Alert>
        <AlertTitle>
          Only {ranked} {ranked === 1 ? 'person fits' : 'people fit'} the basic requirements
        </AlertTitle>
        <AlertDescription className="space-y-2">
          <p>Review them carefully. To widen the search:</p>
          {blockerLine}
        </AlertDescription>
      </Alert>
    )
  }
  return null
}
