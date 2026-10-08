import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'

import demo from '@/mocks/data/demo.json'
import { server } from '@/test/setup'
import { renderRoute, signInAs } from '@/test/render'

const data = demo as unknown as {
  tasks: { id: string; code: string; title: string }[]
  runs: Record<string, unknown>
}
const withRuns = data.tasks.filter((t) => t.id in data.runs)
const first = withRuns[0]
const second = withRuns[1]
if (!first || !second) throw new Error('demo.json needs two tasks with recorded runs')

const asAdmin = () =>
  server.use(
    http.get('*/api/v1/auth/me', () =>
      HttpResponse.json({
        id: 'a1',
        email: 'admin@srtm.local',
        display_name: 'Pilot Admin',
        role: 'admin',
      }),
    ),
  )

test('a manager sees who is free, what it costs and what they could take next', async () => {
  const user = userEvent.setup()
  renderRoute('/tasks')
  await user.click((await screen.findAllByRole('link', { name: 'Planning' }))[0] as HTMLElement)
  expect(await screen.findByRole('heading', { name: 'Planning' })).toBeInTheDocument()
  expect(await screen.findByText('Idle cost per week')).toBeInTheDocument()
  const table = await screen.findByRole('table', { name: 'Bench' })
  expect(within(table).getAllByRole('row').length).toBeGreaterThan(1)
  await user.click(screen.getByRole('button', { name: '30 days' }))
  expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true')
})

test('skill gaps show every needed skill when nothing is short', async () => {
  const user = userEvent.setup()
  renderRoute('/planning?tab=skills')
  const all = await screen.findByRole('button', { name: /All skills/ })
  await user.click(all)
  const table = await screen.findByRole('table', { name: 'Skill gaps' })
  expect(within(table).getAllByRole('row').length).toBeGreaterThan(1)
})

test('project staffing proposes one person per task and explains the rest', async () => {
  const user = userEvent.setup()
  renderRoute('/planning?tab=staffing')
  const list = await screen.findByRole('region', { name: 'Tasks to staff' })
  await user.click(within(list).getByRole('checkbox', { name: new RegExp(first.code) }))
  await user.click(within(list).getByRole('checkbox', { name: new RegExp(second.code) }))
  await user.click(screen.getByRole('button', { name: /Propose a team \(2\)/ }))
  const team = await screen.findByRole('region', { name: 'Proposed team' })
  expect(await within(team).findByText('Tasks filled')).toBeInTheDocument()
  expect(within(team).getAllByText(/margin/).length).toBeGreaterThan(0)
  expect(within(team).getByText(/A proposal only/)).toBeInTheDocument()
})

test('a task with a finished run suggests moving someone inside', async () => {
  renderRoute(`/tasks/${first.id}`)
  const card = await screen.findByRole('region', { name: 'Hire or move internally' })
  expect(await within(card).findByText('Move someone inside')).toBeInTheDocument()
  expect(within(card).getByText(/no outside candidate is needed/)).toBeInTheDocument()
})

test('viewers do not get the Planning screen', async () => {
  await signInAs('viewer@srtm.local')
  const { router } = renderRoute('/planning')
  await screen.findByRole('heading', { name: /^Tasks$/ })
  expect(router.state.location.pathname).toBe('/tasks')
  expect(screen.queryByRole('link', { name: 'Planning' })).not.toBeInTheDocument()
  await signInAs('manager1@srtm.local')
})

test('an admin replaces the example rates and margins follow', async () => {
  asAdmin()
  const user = userEvent.setup()
  renderRoute('/admin?tab=rate-card')
  expect(await screen.findByText('Example rates: enter your own')).toBeInTheDocument()
  const bill = screen.getByLabelText('Bill rate per week, band A')
  await user.clear(bill)
  await user.type(bill, '700')
  const table = screen.getByRole('table', { name: 'Rate card' })
  expect(within(table).getByText('14.3%')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save rate card' }))
  expect(await screen.findByRole('button', { name: 'Save rate card' })).toBeDisabled()
  expect(screen.queryByText('Example rates: enter your own')).not.toBeInTheDocument()
})

test('the audit tab explains what the decisions export holds', async () => {
  asAdmin()
  renderRoute('/admin?tab=audit')
  expect(await screen.findByRole('button', { name: /Download decisions/ })).toBeInTheDocument()
  expect(screen.getByText(/protected attributes are not stored/)).toBeInTheDocument()
})

test('tasks without a finished run can be matched from the plan in one click', async () => {
  server.use(
    http.post('*/api/v1/planning/staffing', () =>
      HttpResponse.json({
        tasks: [
          {
            task_id: first.id,
            task_code: first.code,
            title: first.title,
            proposed: null,
            alternates: [],
            unfilled_reason: 'Run matching for this task first.',
          },
        ],
        filled: 0,
        total_weekly_margin_usd: 0,
      }),
    ),
    http.post('*/api/v1/tasks/:taskId/match-runs', () =>
      HttpResponse.json({ run_id: 'r-new', status: 'queued' }, { status: 202 }),
    ),
  )
  const user = userEvent.setup()
  renderRoute('/planning?tab=staffing')
  const list = await screen.findByRole('region', { name: 'Tasks to staff' })
  await user.click(within(list).getByRole('checkbox', { name: new RegExp(first.code) }))
  await user.click(screen.getByRole('button', { name: /Propose a team \(1\)/ }))
  expect(await screen.findByText('Run matching for this task first.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Run matching for it' }))
  expect(await screen.findByText(/Matching started for 1 of 1 tasks/)).toBeInTheDocument()
})

test('a manager opens a person from the bench and sees their value to the company', async () => {
  const user = userEvent.setup()
  renderRoute('/planning')
  const table = await screen.findByRole('table', { name: 'Bench' })
  const person = within(table).getAllByRole('link')[0] as HTMLElement
  const name = person.textContent
  await user.click(person)
  expect(await screen.findByRole('heading', { name })).toBeInTheDocument()
  expect(screen.getByText('Revenue billed (estimate)')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Revenue by client' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Best next tasks' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Project history' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: /^Skills/ })).toBeInTheDocument()
  expect(screen.getByText(/Salaries are never stored/)).toBeInTheDocument()
  // Managers cannot open HR's employee page, so no link to it.
  expect(screen.queryByRole('link', { name: 'Full profile' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'Bench' }))
  expect(await screen.findByRole('table', { name: 'Bench' })).toBeInTheDocument()
})
