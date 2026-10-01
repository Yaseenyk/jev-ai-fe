import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { MatchRun, ShortlistItem, Task } from '@/api/types'
import demoJson from '@/mocks/data/demo.json'
import { renderRoute } from '@/test/render'

const demo = demoJson as unknown as {
  tasks: Task[]
  runs: Record<string, { run: MatchRun; shortlist: ShortlistItem[] }>
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`demo data is missing ${what}`)
  return value
}

const firstTask = must(demo.tasks[0], 'a task')
const firstRun = must(demo.runs[firstTask.id], 'a run for the first task')
const top = must(firstRun.shortlist[0], 'a shortlisted person')
const noEligibleRun = must(
  Object.values(demo.runs).find((r) => r.run.run_flags.includes('no_eligible_candidates')),
  'a run with no eligible candidates',
)

test('task list links to a task with its requirements and runs', async () => {
  const user = userEvent.setup()
  renderRoute('/tasks')
  await user.click(await screen.findByText(firstTask.title))
  expect(await screen.findByRole('heading', { name: firstTask.title })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /run matching/i })).toBeEnabled()
  expect(await screen.findByText(/people ranked out of/)).toBeInTheDocument()
})

test('a completed run shows bands, facts, decisions and feedback actions', async () => {
  const user = userEvent.setup()
  renderRoute(`/runs/${firstRun.run.id}`)

  const card = (await screen.findByText(top.employee.full_name)).closest(
    '[data-slot="card"]',
  ) as HTMLElement
  expect(within(card).getByText('Facts from the data')).toBeInTheDocument()
  expect(within(card).getByRole('list', { name: 'Overall fit probabilities' })).toBeInTheDocument()

  await user.click(within(card).getByRole('button', { name: /accept as candidate/i }))
  expect(await within(card).findByText('Accepted as candidate')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /assign/i })).not.toBeInTheDocument()
})

test('rejecting requires a reason', async () => {
  const user = userEvent.setup()
  renderRoute(`/runs/${firstRun.run.id}`)
  const card = (await screen.findByText(top.employee.full_name)).closest(
    '[data-slot="card"]',
  ) as HTMLElement

  await user.click(within(card).getByRole('button', { name: /^reject$/i }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: /^reject$/i }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Choose a reason')

  await user.click(within(dialog).getByRole('combobox', { name: /reason/i }))
  await user.click(await screen.findByRole('option', { name: 'Skill gap' }))
  await user.click(within(dialog).getByRole('button', { name: /^reject$/i }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await within(card).findByText(/Rejected · Skill gap/)).toBeInTheDocument()
})

test('a run where nobody passes the rules explains why instead of relaxing them', async () => {
  renderRoute(`/runs/${noEligibleRun.run.id}`)
  expect(await screen.findByText('Nobody passed the rules for this task')).toBeInTheDocument()
  expect(screen.getByText(/never relaxed automatically/)).toBeInTheDocument()
})
