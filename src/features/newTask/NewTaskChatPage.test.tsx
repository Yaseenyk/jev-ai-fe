import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { HttpResponse, http } from 'msw'

import type { Skill } from '@/api/types'

import demo from '@/mocks/data/demo.json'
import { server } from '@/test/setup'
import { renderRoute } from '@/test/render'

// Clicks through all ~20 questions, so it needs more than the default 5 s.
const FULL_FLOW_TIMEOUT_MS = 20_000

test(
  'manager creates a task by answering the chat, edits an answer, and lands on the task',
  async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/tasks/new')
    const choose = async (label: string) =>
      user.click(
        within(await screen.findByRole('group', { name: 'Choose an answer' })).getByRole('button', {
          name: label,
        }),
      )

    await user.click(await screen.findByRole('button', { name: 'Answer step by step instead' }))
    await user.type(await screen.findByRole('textbox', { name: 'Your answer' }), 'Hi')
    await user.click(screen.getByRole('button', { name: 'Send answer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 5')
    await user.type(
      screen.getByRole('textbox', { name: 'Your answer' }),
      ' there, Senior Data Engineer{Enter}',
    )

    await choose('CL-ACME')
    await choose('BFSI')
    await choose('L4 · Senior')
    await choose('5+ years')

    await user.type(await screen.findByRole('textbox', { name: 'Search skills' }), 'snow')
    await user.click(
      within(screen.getByRole('list', { name: 'Skill suggestions' })).getByRole('button', {
        name: /Snowflake/,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Done' }))

    await choose('3 · Working')
    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    await choose('In 2 weeks')
    await choose('12 weeks')
    await choose('Full-time (100%)')
    await choose('Remote')
    await choose('India (IST)')
    await choose('2 hours')
    await choose('Band C')
    await choose('No')
    await choose('High')
    await user.click(await screen.findByRole('button', { name: 'Skip' }))

    expect(await screen.findByText(/That's everything/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Location' })).toHaveTextContent('Not needed')

    await user.click(screen.getByRole('button', { name: 'Edit Domain' }))
    await choose('Retail')
    expect(await screen.findByText(/That's everything/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create task' }))
    expect(
      await screen.findByRole('heading', { name: 'Hi there, Senior Data Engineer' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/tasks\/[0-9a-f-]{36}$/)
    expect(screen.getByText('Retail')).toBeInTheDocument()
    expect(screen.getByText(/Snowflake/)).toBeInTheDocument()
  },
  FULL_FLOW_TIMEOUT_MS,
)

const SNOWFLAKE_ID =
  (demo as unknown as { skills: Skill[] }).skills.find((sk) => sk.name === 'Snowflake')?.id ?? ''

test('manager describes the role, confirms what was understood, and answers only the rest', async () => {
  const sent: unknown[] = []
  server.use(
    http.post('*/api/v1/tasks/interpret', async ({ request }) => {
      sent.push(await request.json())
      return HttpResponse.json({
        title: 'Senior Snowflake engineer for claims',
        client_code: 'CL-ACME',
        domain: 'bfsi',
        required_level: 'L4',
        min_years_experience: 6,
        must_skills: [SNOWFLAKE_ID],
        nice_skills: [],
        start_in_days: 30,
        duration_weeks: 26,
        allocation_pct_required: 100,
        work_mode: 'remote',
        location: null,
        priority: null,
        unmatched_skills: ['Dataiku'],
        notes: [],
        model: 'test-llm',
      })
    }),
  )
  const user = userEvent.setup()
  renderRoute('/tasks/new')
  await user.type(
    await screen.findByRole('textbox', { name: 'Describe the role' }),
    'Senior snowflake person for ACME claims, remote, next month for 6 months{Enter}',
  )

  expect(await screen.findByText(/Here's what I understood/)).toBeInTheDocument()
  expect(screen.getByText(/Not in the skills list: Dataiku/)).toBeInTheDocument()
  expect((sent[0] as { known_clients: string[] }).known_clients).toContain('CL-ACME')
  await user.click(screen.getByRole('button', { name: /Looks right, continue/ }))

  // Only unanswered questions remain: proficiency comes next, title/client/domain are not asked.
  expect(await screen.findByText(/What minimum proficiency/)).toBeInTheDocument()
  expect(screen.queryByText(/What's the role title/)).not.toBeInTheDocument()
  expect(screen.getByText(/I filled in \d+ details from that/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit Duration' })).toHaveTextContent('24 weeks')
})

test('if the description cannot be read, the chat falls back to step-by-step questions', async () => {
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
  expect(await screen.findByText(/couldn't read your description just now/)).toBeInTheDocument()
  expect(screen.getByText(/What's the role title/)).toBeInTheDocument()
})
