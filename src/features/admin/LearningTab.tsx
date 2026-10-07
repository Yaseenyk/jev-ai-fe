import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { downloadTrainingData, useLearning } from '@/features/admin/api'
import { REJECT_REASON_LABELS, dateTime } from '@/lib/format'

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
      <p className="text-muted-foreground max-w-3xl text-sm">
        Every accept or reject from a manager can teach the model. This shows how much feedback has
        come in, what it can be used for, and how to retrain with it.
      </p>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Feedback so far">
        <Stat label="Feedback received" value={s.feedback_total} />
        <Stat label="Accepted" value={s.accepted} />
        <Stat label="Can train the model" value={s.training_examples} tone="good" />
        <Stat label="Kept aside to test it" value={s.holdout_examples} />
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
