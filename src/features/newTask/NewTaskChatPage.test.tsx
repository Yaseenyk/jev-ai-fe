import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { HttpResponse, http } from 'msw'

import type { InterpretResponse, Skill, TaskCreate } from '@/api/types'

import demo from '@/mocks/data/demo.json'
import { server } from '@/test/setup'
import { renderRoute } from '@/test/render'

const SNOWFLAKE_ID =
  (demo as unknown as { skills: Skill[] }).skills.find((sk) => sk.name === 'Snowflake')?.id ?? ''

const NOTHING: InterpretResponse = {
  title: null,
  client_code: null,
  domain: null,
  required_level: null,
  min_years_experience: null,
  must_skills: [],
  nice_skills: [],
  start_in_days: null,
  duration_weeks: null,
  allocation_pct_required: null,
  headcount: null,
  work_mode: null,
  location: null,
  priority: null,
  unmatched_skills: [],
  notes: [],
  model: 'test-llm',
}

/** Answers the file upload with `read` and records what the task was created with. */
function backend(read: InterpretResponse) {
  const created: TaskCreate[] = []
  const files: string[] = []
  server.use(
    http.post('*/api/v1/tasks/interpret-file', async ({ request }) => {
      const file = (await request.formData()).get('file')
      files.push(file instanceof File ? file.name : '')
      return HttpResponse.json(read)
    }),
    http.post('*/api/v1/tasks', async ({ request }) => {
      const body = (await request.json()) as TaskCreate
      created.push(body)
      return HttpResponse.json(
        { ...body, id: '11111111-1111-4111-8111-111111111111', code: 'TSK-0099' },
        { status: 201 },
      )
    }),
    http.post('*/api/v1/tasks/:taskId/match-runs', () =>
      HttpResponse.json({ run_id: 'run-new', status: 'queued' }, { status: 202 }),
    ),
  )
  return { created, files }
}

type User = ReturnType<typeof userEvent.setup>

const upload = async (user: User, name = 'jd.pdf') =>
  user.upload(
    await screen.findByLabelText('Job description file'),
    new File(['%PDF-1.4'], name, { type: 'application/pdf' }),
  )

const choose = async (user: User, label: string) =>
  user.click(
    within(await screen.findByRole('group', { name: 'Choose an answer' })).getByRole('button', {
      name: label,
    }),
  )

test('a full JD is read, only the missing details are asked, and matching starts', async () => {
  const { created, files } = backend({
    ...NOTHING,
    title: 'Senior Snowflake engineer for claims',
    domain: 'bfsi',
    required_level: 'L4',
    min_years_experience: 6,
    must_skills: [SNOWFLAKE_ID],
    duration_weeks: 26,
    work_mode: 'remote',
    unmatched_skills: ['Dataiku'],
  })
  const user = userEvent.setup()
  const { router } = renderRoute('/tasks/new')
  await upload(user)

  expect(await screen.findByText(/I found \d+ details\. 3 quick questions/)).toBeInTheDocument()
  expect(files).toEqual(['jd.pdf'])
  expect(screen.getByText(/Not in the skills list: Dataiku/)).toBeInTheDocument()

  // Only the client, the start and how many people are missing, in that order.
  expect(screen.getByText('Question 1 of 3')).toBeInTheDocument()
  expect(screen.getByText('Which client is this for?')).toBeInTheDocument()
  await choose(user, 'CL-ACME')
  expect(await screen.findByText('Question 2 of 3')).toBeInTheDocument()
  await choose(user, 'In 2 weeks')
  expect(await screen.findByText('How many people do you need for this role?')).toBeInTheDocument()
  await choose(user, '2 people')

  expect(await screen.findByText(/That's all I need/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit Duration' })).toHaveTextContent('24 weeks')
  await user.click(screen.getByRole('button', { name: 'Find people' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/runs/run-new'))
  const task = created[0]
  expect(task?.client_code).toBe('CL-ACME')
  expect(task?.work_mode).toBe('remote')
  expect(task?.priority).toBe('medium')
  expect(task?.headcount).toBe(2)
  expect(task?.requirements).toEqual([
    { skill_id: SNOWFLAKE_ID, min_proficiency: 3, must_have: true },
  ])
})

test('an empty document gets five questions at most; the rest are defaults', async () => {
  const { created } = backend(NOTHING)
  const user = userEvent.setup()
  renderRoute('/tasks/new')
  await upload(user, 'requirement.png')

  expect(await screen.findByText(/couldn't find the role's details/)).toBeInTheDocument()
  expect(screen.getByText('Question 1 of 5')).toBeInTheDocument()
  await user.type(await screen.findByRole('textbox', { name: 'Search skills' }), 'snow')
  await user.click(
    within(screen.getByRole('list', { name: 'Skill suggestions' })).getByRole('button', {
      name: /Snowflake/,
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Done' }))
  await user.type(
    await screen.findByRole('textbox', { name: 'Your answer' }),
    'Snowflake engineer{Enter}',
  )
  await choose(user, 'CL-ACME')
  await choose(user, 'BFSI') // the mock clients have no domain
  expect(await screen.findByText('Question 5 of 5')).toBeInTheDocument()
  await choose(user, 'As soon as possible')

  expect(await screen.findByText(/That's all I need/)).toBeInTheDocument()
  expect(screen.queryByText(/Question \d of/)).not.toBeInTheDocument()
  expect(screen.getByText(/details set by default/)).toBeInTheDocument()

  // A default can still be changed, and changing it asks nothing more.
  await user.click(screen.getByRole('button', { name: 'Edit Duration' }))
  expect(await screen.findByText('Changing Duration')).toBeInTheDocument()
  await choose(user, '8 weeks')
  expect(await screen.findByText(/That's all I need/)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Find people' }))
  await waitFor(() => expect(created).toHaveLength(1))
  expect(created[0]).toMatchObject({
    headcount: 1,
    title: 'Snowflake engineer',
    duration_weeks: 8,
    required_level: 'L3',
    min_years_experience: 0,
    work_mode: 'hybrid',
    location_constraint: [],
    allocation_pct_required: 100,
    clearance_required: null,
  })
}, 15_000)

test('typed text still works, and a failed read falls back to the questions', async () => {
  server.use(
    http.post('*/api/v1/tasks/interpret', () =>
      HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Llm unavailable',
          status: 503,
          code: 'llm_unavailable',
          detail: 'down',
        },
        { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    ),
  )
  const user = userEvent.setup()
  renderRoute('/tasks/new')
  await user.type(
    await screen.findByRole('textbox', { name: 'Describe the role' }),
    'anything{Enter}',
  )
  expect(await screen.findByText(/couldn't read that just now/)).toBeInTheDocument()
  expect(screen.getByText(/Which skills are a must-have/)).toBeInTheDocument()
})

test('editing a task opens every detail filled in, and saves changes', async () => {
  const user = userEvent.setup()
  const { router } = renderRoute('/tasks')
  const [first] = await screen.findAllByRole('link', { name: /TSK-/ })
  await user.click(first as HTMLElement)
  await user.click(await screen.findByRole('link', { name: /Edit task/ }))

  expect(await screen.findByText(/You're editing TSK-/)).toBeInTheDocument()
  await user.click(screen.getAllByRole('button', { name: 'All details' })[0] as HTMLElement)
  await user.click(await screen.findByRole('button', { name: 'Edit Priority' }))
  await choose(user, 'Critical')
  await user.click(await screen.findByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/tasks\/[^/]+$/))
  expect(await screen.findByText('Critical priority')).toBeInTheDocument()
})
