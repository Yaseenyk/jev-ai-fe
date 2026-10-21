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

test('pointers show what to act on, each linking to its screen', async () => {
  renderRoute('/dashboard')
  const waiting = await screen.findByRole('region', { name: 'Waiting for your decision' })
  expect(within(waiting).getAllByRole('link').length).toBeGreaterThan(1)
  expect(within(waiting).getAllByText(/recommended, waiting 2 days/).length).toBeGreaterThan(0)

  const bench = screen.getByRole('region', { name: 'Bench' })
  expect(within(bench).getByText('12 people')).toBeInTheDocument()
  expect(within(bench).getByRole('link', { name: 'Open Bench' })).toHaveAttribute(
    'href',
    '/planning?tab=bench',
  )
  const fill = screen.getByRole('region', { name: 'Time to fill' })
  expect(within(fill).getByText('4 days')).toBeInTheDocument()
  const gaps = screen.getByRole('region', { name: 'Skill gaps in the next 30 days' })
  expect(within(gaps).getByText('Shortage')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Rolling off in 30 days' })).toHaveTextContent(
    '2 with no next task',
  )
  expect(screen.getByRole('region', { name: 'Key-person risk' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Nobody inside fits' })).toBeInTheDocument()
})
