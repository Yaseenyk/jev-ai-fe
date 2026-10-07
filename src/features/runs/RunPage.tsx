import { Loader2, Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { ApiError } from '@/api/client'
import type { Band, DecisionDefinition, MatchRun, ShortlistItem, Thresholds } from '@/api/types'
import { Segmented } from '@/components/FilterBar'
import { PageHeader } from '@/components/PageHeader'
import { FeedbackPrompt } from '@/components/FeedbackPrompt'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { useUrlState } from '@/components/useUrlState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCanEdit } from '@/features/auth/AuthProvider'
import { Funnel } from '@/features/runs/Funnel'
import { ResultsQA } from '@/features/runs/ResultsQA'
import { RunStatusBadge } from '@/features/runs/RunStatusBadge'
import { isActive, useDecisionDefinitions, useMatchRun } from '@/features/runs/api'
import { NoInternalFit } from '@/features/hr/NoInternalFit'
import { ExcludedPanel, ReasonCounts } from '@/features/shortlist/ExcludedPanel'
import { ShortlistItemCard } from '@/features/shortlist/ShortlistItemCard'
import { useExcluded, useShortlist, useSubmitFeedback } from '@/features/shortlist/api'
import { useTask } from '@/features/tasks/api'
import { dateTime, FILTER_REASON_FIXES, FILTER_REASON_LABELS, humanize } from '@/lib/format'

const OPEN_BY_DEFAULT = 1

const BANDS: { band: Band; title: string; hint: string }[] = [
  { band: 'shortlist', title: 'Shortlist', hint: 'High confidence and no warnings.' },
  {
    band: 'review',
    title: 'Review',
    hint: 'Worth a look: medium confidence, or a warning stopped it from being shortlisted.',
  },
  { band: 'hidden', title: 'Low confidence', hint: 'Shown only on request.' },
]

const DECISIONS = [
  { value: '', label: 'Any decision' },
  { value: 'todo', label: 'Not decided' },
  { value: 'accept', label: 'Accepted' },
  { value: 'reject', label: 'Rejected' },
]

export default function RunPage() {
  const { runId = '' } = useParams()
  const run = useMatchRun(runId)
  const task = useTask(run.data?.task_id ?? '', run.isSuccess)

  if (run.isPending) return <Skeleton className="h-48 w-full" />
  if (run.isError && run.error instanceof ApiError && run.error.status === 404) {
    // Retrying cannot bring a removed run back (e.g. after the data was reset): offer a way on.
    return (
      <EmptyState title="This matching run no longer exists">
        <p>
          It may have been removed when the data was reset. Open the task and run matching again.
        </p>
        <Button asChild className="mt-4">
          <Link to="/tasks">Back to tasks</Link>
        </Button>
      </EmptyState>
    )
  }
  if (run.isError) return <ErrorState error={run.error} onRetry={() => void run.refetch()} />

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ to: `/tasks/${run.data.task_id}`, label: 'Back to task' }}
        title="Matching results"
        status={<RunStatusBadge status={run.data.status} />}
        meta={
          task.data && (
            <>
              <span className="font-mono">{task.data.code}</span> · {task.data.title}
              {run.data.finished_at && ` · Finished ${dateTime(run.data.finished_at)}`}
            </>
          )
        }
        description="People recommended for this task, best fit first. Accept the ones you want to consider and reject the rest with a reason. Nobody is assigned automatically."
      />

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
    <div className="bg-surface flex items-center gap-3 rounded-xl border px-5 py-6">
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
    </div>
  )
}

function CompletedRun({ run }: { run: MatchRun }) {
  const definitions = useDecisionDefinitions()
  const items = useShortlist(run.id, true)
  const excluded = useExcluded(run.id, true)
  const feedback = useSubmitFeedback(run.id)
  const [f, set] = useUrlState({ band: 'recommended', decision: '' })

  if (items.isPending || definitions.isPending) return <Skeleton className="h-64 w-full" />
  if (items.isError) return <ErrorState error={items.error} onRetry={() => void items.refetch()} />
  if (definitions.isError) return <ErrorState error={definitions.error} />

  const byBand = (b: Band) => items.data.filter((i) => i.band === b)
  const counts: Record<Band, ShortlistItem[]> = {
    shortlist: byBand('shortlist'),
    review: byBand('review'),
    hidden: byBand('hidden'),
  }
  const recommended = [...counts.shortlist, ...counts.review]
  const decidedCount = recommended.filter((i) => i.feedback).length
  const shownBands = BANDS.filter((b) =>
    f.band === 'recommended' ? b.band !== 'hidden' : b.band === f.band,
  )
  const matchesDecision = (i: ShortlistItem) =>
    !f.decision || (f.decision === 'todo' ? !i.feedback : i.feedback?.action === f.decision)

  return (
    <div className="space-y-6">
      <Funnel
        run={run}
        excludedTotal={excluded.data?.total ?? null}
        bands={{
          shortlist: counts.shortlist.length,
          review: counts.review.length,
          hidden: counts.hidden.length,
        }}
      />

      <OutcomeNotice
        run={run}
        excludedTotal={excluded.data?.total ?? null}
        ranked={items.data.length}
      />

      {recommended.length === 0 && <NoInternalFit taskId={run.task_id} />}

      {(items.data.length > 0 || (excluded.data?.total ?? 0) > 0) && (
        <ResultsQA
          ctx={{
            run,
            items: [...items.data].sort((a, b) => a.rank - b.rank),
            excluded: excluded.data?.items ?? [],
            excludedTotal: excluded.data?.total ?? 0,
            definitions: definitions.data,
          }}
        />
      )}

      {items.data.length > 0 && (
        <FeedbackPrompt
          area="match_results"
          targetId={run.id}
          question="Were these recommendations right?"
        />
      )}

      {feedback.isError && <ErrorState error={feedback.error} />}

      {items.data.length > 0 && (
        <section aria-label="Recommended people" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Show people"
              value={f.band}
              onChange={(band) => set({ band })}
              options={[
                { value: 'recommended', label: 'Recommended', count: recommended.length },
                { value: 'shortlist', label: 'Shortlist', count: counts.shortlist.length },
                { value: 'review', label: 'Review', count: counts.review.length },
                { value: 'hidden', label: 'Low confidence', count: counts.hidden.length },
              ]}
            />
            <Segmented
              label="Decision"
              value={f.decision}
              onChange={(decision) => set({ decision })}
              options={DECISIONS}
            />
            {recommended.length > 0 && (
              <p className="text-muted-foreground ml-auto text-sm tabular-nums">
                Decided {decidedCount} of {recommended.length} recommended
              </p>
            )}
          </div>
          {shownBands.map((b) => (
            <BandSection
              key={b.band}
              title={b.title}
              hint={b.hint}
              items={counts[b.band].filter(matchesDecision)}
              filtered={f.decision !== ''}
              definitions={definitions.data}
              thresholds={run.thresholds}
              feedback={feedback}
            />
          ))}
        </section>
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

function BandSection({
  title,
  hint,
  items,
  filtered,
  definitions,
  thresholds,
  feedback,
}: {
  title: string
  hint: string
  items: ShortlistItem[]
  filtered: boolean
  definitions: DecisionDefinition[]
  thresholds: Thresholds | null | undefined
  feedback: ReturnType<typeof useSubmitFeedback>
}) {
  return (
    <section aria-label={title} className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-base font-semibold">
          {title}{' '}
          <span className="text-muted-foreground text-sm font-normal tabular-nums">
            ({items.length})
          </span>
        </h2>
        <p className="text-muted-foreground text-sm">{hint}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-3 text-sm">
          {filtered
            ? `Nobody in ${title.toLowerCase()} with this decision.`
            : `Nobody in ${title.toLowerCase()} for this run.`}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ShortlistItemCard
              key={item.id}
              item={item}
              definitions={definitions}
              thresholds={thresholds}
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
  const canEdit = useCanEdit()
  const editLink = canEdit && (
    <Button asChild size="sm" variant="outline" className="mt-1">
      <Link to={`/tasks/${run.task_id}/edit`}>
        <Pencil /> Edit task to widen the search
      </Link>
    </Button>
  )
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
          {editLink}
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
          {editLink}
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
