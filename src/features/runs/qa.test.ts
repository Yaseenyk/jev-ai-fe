import type { DecisionDefinition, ExcludedCandidate, MatchRun, ShortlistItem } from '@/api/types'
import { type QaContext, answer, findPeople } from '@/features/runs/qa'
import demo from '@/mocks/data/demo.json'

const data = demo as unknown as {
  decisions: DecisionDefinition[]
  runs: Record<string, { run: MatchRun; shortlist: ShortlistItem[]; excluded: ExcludedCandidate[] }>
}
const recorded = Object.values(data.runs).find((r) => r.shortlist.length >= 3 && r.excluded.length)
if (!recorded) throw new Error('demo data needs a run with 3+ ranked and some excluded people')

const ctx: QaContext = {
  run: { ...recorded.run, thresholds: { shortlist_min: 0.8, review_min: 0.5 } },
  items: [...recorded.shortlist].sort((a, b) => a.rank - b.rank),
  excluded: recorded.excluded,
  excludedTotal: recorded.excluded.length,
  definitions: data.decisions,
}
const [first, second, third] = ctx.items as [ShortlistItem, ShortlistItem, ShortlistItem]
const lastName = (name: string) => name.split(' ').at(-1) ?? name

test('people are found by rank or by name', () => {
  const byRank = findPeople('compare #1 and #3', ctx)
  expect(byRank.map((p) => (p.kind === 'ranked' ? p.item.rank : null))).toEqual([1, 3])
  const byName = findPeople(`why not ${lastName(second.employee.full_name)}?`, ctx)
  expect(byName[0]).toMatchObject({ kind: 'ranked' })
})

test('why is #1 on top explains the first person with the band reason', () => {
  const a = answer('Why is #1 on top?', ctx)
  expect(a.title).toBe(`Why ${first.employee.full_name} is #1`)
  expect(a.lines.join(' ')).toMatch(/overall fit/i)
})

test('comparing two people returns a side-by-side table', () => {
  const a = answer('Compare #1 and #3', ctx)
  expect(a.table?.head).toEqual(['', first.employee.full_name, third.employee.full_name])
  expect(a.table?.rows[0]).toEqual(['Rank', '#1', '#3'])
})

test('why not someone who was excluded lists the rules they failed', () => {
  const ex = recorded.excluded[0] as ExcludedCandidate
  const a = answer(`why not ${ex.employee.full_name}`, ctx)
  expect(a.lines[0]).toMatch(/removed by the rules before any scoring/)
})

test('excluded and widen questions use the reason counts', () => {
  expect(answer('who was excluded and why?', ctx).title).toMatch(/excluded by the rules/)
  expect(answer('how do I widen the search', ctx).title).toBe('How to widen the search')
})

test('unknown questions get help instead of a guess', () => {
  expect(answer('what is the weather', ctx).title).toBe('I can answer questions about this run')
})
