import type { CandidateFeatures } from '@/api/types'
import { percent } from '@/lib/format'

export function featureRows(f: CandidateFeatures): [string, string][] {
  const levelGap =
    f.level_gap === 0
      ? 'Right level'
      : f.level_gap > 0
        ? `${f.level_gap} above`
        : `${-f.level_gap} below`
  return [
    ['Must-have skills met', percent(f.must_have_coverage)],
    ['Nice-to-have met', percent(f.nice_to_have_coverage)],
    ['Level', levelGap],
    ['Experience vs minimum', `${f.years_gap >= 0 ? '+' : ''}${f.years_gap} yrs`],
    ['Projects in this domain', String(f.domain_project_count)],
    [
      'Required skill last used',
      f.most_recent_relevant_skill_months === null
        ? 'Never'
        : `${f.most_recent_relevant_skill_months} months ago`,
    ],
    ['Capacity at start', `${f.available_capacity_pct}%`],
  ]
}

/** Facts computed by code (not AI), shown next to the AI decisions. */
export function FactsList({ features }: { features: CandidateFeatures }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
      {featureRows(features).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right font-medium tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
