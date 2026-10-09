import { screen, within } from '@testing-library/react'

import { renderRoute, signInAs } from '@/test/render'

beforeEach(() => signInAs('manager1@srtm.local'))

test('a manager lands on the dashboard with health, tasks and idle cost', async () => {
  const { router } = renderRoute('/')
  const health = await screen.findByRole('region', { name: 'Staffing health' })
  expect(router.state.location.pathname).toBe('/dashboard')
  expect(await within(health).findByText('Profiles ready for matching')).toBeInTheDocument()
  // Too few decisions: no percentage is invented.
  expect(within(health).getByText(/Shown from 10 decisions/)).toBeInTheDocument()

  const tasks = await screen.findByRole('region', { name: 'Open tasks starting soonest' })
  expect(within(tasks).getAllByRole('link').length).toBeGreaterThan(1)

  const idle = screen.getByRole('region', { name: 'Bench idle cost ahead' })
  expect(within(idle).getByRole('table', { name: 'Bench idle cost by month' })).toBeInTheDocument()
  expect(within(idle).getAllByRole('row')).toHaveLength(13) // header + 12 months
})

test('a viewer starts on the task board, without the dashboard link', async () => {
  await signInAs('viewer@srtm.local')
  const { router } = renderRoute('/')
  await screen.findByRole('heading', { name: /^Tasks$/ })
  expect(router.state.location.pathname).toBe('/tasks')
  expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
})
