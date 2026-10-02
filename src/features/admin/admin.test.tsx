import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'

import { server } from '@/test/setup'
import { renderRoute } from '@/test/render'

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

test('only admins see the Admin area', async () => {
  const { router } = renderRoute('/admin')
  await screen.findByRole('heading', { name: /^Tasks$/ })
  expect(router.state.location.pathname).toBe('/tasks')
  expect(screen.queryByRole('link', { name: /Admin/ })).not.toBeInTheDocument()
})

test('an admin changes the band cut-offs with a reason and sees a new version', async () => {
  asAdmin()
  const user = userEvent.setup()
  renderRoute('/admin')
  await user.click(await screen.findByRole('tab', { name: 'Thresholds' }))

  const shortlist = await screen.findByLabelText('Shortlist from')
  const review = screen.getByLabelText('Review from')
  expect(shortlist).toHaveValue(80)

  await user.clear(review)
  await user.type(review, '85')
  expect(
    await screen.findByText(/Review must start below the shortlist cut-off/),
  ).toBeInTheDocument()

  await user.clear(review)
  await user.type(review, '40')
  await user.clear(shortlist)
  await user.type(shortlist, '65')
  await user.type(screen.getByLabelText('Reason for the change'), 'Pilot: show more people')
  await user.click(screen.getByRole('button', { name: /Save new version/ }))

  const history = await screen.findByRole('region', { name: 'Change history' })
  expect(await within(history).findByText('Version 2')).toBeInTheDocument()
  expect(within(history).getByText(/Shortlist ≥ 65% · Review ≥ 40%/)).toBeInTheDocument()
  expect(within(history).getByText('Pilot: show more people')).toBeInTheDocument()
})
