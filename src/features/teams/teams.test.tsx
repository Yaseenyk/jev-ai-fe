import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'

import type { Task, TeamCandidate } from '@/api/types'
import demo from '@/mocks/data/demo.json'
import { server } from '@/test/setup'
import { renderRoute } from '@/test/render'

const task = (demo as unknown as { tasks: Task[] }).tasks[0] as Task

const person = (id: string, name: string, level: string, suggested = false): TeamCandidate => ({
  employee_id: id,
  employee_code: `SPY-${id}`,
  full_name: name,
  designation: 'Engineer',
  level: level as TeamCandidate['level'],
  cost_band: 'C',
  business_unit: null,
  practice: 'data_engineering',
  coverage: 1,
  score: 0.9,
  free_from: '2026-10-21',
  reasons: [`Reason for ${name}`],
  suggested,
})

function builderApi(runId: string | null = 'run-1') {
  const saved: unknown[] = []
  server.use(
    http.get('*/api/v1/tasks/:taskId/team/leads', () =>
      HttpResponse.json({
        task: {
          task_id: task.id,
          code: task.code,
          title: task.title,
          client_code: task.client_code,
          required_level: 'L4',
          start_date: task.start_date,
          duration_weeks: 12,
          headcount: 3,
          allocation_pct_required: 100,
        },
        run_id: runId,
        leads: [person('a', 'Asha Lead', 'L5', true), person('z', 'Zoya Lead', 'L5')],
      }),
    ),
    http.get('*/api/v1/tasks/:taskId/team/members', () =>
      HttpResponse.json({
        needed: 2,
        members: [person('b', 'Ben Member', 'L4'), person('c', 'Chitra Member', 'L4')],
        alternates: [person('d', 'Dev Member', 'L3')],
      }),
    ),
    http.get('*/api/v1/tasks/:taskId/team/shadows', () =>
      HttpResponse.json([person('e', 'Esha Learner', 'L2')]),
    ),
    http.post('*/api/v1/teams', async ({ request }) => {
      saved.push(await request.json())
      return HttpResponse.json(
        {
          id: 'team-1',
          task: {
            task_id: task.id,
            code: task.code,
            title: task.title,
            client_code: task.client_code,
            required_level: 'L4',
            start_date: task.start_date,
            duration_weeks: 12,
            headcount: 3,
            allocation_pct_required: 100,
          },
          lead: { ...person('a', 'Asha Lead', 'L5'), role: 'lead', allocation_pct: 100 },
          members: [
            { ...person('b', 'Ben Member', 'L4'), role: 'member', allocation_pct: 100 },
            { ...person('d', 'Dev Member', 'L3'), role: 'member', allocation_pct: 100 },
          ],
          shadow: { ...person('e', 'Esha Learner', 'L2'), role: 'shadow', allocation_pct: 25 },
          created_at: '2026-10-21T10:00:00Z',
          created_by: 'Resource Manager 1',
        },
        { status: 201 },
      )
    }),
  )
  return saved
}

test('a manager builds a team: lead, members under the lead, a shadow, then sees the team', async () => {
  const saved = builderApi()
  const user = userEvent.setup()
  const { router } = renderRoute(`/teams/new?task=${task.id}`)

  const leads = await screen.findByRole('list', { name: 'Team Lead options' })
  const asha = within(leads).getByRole('listitem', { name: 'Asha Lead' })
  expect(within(asha).getByText('Suggested')).toBeInTheDocument()
  expect(within(asha).getByText('Reason for Asha Lead')).toBeInTheDocument()
  await user.click(within(asha).getByRole('button', { name: 'Choose as lead' }))

  // The best members are chosen already; swap one for an alternate.
  expect(await screen.findByRole('status')).toHaveTextContent('2 of 2 chosen')
  const members = screen.getByRole('list', { name: 'Member options' })
  const add = (name: string) =>
    within(within(members).getByRole('listitem', { name })).getByRole('button')
  expect(add('Dev Member')).toHaveTextContent('Add to team')
  await user.click(add('Chitra Member'))
  expect(screen.getByRole('status')).toHaveTextContent('1 of 2 chosen')
  await user.click(add('Dev Member'))
  expect(screen.getByRole('status')).toHaveTextContent('2 of 2 chosen')

  const shadows = await screen.findByRole('list', { name: 'Shadow options' })
  await user.click(within(shadows).getByRole('button', { name: 'Choose as shadow' }))
  const summary = await screen.findByRole('list', { name: 'Team summary' })
  expect(summary).toHaveTextContent('Lead: Asha Lead')
  expect(summary).toHaveTextContent('Members: Ben Member, Dev Member')
  expect(summary).toHaveTextContent('Shadow: Esha Learner')
  await user.click(screen.getByRole('button', { name: 'Create team' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/teams/team-1'))
  expect(saved[0]).toEqual({
    task_id: task.id,
    lead_id: 'a',
    member_ids: ['b', 'd'],
    shadow_id: 'e',
  })
})

test('members need a matching run first, and a team can go without a shadow', async () => {
  builderApi(null)
  const user = userEvent.setup()
  renderRoute(`/teams/new?task=${task.id}`)
  const leads = await screen.findByRole('list', { name: 'Team Lead options' })
  await user.click(
    within(leads).getAllByRole('button', { name: 'Choose as lead' })[0] as HTMLElement,
  )
  expect(
    await screen.findByText(/no matching results yet, so members cannot be suggested/),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Run matching' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Create team' })).not.toBeInTheDocument()
})

test('a saved team shows its lead, members and shadow, and is listed under Teams', async () => {
  const user = userEvent.setup()
  // The mock API builds the team from the task's demo matching run.
  const { router } = renderRoute(`/teams/new?task=${task.id}`)
  const leads = await screen.findByRole('list', { name: 'Team Lead options' })
  await user.click(
    within(leads).getAllByRole('button', { name: 'Choose as lead' })[0] as HTMLElement,
  )
  await user.click(await screen.findByRole('button', { name: 'No shadow' }))
  await user.click(await screen.findByRole('button', { name: 'Create team' }))

  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/teams\/[0-9a-f-]{36}$/))
  expect(await screen.findByRole('heading', { name: `Team for ${task.code}` })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Team Lead' })).toHaveTextContent('Leads the team')
  expect(screen.getByRole('region', { name: 'Shadow' })).toHaveTextContent('No shadow')
  expect(screen.getByRole('link', { name: /Open task to accept people/ })).toHaveAttribute(
    'href',
    `/tasks/${task.id}`,
  )

  await user.click(screen.getByRole('link', { name: 'All teams' }))
  const table = await screen.findByRole('table', { name: 'Teams' })
  expect(within(table).getByText(task.title)).toBeInTheDocument()
})

test('Planning offers one way to staff a task: build a team', async () => {
  const user = userEvent.setup()
  const { router } = renderRoute('/planning')
  const group = await screen.findByRole('region', { name: 'Staff a project' })
  const links = within(group).getAllByRole('link')
  expect(links.map((l) => l.textContent)).toEqual([
    expect.stringMatching(/Who should be on the team for a task\?/),
    expect.stringMatching(/Which teams have we put together\?/),
  ])
  await user.click(links[0] as HTMLElement)
  await waitFor(() => expect(router.state.location.pathname).toBe('/teams/new'))
  expect(await screen.findByRole('heading', { name: 'Build a team' })).toBeInTheDocument()
})
