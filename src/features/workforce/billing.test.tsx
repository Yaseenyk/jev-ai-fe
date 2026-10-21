import { screen, within } from '@testing-library/react'

import hrJson from '@/mocks/data/hr.json'
import { renderRoute, signInAs } from '@/test/render'

const employee = (hrJson as unknown as { employees: { id: string }[] }).employees[0]
if (!employee) throw new Error('hr.json needs an employee')

beforeEach(() => vi.stubEnv('VITE_SHOW_BILLING', 'false'))
afterEach(async () => {
  vi.unstubAllEnvs()
  await signInAs('manager1@srtm.local')
})

test('with billing hidden, no money or cost band shows on planning screens', async () => {
  renderRoute('/planning?tab=bench')
  expect((await screen.findAllByText('Free now')).length).toBeGreaterThan(0)
  expect(screen.queryByText('Idle cost per week')).not.toBeInTheDocument()
  expect(screen.queryByText('Idle cost / week')).not.toBeInTheDocument()
  const nav = screen.getAllByRole('navigation')[0] as HTMLElement
  expect(within(nav).queryByRole('link', { name: /Savings/ })).not.toBeInTheDocument()
})

test('with billing hidden, a person shows no revenue, margin or cost band', async () => {
  renderRoute(`/planning/people/${employee.id}`)
  expect(await screen.findByText('Weeks on client work')).toBeInTheDocument()
  expect(screen.queryByText(/Revenue billed/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Margin on billable work/)).not.toBeInTheDocument()
  expect(screen.queryByText(/cost band/i)).not.toBeInTheDocument()
})

test('with billing hidden, the savings page and the rate card are not reachable', async () => {
  await signInAs('admin@srtm.local')
  renderRoute('/reports')
  expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent('Savings')
  renderRoute('/admin')
  expect(await screen.findByRole('tab', { name: 'Users' })).toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Rate card' })).not.toBeInTheDocument()
})
