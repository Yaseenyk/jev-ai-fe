import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderRoute } from '@/test/render'

test('the bench plan gives each person one step a manager can take, finish or drop', async () => {
  const user = userEvent.setup()
  renderRoute('/planning?tab=benchplan')
  const summary = await screen.findByLabelText('Bench plan summary')
  expect(within(summary).getByText('3 people')).toBeInTheDocument()
  expect(within(summary).getByText('2 steps waiting')).toBeInTheDocument()

  const list = screen.getByRole('list', { name: 'Next steps' })
  const rows = within(list).getAllByRole('listitem')
  const [propose, learn, profile] = [rows[0], rows[1], rows[2]] as [
    HTMLElement,
    HTMLElement,
    HTMLElement,
  ]
  expect(within(profile).getByRole('link', { name: /Open profile/ })).toBeInTheDocument()

  await user.click(within(propose).getByRole('button', { name: /^Hold .* for TSK-/ }))
  expect(await within(propose).findByText(/^Held for TSK-/)).toBeInTheDocument()
  expect(await within(summary).findByText('1 steps waiting')).toBeInTheDocument()

  await user.click(within(learn).getByRole('button', { name: /Start upskilling/ }))
  expect(await within(learn).findByText(/^Upskilling:/)).toBeInTheDocument()

  await user.click(within(propose).getByRole('button', { name: /Mark done/ }))
  expect(
    await within(propose).findByRole('button', { name: /^Hold .* for TSK-/ }),
  ).toBeInTheDocument()
})
