import { screen, waitFor, within } from '@testing-library/react'
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

test('Planning opens on plain questions; a tool explains itself and goes back', async () => {
  const user = userEvent.setup()
  renderRoute('/tasks')
  await user.click((await screen.findAllByRole('link', { name: 'Planning' }))[0] as HTMLElement)
  expect(await screen.findByRole('heading', { name: 'Planning' })).toBeInTheDocument()
  for (const group of ['People without work', 'Skills', 'Staff a project', 'Look ahead']) {
    expect(screen.getByRole('heading', { name: group })).toBeInTheDocument()
  }
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  const card = screen.getByRole('link', { name: /Who is free now or soon\?/ })
  expect(await within(card).findByText('12 free now')).toBeInTheDocument()
  await user.click(card)

  expect(
    await screen.findByRole('heading', { name: 'Who is free now or soon?' }),
  ).toBeInTheDocument()
  const help = screen.getByRole('region', { name: 'How to use' })
  expect(within(help).getAllByRole('listitem')).toHaveLength(3)
  await user.click(screen.getByRole('link', { name: 'All planning tools' }))
  expect(await screen.findByRole('heading', { name: 'Planning' })).toBeInTheDocument()
})

test('a manager searches, filters and sorts who is free', async () => {
  const user = userEvent.setup()
  renderRoute('/planning?tab=bench')
  expect(await screen.findByText('Idle cost per week')).toBeInTheDocument()
  const table = await screen.findByRole('table', { name: 'Bench' })
  const names = () =>
    within(screen.getByRole('table', { name: 'Bench' }))
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.querySelector('td p')?.textContent ?? '')
  expect(names().length).toBeGreaterThan(1)

  await user.click(within(table).getByRole('button', { name: 'Person' }))
  await waitFor(() => expect(names()).toEqual([...names()].sort((a, b) => a.localeCompare(b))))
  expect(within(table).getByRole('columnheader', { name: 'Person' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
  await user.click(within(table).getByRole('button', { name: 'Person' }))
  await waitFor(() =>
    expect(within(table).getByRole('columnheader', { name: 'Person' })).toHaveAttribute(
      'aria-sort',
      'descending',
    ),
  )

  const someone = names()[0] ?? ''
  await user.type(screen.getByRole('textbox', { name: 'Search people' }), someone)
  await waitFor(() => expect(names()).toEqual([someone]))
  expect(screen.getByRole('button', { name: `Remove filter "${someone}"` })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Clear filters' }))
  await waitFor(() => expect(names().length).toBeGreaterThan(1))

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

const member = (id: string, name: string, score: number) => ({
  employee_id: id,
  employee_code: `SPY-${id}`,
  full_name: name,
  designation: 'Engineer',
  level: 'L4',
  cost_band: 'C',
  business_unit: null,
  score,
  band: 'shortlist',
  margin: { weekly_cost_usd: 1000, weekly_bill_usd: 1600, margin_pct: 37.5, below_target: false },
})

test("a client's open tasks get a whole team, one person per role", async () => {
  const sent: string[][] = []
  server.use(
    http.post('*/api/v1/planning/staffing', async ({ request }) => {
      const { task_ids } = (await request.json()) as { task_ids: string[] }
      sent.push(task_ids)
      return HttpResponse.json({
        tasks: [
          {
            task_id: first.id,
            task_code: first.code,
            title: first.title,
            proposed: member('a', 'Asha Rao', 0.97),
            alternates: [member('b', 'Ben Kurian', 0.95), member('c', 'Chitra Nair', 0.9)],
            unfilled_reason: null,
          },
          {
            task_id: second.id,
            task_code: second.code,
            title: second.title,
            proposed: member('b', 'Ben Kurian', 0.93),
            alternates: [],
            unfilled_reason: null,
          },
          {
            task_id: 'swift',
            task_code: 'TSK-0099',
            title: 'Swift iOS Developer',
            proposed: null,
            alternates: [],
            unfilled_reason: 'Nobody was recommended in the latest matching run.',
          },
        ],
        filled: 2,
        total_weekly_margin_usd: 1200,
      })
    }),
  )
  const user = userEvent.setup()
  renderRoute('/planning?tab=staffing')
  await user.click(await screen.findByRole('button', { name: /Propose a team for CL-/ }))
  const team = await screen.findByRole('region', { name: 'Proposed team' })
  expect(
    await within(team).findByRole('heading', { name: /Team for CL-.*: 2 of 3 roles filled/ }),
  ).toBeInTheDocument()
  expect(sent[0]?.length).toBeGreaterThan(0)
  expect(within(team).getByText(/Gross margin \$1,200 a week/)).toBeInTheDocument()

  const role = within(team).getByRole('listitem', { name: `Role ${first.code}` })
  expect(within(role).getByText('Asha Rao')).toBeInTheDocument()
  // Swapping: someone already in the team cannot be picked twice.
  await user.click(within(role).getByRole('combobox', { name: `Swap person for ${first.code}` }))
  expect(await screen.findByRole('option', { name: /Ben Kurian.*\(in team\)/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await user.click(screen.getByRole('option', { name: /Chitra Nair/ }))
  expect(await within(role).findByText('Chitra Nair')).toBeInTheDocument()
  expect(within(role).getByRole('link', { name: 'Open task to accept' })).toHaveAttribute(
    'href',
    `/tasks/${first.id}`,
  )

  const empty = within(team).getByRole('listitem', { name: 'Role TSK-0099' })
  expect(within(empty).getByText('Nobody proposed')).toBeInTheDocument()
  expect(within(empty).getByRole('link', { name: 'Open task to ask HR' })).toBeInTheDocument()
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
  await user.click(await screen.findByRole('button', { name: /Propose a team for CL-/ }))
  expect(await screen.findByText('Run matching for this task first.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Run matching for it' }))
  expect(await screen.findByText(/Matching started for 1 of 1 tasks/)).toBeInTheDocument()
})

test('a manager opens a person from the bench and sees their value to the company', async () => {
  const user = userEvent.setup()
  renderRoute('/planning?tab=bench')
  const table = await screen.findByRole('table', { name: 'Bench' })
  const row = within(table).getAllByRole('row')[1] as HTMLElement
  const name = row.querySelector('td p')?.textContent ?? ''
  await user.click(within(row).getByText(name))
  expect(await screen.findByRole('heading', { name })).toBeInTheDocument()
  expect(screen.getByText('Revenue billed (estimate)')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Revenue by client' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Best next tasks' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Project history' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: /^Skills/ })).toBeInTheDocument()
  expect(screen.getByText(/Salaries are never stored/)).toBeInTheDocument()
  // Managers cannot open HR's employee page, so no link to it.
  expect(screen.queryByRole('link', { name: 'Full profile' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'Who is free' }))
  expect(await screen.findByRole('table', { name: 'Bench' })).toBeInTheDocument()
})
