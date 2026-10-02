import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
