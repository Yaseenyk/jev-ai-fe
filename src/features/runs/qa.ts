/**
 * Answers questions about one match run from the run's own data (no AI call), so every answer is
 * traceable to the facts and model outputs shown on the page.
 */
import type { DecisionDefinition, ExcludedCandidate, MatchRun, ShortlistItem } from '@/api/types'
import { featureRows } from '@/features/shortlist/FactsList'
import { bandReason } from '@/features/shortlist/DecisionTrail'
import {
  BAND_LABELS,
  FILTER_REASON_FIXES,
  FILTER_REASON_LABELS,
  FLAG_LABELS,
  humanize,
  percent,
} from '@/lib/format'

export interface Answer {
  title: string
  lines: string[]
  table?: { head: string[]; rows: string[][] }
}

export interface QaContext {
  run: MatchRun
  items: ShortlistItem[]
  excluded: ExcludedCandidate[]
  excludedTotal: number
  definitions: DecisionDefinition[]
}

type Person = { kind: 'ranked'; item: ShortlistItem } | { kind: 'excluded'; ex: ExcludedCandidate }

const words = (s: string) => s.toLowerCase().match(/[a-z]+/g) ?? []

/** People named ("Priya", "Hegde") or referred to by rank ("#3", "rank 3") in the question. */
export function findPeople(question: string, ctx: QaContext): Person[] {
  const found: Person[] = []
  const add = (p: Person) => {
    const id = p.kind === 'ranked' ? p.item.employee.id : p.ex.employee.id
    if (!found.some((f) => (f.kind === 'ranked' ? f.item.employee.id : f.ex.employee.id) === id))
      found.push(p)
  }
  for (const m of question.matchAll(/(?:#|\b(?:rank|number|no\.?)\s*)(\d+)/gi)) {
    const item = ctx.items.find((i) => i.rank === Number(m[1]))
    if (item) add({ kind: 'ranked', item })
  }
  const asked = new Set(words(question))
  const named = (fullName: string) => words(fullName).some((w) => w.length >= 3 && asked.has(w))
  for (const item of ctx.items) if (named(item.employee.full_name)) add({ kind: 'ranked', item })
  for (const ex of ctx.excluded) if (named(ex.employee.full_name)) add({ kind: 'excluded', ex })
  return found
}

function chosen(item: ShortlistItem, key: string, ctx: QaContext): string {
  const result = item.decisions.find((d) => d.key === key)
  const def = ctx.definitions.find((d) => d.key === key)
  if (!result) return 'n/a'
  const option = def?.options.find((o) => o.value === result.chosen)
  return `${option?.description ?? humanize(result.chosen)} (${percent(result.probs[result.chosen] ?? 0)})`
}

function describe(item: ShortlistItem, ctx: QaContext): Answer {
  const e = item.employee
  const lines = [
    `${e.full_name} (${e.designation}) is #${item.rank} in ${BAND_LABELS[item.band]} with an overall fit of ${percent(item.rank_score)}.`,
    bandReason(item, ctx.run.thresholds),
  ]
  for (const s of item.explanation?.strengths ?? []) lines.push(`Strength: ${s.text}`)
  for (const g of item.explanation?.gaps ?? []) lines.push(`Gap: ${g.text}`)
  if (!item.explanation) {
    const facts = featureRows(item.features)
    lines.push(
      ...facts.slice(0, 3).map(([k, v]) => `${k}: ${v}`),
      `Skill match: ${chosen(item, 'skill_match', ctx)}`,
    )
  }
  if (item.flags.length)
    lines.push(`Warnings: ${item.flags.map((f) => FLAG_LABELS[f] ?? humanize(f)).join(', ')}.`)
  return { title: `Why ${e.full_name} is #${item.rank}`, lines }
}

function whyNot(person: Person, ctx: QaContext): Answer {
  if (person.kind === 'excluded') {
    const { employee, filter_reasons } = person.ex
    const reasons = filter_reasons.map((r) => FILTER_REASON_LABELS[r] ?? humanize(r))
    return {
      title: `Why ${employee.full_name} is not on the list`,
      lines: [
        `${employee.full_name} was removed by the rules before any scoring: ${reasons.join(', ')}.`,
        ...filter_reasons.map((r) => FILTER_REASON_FIXES[r]).filter((f): f is string => !!f),
      ],
    }
  }
  const item = person.item
  const top = ctx.items[0]
  if (!top || top.employee.id === item.employee.id) return describe(item, ctx)
  const lines = [
    `${item.employee.full_name} is #${item.rank} (${BAND_LABELS[item.band]}, ${percent(item.rank_score)}); #1 is ${top.employee.full_name} at ${percent(top.rank_score)}.`,
  ]
  const a = item.features
  const b = top.features
  if (a.must_have_coverage < b.must_have_coverage)
    lines.push(
      `Fewer must-have skills met: ${percent(a.must_have_coverage)} vs ${percent(b.must_have_coverage)}.`,
    )
  if (Math.abs(a.level_gap) > Math.abs(b.level_gap))
    lines.push(`Further from the required level (${a.level_gap > 0 ? 'above' : 'below'} it).`)
  if (a.domain_project_count < b.domain_project_count)
    lines.push(
      `Fewer projects in this domain: ${a.domain_project_count} vs ${b.domain_project_count}.`,
    )
  if (a.available_capacity_pct < b.available_capacity_pct)
    lines.push(
      `Less capacity at the start: ${a.available_capacity_pct}% vs ${b.available_capacity_pct}%.`,
    )
  if (item.flags.length)
    lines.push(`Has warnings: ${item.flags.map((f) => FLAG_LABELS[f] ?? humanize(f)).join(', ')}.`)
  if (lines.length === 1)
    lines.push('The facts are close; the model rated the overall fit slightly lower.')
  lines.push(bandReason(item, ctx.run.thresholds))
  return { title: `Why ${item.employee.full_name} is not higher`, lines }
}

function compare(a: ShortlistItem, b: ShortlistItem, ctx: QaContext): Answer {
  const fa = featureRows(a.features)
  const fb = featureRows(b.features)
  const rows: string[][] = [
    ['Rank', `#${a.rank}`, `#${b.rank}`],
    ['Band', BAND_LABELS[a.band], BAND_LABELS[b.band]],
    ['Overall fit', percent(a.rank_score), percent(b.rank_score)],
    ...fa.map(([k, v], i) => [k, v, fb[i]?.[1] ?? '']),
    ...ctx.definitions
      .filter((d) => d.key !== 'overall_fit')
      .map((d) => [d.label, chosen(a, d.key, ctx), chosen(b, d.key, ctx)]),
  ]
  const [better, worse] = a.rank < b.rank ? [a, b] : [b, a]
  return {
    title: `${a.employee.full_name} vs ${b.employee.full_name}`,
    lines: [
      `${better.employee.full_name} ranks higher (#${better.rank} vs #${worse.rank}). The table shows where they differ.`,
    ],
    table: { head: ['', a.employee.full_name, b.employee.full_name], rows },
  }
}

function excludedSummary(ctx: QaContext): Answer {
  const counts = Object.entries(ctx.run.filter_reason_counts).sort((x, y) => y[1] - x[1])
  if (!counts.length)
    return { title: 'Nobody was excluded', lines: ['Everyone passed the rules for this task.'] }
  return {
    title: `${ctx.excludedTotal} people were excluded by the rules`,
    lines: [
      'Rules run in code before any scoring; one person can fail several.',
      ...counts.map(([r, n]) => `${FILTER_REASON_LABELS[r] ?? humanize(r)}: ${n}`),
    ],
  }
}

function widen(ctx: QaContext): Answer {
  const counts = Object.entries(ctx.run.filter_reason_counts).sort((x, y) => y[1] - x[1])
  const lines = counts
    .slice(0, 2)
    .map(
      ([r, n]) =>
        `${FILTER_REASON_LABELS[r] ?? humanize(r)} removed ${n} people. ${FILTER_REASON_FIXES[r] ?? ''}`,
    )
  if (ctx.run.run_flags.includes('no_skill_match') || ctx.items.length < 3)
    lines.push('Lower the minimum proficiency, or move a skill from must-have to nice-to-have.')
  if (!lines.length) lines.push('The rules are not the limit here; most people were ranked.')
  return { title: 'How to widen the search', lines }
}

export const SUGGESTIONS = [
  'Why is #1 on top?',
  'Compare #1 and #2',
  'Who was excluded and why?',
  'How do I widen the search?',
]

export function answer(question: string, ctx: QaContext): Answer {
  const q = question.toLowerCase()
  const people = findPeople(question, ctx)
  const ranked = people.flatMap((p) => (p.kind === 'ranked' ? [p.item] : []))
  const [first, second] = ranked

  if (/compare|\bvs\b|versus|differ/.test(q) && first && second) return compare(first, second, ctx)
  if (/why not|isn't|wasn't|not (?:on|in|higher|ranked)|missing|lower/.test(q) && people[0])
    return whyNot(people[0], ctx)
  if (/widen|more people|relax|nobody|no one|loosen/.test(q)) return widen(ctx)
  if (/exclud|filter|removed|rules|others/.test(q)) return excludedSummary(ctx)
  if (people[0])
    return people[0].kind === 'ranked' ? describe(people[0].item, ctx) : whyNot(people[0], ctx)
  if (/top|first|best|#1|number one/.test(q) && ctx.items[0]) return describe(ctx.items[0], ctx)
  return {
    title: 'I can answer questions about this run',
    lines: [
      'Ask why someone is ranked where they are, why someone is not on the list, compare two people (by name or #rank), who was excluded, or how to widen the search.',
      ctx.items.length || ctx.excludedTotal
        ? 'Tip: use a first or last name, or a rank like #3.'
        : 'This run has nobody to talk about yet.',
    ],
  }
}
