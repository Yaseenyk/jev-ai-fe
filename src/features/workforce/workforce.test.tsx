import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { MatchRun, ShortlistItem, Task } from '@/api/types'
import demoJson from '@/mocks/data/demo.json'
import hrJson from '@/mocks/data/hr.json'
import { renderRoute, signInAs } from '@/test/render'

const hr = hrJson as unknown as {
  employees: { id: string; full_name: string }[]
  candidates: { id: string; matches: unknown[] }[]
}
const demo = demoJson as unknown as {
  tasks: Task[]
  runs: Record<string, { run: MatchRun; shortlist: ShortlistItem[] }>
}
const employee = hr.employees[0]
const candidate = hr.candidates.find((c) => c.matches.length > 0)
const firstRun = demo.tasks[0] && demo.runs[demo.tasks[0].id]
if (!employee || !candidate || !firstRun)
  throw new Error('mock data is missing an employee, candidate or run')

afterEach(() => signInAs('manager1@srtm.local'))

test('Key people shows a skill only one expert holds, with the closest backup', async () => {
  renderRoute('/planning?tab=keypeople')
  const box = await screen.findByRole('region', { name: /held by one or two experts/ })
  expect(within(box).getByText('One expert')).toBeInTheDocument()
  expect(within(box).getByText(/Closest backups/)).toBeInTheDocument()
  expect(screen.getByText('Nothing running depends on one person')).toBeInTheDocument()
})

test('Team builder proposes people per role and says what is still missing', async () => {
  const user = userEvent.setup()
  renderRoute('/planning?tab=team')
  const form = await screen.findByRole('region', { name: 'Team to build' })
  const people = within(form).getByLabelText('Team role 1 people')
  fireEvent.change(people, { target: { value: '3' } })
  const add = within(form).getByLabelText('Team role 1 add skill')
  await waitFor(() => expect(within(add).getAllByRole('option').length).toBeGreaterThan(1))
  await user.selectOptions(add, (within(add).getAllByRole('option')[1] as HTMLOptionElement).value)
  await user.click(within(form).getByRole('button', { name: 'Build team' }))
  const team = await screen.findByRole('region', { name: 'Proposed team' })
  expect(await within(team).findByText('2 people')).toBeInTheDocument()
  expect(within(team).getByText(/Worked with/)).toBeInTheDocument()
  expect(within(team).getByRole('status')).toHaveTextContent('Engineer: 1 still needed')
})

test('Capacity and fair opportunity show where people sit idle or stuck', async () => {
  const user = userEvent.setup()
  renderRoute('/planning?tab=capacity')
  const table = await screen.findByRole('table', { name: 'Capacity by practice and month' })
  expect(within(table).getByText('Data analytics')).toBeInTheDocument()
  expect(within(table).getByText('Open tasks need (FTE)')).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: 'Fair opportunity' }))
  expect(await screen.findByText(/64 days on the bench/)).toBeInTheDocument()
  expect(
    screen.getByRole('region', { name: /Recommended often, never accepted \(1\)/ }),
  ).toBeInTheDocument()
})

test('Find people turns plain words into filters that can be removed', async () => {
  const user = userEvent.setup()
  renderRoute('/people/search')
  await user.type(
    await screen.findByLabelText('Who are you looking for?'),
    'senior people in Hyderabad free now',
  )
  await user.click(screen.getByRole('button', { name: 'Search' }))
  const chips = await screen.findByLabelText('Search filters')
  expect(within(chips).getByText('L4')).toBeInTheDocument()
  expect(within(chips).getByText('Free now')).toBeInTheDocument()
  expect(await screen.findByRole('region', { name: 'People found' })).toBeInTheDocument()
  await user.click(within(chips).getByRole('button', { name: 'Remove filter Free now' }))
  expect(within(chips).queryByText('Free now')).not.toBeInTheDocument()
})

test('A client request becomes draft tasks that are created for a client', async () => {
  const user = userEvent.setup()
  renderRoute('/tasks/from-request')
  await user.type(
    await screen.findByLabelText("Client's request"),
    'We need two senior data engineers for six months starting next month.',
  )
  await user.click(screen.getByRole('button', { name: 'Read the request' }))
  const drafts = await screen.findByRole('region', { name: 'Draft tasks' })
  expect(within(drafts).getByText(/2 × Senior Data Engineer/)).toBeInTheDocument()
  expect(within(drafts).getByText(/not in the skills list: Mainframe/)).toBeInTheDocument()
  const client = within(drafts).getByLabelText('Client')
  await waitFor(() => expect(within(client).getAllByRole('option').length).toBeGreaterThan(1))
  await user.selectOptions(
    client,
    (within(client).getAllByRole('option')[1] as HTMLOptionElement).value,
  )
  await user.click(within(drafts).getByRole('button', { name: 'Create 2 tasks' }))
  expect(await within(drafts).findByRole('status')).toHaveTextContent('Created 2 tasks')
})

test('HR records preferences with consent, and a manager plans a course that finishes', async () => {
  await signInAs('hr@srtm.local')
  const user = userEvent.setup()
  renderRoute('/planning?tab=learning')
  const add = await screen.findByRole('form', { name: 'Add a course' })
  await user.type(within(add).getByLabelText('Course'), 'Spark in depth')
  await user.type(within(add).getByLabelText('Provider'), 'Academy')
  const skill = within(add).getByLabelText('Teaches')
  await waitFor(() => expect(within(skill).getAllByRole('option').length).toBeGreaterThan(1))
  await user.selectOptions(
    skill,
    (within(skill).getAllByRole('option')[1] as HTMLOptionElement).value,
  )
  await user.click(within(add).getByRole('button', { name: 'Add course' }))
  expect(await screen.findByText('Spark in depth')).toBeInTheDocument()

  renderRoute(`/employees/${employee.id}`)
  const prefs = await screen.findByRole('region', { name: 'Work they would like' })
  await user.click(within(prefs).getByRole('button', { name: 'Record preferences' }))
  await user.click(within(prefs).getByLabelText('Healthcare'))
  const save = within(prefs).getByRole('button', { name: 'Save preferences' })
  expect(save).toBeDisabled()
  await user.click(within(prefs).getByLabelText(/The person agreed/))
  await user.click(save)
  expect(await within(prefs).findByText('Areas: Healthcare')).toBeInTheDocument()

  const plan = screen.getByRole('region', { name: 'Learning plan' })
  const course = within(plan).getByLabelText('Course')
  await waitFor(() => expect(within(course).getAllByRole('option').length).toBeGreaterThan(1))
  await user.selectOptions(
    course,
    (within(course).getAllByRole('option')[1] as HTMLOptionElement).value,
  )
  await user.click(within(plan).getByRole('button', { name: 'Assign course' }))
  const status = await within(plan).findByLabelText('Status of Spark in depth')
  await user.selectOptions(status, 'done')
  await waitFor(() =>
    expect(within(plan).getByLabelText('Status of Spark in depth')).toHaveValue('done'),
  )
})

test('HR gets interview questions aimed at a candidate’s gaps', async () => {
  await signInAs('hr@srtm.local')
  const user = userEvent.setup()
  renderRoute(`/candidates/${candidate.id}`)
  const panel = await screen.findByRole('region', { name: 'Interview questions' })
  await user.click(within(panel).getByRole('button', { name: 'Suggest questions' }))
  expect(await within(panel).findByLabelText('Questions')).toHaveTextContent(
    /hardest thing you built/,
  )
  expect(within(panel).getByLabelText('Gaps to check')).toHaveTextContent(/needs 3\/5/)
})

test('A shortlist shows what a person said they would like', async () => {
  renderRoute(`/runs/${firstRun.run.id}`)
  expect(await screen.findByText('Wants this kind of work')).toBeInTheDocument()
})
