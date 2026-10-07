import { Download, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'

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
import type { FeedbackReport } from '@/api/types'
import {
  downloadTrainingData,
  useFeedbackReports,
  useLearning,
  useMakeFeedbackReport,
  useSetThemeStatus,
} from '@/features/admin/api'
import { REJECT_REASON_LABELS, dateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const SKIPPED_LABELS: Record<string, string> = {
  planning_reason: 'Planning reasons (availability, client preference, already planned)',
  no_model_input: 'From runs before the learning loop existed',
  older_decision_set: 'For an older version of the decision questions',
}

const MAPPING: [string, string][] = [
  ['Accepted', 'Overall fit: yes'],
  ['Rejected: skill gap', 'Overall fit: no, and skill match low'],
  ['Rejected: level mismatch', 'Overall fit: no, and level under or over (from the facts)'],
  ['Rejected: domain gap', 'Overall fit: no, and no domain experience'],
  ['Rejected: other', 'Overall fit: no (half weight)'],
  ['Availability, client preference, already planned', 'Not used: about planning, not fit'],
]

export function LearningTab() {
  const learning = useLearning()
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  if (learning.isPending) return <Skeleton className="h-64 w-full rounded-xl" />
  if (learning.isError) return <ErrorState error={learning.error} />
  const s = learning.data
  const reasons = Object.entries(s.rejected_by_reason).sort((a, b) => b[1] - a[1])
  const maxReason = Math.max(1, ...reasons.map(([, n]) => n))

  const download = async () => {
    setError(null)
    setDownloading(true)
    try {
      await downloadTrainingData()
    } catch (e) {
      setError(e)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <FeedbackReports />
      <p className="text-muted-foreground max-w-3xl text-sm">
        Every accept or reject from a manager can teach the model. This shows how much feedback has
        come in, what it can be used for, and how to retrain with it.
      </p>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Feedback so far">
        <Stat label="Feedback received" value={s.feedback_total} />
        <Stat label="Accepted" value={s.accepted} />
        <Stat label="Can train the model" value={s.training_examples} tone="good" />
        <Stat label="Kept aside to test it" value={s.holdout_examples} />
        <Stat label="From 👍/👎 on rankings" value={s.thumb_examples} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-surface rounded-xl border p-5" aria-label="Rejections by reason">
          <h2 className="text-sm font-semibold">Rejections by reason</h2>
          {reasons.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">No rejections yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {reasons.map(([reason, n]) => (
                <li
                  key={reason}
                  className="grid grid-cols-[10rem_1fr_2rem] items-center gap-3 text-sm"
                >
                  <span className="truncate">
                    {(REJECT_REASON_LABELS as Record<string, string | undefined>)[reason] ?? reason}
                  </span>
                  <span className="bg-muted h-2 rounded-full">
                    <span
                      className="bg-primary block h-2 rounded-full"
                      style={{ width: `${(n / maxReason) * 100}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          )}
          {Object.keys(s.skipped).length > 0 && (
            <div className="mt-5">
              <h2 className="text-sm font-semibold">Not used for training</h2>
              <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                {Object.entries(s.skipped).map(([why, n]) => (
                  <li key={why}>
                    {n} · {SKIPPED_LABELS[why] ?? why}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section
          className="bg-surface rounded-xl border p-5"
          aria-label="How feedback becomes training data"
        >
          <h2 className="text-sm font-semibold">How feedback becomes training data</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Each decision is saved with exactly what the model saw. A manager's answer counts three
            times as much as a teacher label, and only teaches what the manager actually said.
          </p>
          <dl className="mt-3 divide-y text-sm">
            {MAPPING.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-4">
                <dt className="font-medium">{k}</dt>
                <dd className="text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="bg-surface flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5">
        <div className="max-w-xl">
          <h2 className="text-sm font-semibold">Retrain with this feedback</h2>
          <p className="text-muted-foreground text-sm">
            Download the training file, attach it to the student training notebook on Kaggle, and
            run it. The new model reports how often it agrees with managers on the kept-aside
            examples.
            {s.last_feedback_at && ` Latest feedback: ${dateTime(s.last_feedback_at)}.`}
          </p>
          {error !== null && <ErrorState error={error} />}
        </div>
        <Button
          onClick={() => void download()}
          disabled={downloading || s.usable_examples === 0}
          className="rounded-lg"
        >
          {downloading ? <Loader2 className="animate-spin" /> : <Download />}
          Export training data ({s.usable_examples})
        </Button>
      </section>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'good' }) {
  return (
    <div className="bg-surface rounded-xl border px-4 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={
          tone === 'good'
            ? 'text-band-shortlist-foreground text-2xl font-semibold tabular-nums'
            : 'text-2xl font-semibold tabular-nums'
        }
      >
        {value}
      </p>
    </div>
  )
}

const AREA_LABELS: Record<string, string> = {
  match_results: 'Matching results',
  shortlist_decision: 'Accept / reject',
  task_intake: 'New task',
  resume_reading: 'Resume reading',
  candidate_fit: 'Candidates from HR',
  suggestion: 'HR suggestions',
  other: 'Anything else',
}

/** Where an accepted change is made; others need a change by the team in the code. */
const WHERE_TO_CHANGE: Record<string, { href: string; label: string } | undefined> = {
  threshold: { href: '/admin?tab=thresholds', label: 'Change the cut-offs' },
  training_data: { href: '/admin?tab=learning', label: 'Export training data' },
}

const KIND_LABELS: Record<string, string> = {
  matching_rule: 'Matching rule',
  threshold: 'Cut-off',
  training_data: 'Training data',
  resume_reading: 'Resume reading',
  screen_or_wording: 'Screen or wording',
  other: 'Other',
}

/** The weekly "what people are telling us" report: suggestions an admin accepts or dismisses. */
function FeedbackReports() {
  const reports = useFeedbackReports()
  const make = useMakeFeedbackReport()
  const [confirming, setConfirming] = useState(false)
  const latest = reports.data?.[0]
  return (
    <section aria-label="What people are telling us" className="bg-surface rounded-xl border">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="max-w-2xl">
          <h2 className="text-base font-semibold">What people are telling us</h2>
          <p className="text-muted-foreground text-sm">
            Every week the written feedback is read, with names and contact details removed first,
            and grouped into themes with a suggested change. Nothing changes until you accept it;
            accept/reject decisions keep training the model every night on their own.
          </p>
        </div>
        <Button variant="outline" onClick={() => setConfirming(true)} disabled={make.isPending}>
          {make.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Make this week&rsquo;s report now
        </Button>
      </div>
      {make.isError && (
        <div className="px-5 pt-4">
          <ErrorState error={make.error} />
        </div>
      )}
      {reports.isPending ? (
        <Skeleton className="m-5 h-32" />
      ) : reports.isError ? (
        <div className="p-5">
          <ErrorState error={reports.error} />
        </div>
      ) : !latest ? (
        <p className="text-muted-foreground px-5 py-6 text-sm">
          No report yet. The first one is written a week after people start leaving comments (at
          least 5), or now with the button above.
        </p>
      ) : (
        <Report report={latest} older={reports.data.length - 1} />
      )}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make the report now?</DialogTitle>
            <DialogDescription>
              This sends the written feedback since the last report, with names and contact details
              removed, to ChatGPT once. It usually costs less than one cent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirming(false)
                make.mutate()
              }}
            >
              Make the report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function Report({ report: r, older }: { report: FeedbackReport; older: number }) {
  const setStatus = useSetThemeStatus(r.id)
  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="font-medium">
          {dateTime(r.period_start)} – {dateTime(r.period_end)}
        </span>
        <span className="text-muted-foreground">
          {r.feedback_count} pieces of feedback · {r.thumbs_up} 👍 · {r.thumbs_down} 👎
        </span>
        {older > 0 && (
          <span className="text-muted-foreground text-xs">{older} older reports kept</span>
        )}
      </div>
      <p className="bg-muted/50 rounded-lg px-4 py-3 text-sm">{r.summary}</p>
      <ul className="grid gap-3 lg:grid-cols-2" aria-label="Suggested changes">
        {r.themes.map((t, i) => (
          <li
            key={t.title}
            aria-label={t.title}
            className={cn(
              'bg-background space-y-2 rounded-xl border p-4',
              t.status === 'dismissed' && 'opacity-60',
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{t.title}</span>
              <StatusBadge tone="neutral">{t.mentions} mentions</StatusBadge>
              <StatusBadge tone="info">{AREA_LABELS[t.area] ?? t.area}</StatusBadge>
            </div>
            <ul className="text-muted-foreground space-y-0.5 text-xs">
              {t.examples.map((e) => (
                <li key={e}>&ldquo;{e}&rdquo;</li>
              ))}
            </ul>
            <p className="text-sm">
              <span className="text-muted-foreground">
                Suggested change ({KIND_LABELS[t.kind] ?? t.kind}):{' '}
              </span>
              {t.suggestion}
            </p>
            <div className="flex items-center gap-2 pt-1">
              {t.status === 'open' ? (
                <>
                  <Button
                    size="sm"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ index: i, status: 'accepted' })}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ index: i, status: 'dismissed' })}
                  >
                    Dismiss
                  </Button>
                </>
              ) : (
                <>
                  <StatusBadge
                    tone={
                      t.status === 'done' ? 'ready' : t.status === 'accepted' ? 'info' : 'neutral'
                    }
                  >
                    {t.status === 'done'
                      ? 'Done'
                      : t.status === 'accepted'
                        ? 'Accepted: to do'
                        : 'Dismissed'}
                  </StatusBadge>
                  {t.status === 'accepted' && (
                    <>
                      {WHERE_TO_CHANGE[t.kind] && (
                        <a
                          className="text-primary text-xs underline"
                          href={WHERE_TO_CHANGE[t.kind]?.href}
                        >
                          {WHERE_TO_CHANGE[t.kind]?.label}
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ index: i, status: 'done' })}
                      >
                        Mark as done
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStatus.mutate({ index: i, status: 'open' })}
                  >
                    Undo
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">
        Written by {r.model} ({r.prompt_version}) · cost ${r.cost_usd.toFixed(4)}. Accepting records
        the decision; the team then makes the change and it is tested before it goes live.
      </p>
    </div>
  )
}
