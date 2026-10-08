import { AlertTriangle } from 'lucide-react'

import type { OutcomeProof } from '@/api/types'
import { Segmented } from '@/components/FilterBar'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { useUrlState } from '@/components/useUrlState'
import { Skeleton } from '@/components/ui/skeleton'
import { useFairness, useJudgement, useOutcomeProof } from '@/features/planning/insightsApi'
import { FILTER_REASON_LABELS, humanize, percent, REJECT_REASON_LABELS } from '@/lib/format'
import type { RejectReason } from '@/api/types'

const REJECT_LABELS: Partial<Record<string, string>> = REJECT_REASON_LABELS satisfies Record<
  RejectReason,
  string
>

const ATTRIBUTE_LABELS: Record<string, string> = {
  location: 'By location',
  practice: 'By practice',
  level: 'By level',
}

/** Is it fair, and what has it learned? (ADR 025) */
export function FairnessTab() {
  return (
    <div className="space-y-8">
      <Judgement />
      <Fairness />
    </div>
  )
}

function Judgement() {
  const j = useJudgement()
  if (j.isPending) return <Skeleton className="h-48 w-full rounded-xl" />
  if (j.isError) return <ErrorState error={j.error} />
  const reasons = Object.entries(j.data.reject_reasons)
  return (
    <section aria-label="What your managers value" className="bg-surface rounded-xl border p-5">
      <h2 className="text-sm font-semibold">What your managers value</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        What the final score has learned from managers&apos; accept and reject decisions
        {j.data.company_own ? ' in this company' : ''}. Longer bars matter more.
      </p>
      {j.data.factors.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">No trained final score yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {j.data.factors.map((f) => (
            <li
              key={f.feature}
              className="grid grid-cols-[minmax(0,16rem)_1fr_5rem] items-center gap-3 text-sm"
            >
              <span>{f.label}</span>
              <span className="bg-muted h-2 overflow-hidden rounded-full">
                <span
                  className={`block h-2 rounded-full ${f.direction === 'raises' ? 'bg-primary' : 'bg-destructive/70'}`}
                  style={{ width: percent(f.share) }}
                />
              </span>
              <span className="text-muted-foreground text-xs">
                {f.direction === 'raises' ? 'raises the score' : 'lowers the score'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {reasons.length > 0 && (
        <p className="text-muted-foreground mt-4 text-xs">
          Reasons managers gave for rejecting:{' '}
          {reasons.map(([r, n]) => `${REJECT_LABELS[r] ?? humanize(r)} ${n}`).join(' · ')}
        </p>
      )}
    </section>
  )
}

function Fairness() {
  const [f, set] = useUrlState({ days: '90' })
  const report = useFairness(Number(f.days))
  if (report.isPending) return <Skeleton className="h-64 w-full rounded-xl" />
  if (report.isError) return <ErrorState error={report.error} />
  const r = report.data
  return (
    <section aria-label="Fairness check" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Fairness check</h2>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Among people who passed the rules, how often each group was recommended. A group below
            {` ${percent(r.threshold)}`} of the best group&apos;s rate is flagged for a look (the
            four-fifths rule). Gender, age, religion and other protected attributes are never
            stored, so they cannot be scored or reported. {r.runs} matching runs in the period.
          </p>
        </div>
        <Segmented
          label="Period"
          value={f.days}
          onChange={(days) => set({ days })}
          options={[
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
            { value: '365', label: '1 year' },
          ]}
        />
      </div>
      {r.runs === 0 ? (
        <EmptyState title="No matching runs in this period" />
      ) : (
        r.attributes.map((a) => (
          <div key={a.attribute} className="bg-surface overflow-x-auto rounded-xl border">
            <table className="w-full text-sm" aria-label={ATTRIBUTE_LABELS[a.attribute]}>
              <caption className="px-4 pt-3 text-left text-sm font-medium">
                {ATTRIBUTE_LABELS[a.attribute]}
              </caption>
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="px-4 py-2 font-medium">Group</th>
                  <th className="px-4 py-2 text-right font-medium">Passed the rules</th>
                  <th className="px-4 py-2 text-right font-medium">Recommended</th>
                  <th className="px-4 py-2 text-right font-medium">Rate</th>
                  <th className="px-4 py-2 font-medium">Vs best</th>
                  <th className="px-4 py-2 font-medium">Main rule reasons when excluded</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {a.groups.map((g) => (
                  <tr key={g.value}>
                    <td className="px-4 py-2 font-medium">{humanize(g.value)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{g.passed_rules}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{g.recommended}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {g.recommend_rate === null ? '—' : percent(g.recommend_rate)}
                    </td>
                    <td className="px-4 py-2">
                      {g.ratio_to_best === null ? (
                        <span className="text-muted-foreground text-xs">too few to judge</span>
                      ) : g.flagged ? (
                        <StatusBadge tone="attention">
                          <AlertTriangle className="size-3" aria-hidden />{' '}
                          {percent(g.ratio_to_best)}
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="ready">{percent(g.ratio_to_best)}</StatusBadge>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-2 text-xs">
                      {Object.entries(g.top_rule_reasons)
                        .map(([k, n]) => `${FILTER_REASON_LABELS[k] ?? humanize(k)} ${n}`)
                        .join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </section>
  )
}

/** On the Health tab: did the people the model ranked highly work out? */
export function OutcomeProofSection() {
  const proof = useOutcomeProof()
  if (proof.isPending) return <Skeleton className="h-32 w-full rounded-xl" />
  if (proof.isError) return <ErrorState error={proof.error} />
  return <ProofView p={proof.data} />
}

function ProofView({ p }: { p: OutcomeProof }) {
  const rate = (r: number | null) => (r === null ? '—' : percent(r))
  return (
    <section aria-label="Proof from outcomes" className="bg-surface rounded-xl border p-4">
      <h2 className="text-sm font-semibold">Proof from outcomes</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Six weeks after a start, managers say whether the placement is working. {p.answered}{' '}
        answered, {p.waiting} waiting. Rates appear from {p.min_answers} answers per group.
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        {[p.overall, ...p.by_rank].map((g) => (
          <div key={g.label} className="rounded-lg border p-3">
            <dt className="text-muted-foreground text-xs">{g.label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{rate(g.rate)}</dd>
            <dd className="text-muted-foreground text-xs">
              {g.working_well} of {g.answered} working well
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
