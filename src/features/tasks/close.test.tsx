import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderRoute } from '@/test/render'

test('a manager cancels a task with a reason, finds it under Closed, and reopens it', async () => {
  const user = userEvent.setup()
  renderRoute('/tasks')
  const [first] = await screen.findAllByRole('link', { name: /TSK-/ })
  const code = /TSK-\d+/.exec(first?.getAttribute('aria-label') ?? '')?.[0] ?? ''
  await user.click(first as HTMLElement)

  await user.click(await screen.findByRole('button', { name: 'Cancel task' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Cancel task' }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Say why')
  await user.type(
    within(dialog).getByLabelText('Why is it cancelled?'),
    'Client paused the project',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Cancel task' }))

  expect(await screen.findByText('Cancelled.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /run matching/i })).not.toBeInTheDocument()

  await user.click(screen.getByRole('link', { name: /All tasks/ }))
  await user.click(await screen.findByRole('button', { name: 'closed' }))
  const closedRow = await screen.findByRole('link', { name: new RegExp(code) })
  expect(within(closedRow).getByText('Cancelled')).toBeInTheDocument()

  await user.click(closedRow)
  await user.click(await screen.findByRole('button', { name: /Reopen task/ }))
  expect(await screen.findByRole('button', { name: /run matching/i })).toBeInTheDocument()
})
