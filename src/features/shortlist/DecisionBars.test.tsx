import { render, screen, within } from '@testing-library/react'

import type { DecisionDefinition, DecisionResult } from '@/api/types'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DecisionBars, headline, optionLabel } from '@/features/shortlist/DecisionBars'

const levelFit: DecisionDefinition = {
  key: 'level_fit',
  version: 1,
  label: 'Level fit',
  type: 'choice',
  question: 'Is the level right?',
  options: [
    { value: 'under', description: 'Below' },
    { value: 'right', description: 'Matches' },
    { value: 'over', description: 'Above' },
  ],
}

const skill: DecisionDefinition = {
  key: 'skill_match',
  version: 1,
  label: 'Skill match',
  type: 'score',
  question: 'How well?',
  options: [
    'No relevant skills',
    'Weak match: few',
    'Partial match: some',
    'Good match: most',
    'Excellent match: all',
  ].map((description, i) => ({ value: String(i), description })),
}

const result = (r: Partial<DecisionResult>): DecisionResult => ({
  key: 'level_fit',
  version: 1,
  type: 'choice',
  chosen: 'right',
  probs: { under: 0.06, right: 0.86, over: 0.08 },
  flags: [],
  ...r,
})

test('shows a bar and a percentage for every option, not just the winner', () => {
  render(
    <TooltipProvider>
      <DecisionBars def={levelFit} result={result({})} />
    </TooltipProvider>,
  )
  const list = screen.getByRole('list', { name: 'Level fit probabilities' })
  const rows = within(list).getAllByRole('listitem')
  expect(rows).toHaveLength(3)
  expect(rows.map((r) => r.textContent)).toEqual(['Under6%', 'Right86%', 'Over8%'])
})

test('flags on a decision are announced', () => {
  render(
    <TooltipProvider>
      <DecisionBars def={levelFit} result={result({ flags: ['inconsistent'] })} />
    </TooltipProvider>,
  )
  expect(screen.getByLabelText('Warnings for this decision')).toBeInTheDocument()
})

test('score decisions use short labels and an expected-value headline', () => {
  expect(optionLabel(skill, '3')).toBe('Good match')
  expect(optionLabel(skill, '0')).toBe('No relevant skills')
  const r = result({
    key: 'skill_match',
    type: 'score',
    chosen: '4',
    probs: { '0': 0, '1': 0, '2': 0, '3': 0.5, '4': 0.5 },
  })
  expect(headline(skill, r)).toBeCloseTo(0.875)
})

test('a probability is never shown as certain', async () => {
  const { chance } = await import('@/lib/format')
  expect(chance(0.9999)).toBe('>99%')
  expect(chance(0.001)).toBe('<1%')
  expect(chance(0.734)).toBe('73%')
})
