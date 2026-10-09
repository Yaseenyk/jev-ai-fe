import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'

import hrJson from '@/mocks/data/hr.json'
import { server } from '@/test/setup'
import { renderRoute, signInAs } from '@/test/render'

const employee = (hrJson as unknown as { employees: { id: string }[] }).employees[0]
if (!employee) throw new Error('hr.json needs an employee')

afterEach(() => signInAs('manager1@srtm.local'))

test('Pipeline: a deal adds to the skills the company will need', async () => {
  const user = userEvent.setup()
  renderRoute('/planning?tab=pipeline')
  const form = await screen.findByRole('form', { name: 'Add a deal' })
  await user.type(within(form).getByLabelText('Deal'), 'Claims platform')
  const skill = within(form).getByLabelText('Add a skill the deal needs')
  await waitFor(() => expect(within(skill).getAllByRole('option').length).toBeGreaterThan(1))
  const option = within(skill).getAllByRole('option')[1] as HTMLOptionElement
  await user.selectOptions(skill, option.value)
  await user.click(within(form).getByRole('button', { name: 'Add deal' }))
  const deals = await screen.findByRole('list', { name: 'Deal list' })
  expect(await within(deals).findByText('Claims platform')).toBeInTheDocument()
  const table = await screen.findByRole('table', { name: 'Skill demand' })
  expect(await within(table).findByText(option.textContent)).toBeInTheDocument()
})

test('Savings shows hiring cost avoided and this month against the last', async () => {
  renderRoute('/reports')
  expect(await screen.findByText(/hiring cost avoided/)).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'This month' })).toHaveTextContent('Filled from inside')
  expect(screen.getByRole('region', { name: 'Month before' })).toBeInTheDocument()
})

test('Setup lists what a new company still has to do', async () => {
  await signInAs('admin@srtm.local')
  renderRoute('/setup')
  expect(await screen.findByText('2 of 3 done')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Enter your rate card' })).toHaveAttribute(
    'href',
    '/admin?tab=rate-card',
  )
})

test('A person’s page shows what they are working on from timesheets', async () => {
  await signInAs('hr@srtm.local')
  renderRoute(`/employees/${employee.id}`)
  const panel = await screen.findByRole('region', { name: 'Working on now' })
  expect(await within(panel).findByText(/72 hours on 9 days/)).toBeInTheDocument()
})

test('Timesheets can be imported from Excel', async () => {
  await signInAs('hr@srtm.local')
  const user = userEvent.setup()
  renderRoute('/import')
  await user.click(await screen.findByRole('combobox', { name: /What the file contains/ }))
  await user.click(await screen.findByRole('option', { name: 'Timesheets' }))
  expect(await screen.findByLabelText('CSV or Excel file')).toHaveAttribute(
    'accept',
    '.csv,text/csv,.xlsx',
  )
})

test('An employee login lands on their own profile with a short menu', async () => {
  await signInAs('employee@srtm.local')
  const user = userEvent.setup()
  renderRoute('/')
  expect(await screen.findByRole('region', { name: 'My skills' })).toBeInTheDocument()
  const nav = screen.getAllByRole('navigation')[0] as HTMLElement
  expect(within(nav).getByRole('link', { name: /My profile/ })).toBeInTheDocument()
  expect(within(nav).queryByRole('link', { name: /Tasks/ })).not.toBeInTheDocument()

  const tell = screen.getByRole('form', { name: 'Tell HR about a skill' })
  const skill = within(tell).getByLabelText('Skill')
  await waitFor(() => expect(within(skill).getAllByRole('option').length).toBeGreaterThan(1))
  await user.selectOptions(
    skill,
    (within(skill).getAllByRole('option')[1] as HTMLOptionElement).value,
  )
  await user.click(within(tell).getByRole('button', { name: 'Send to HR' }))
  expect(await screen.findByRole('status')).toHaveTextContent('HR confirms it')

  await user.click(screen.getByRole('button', { name: 'Healthcare' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Healthcare' })).toHaveAttribute(
      'aria-pressed',
      'true',
    ),
  )
})

test('Help shows the guide for the signed-in role', async () => {
  renderRoute('/help')
  expect(await screen.findByRole('region', { name: 'Find someone for a role' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Your own profile' })).not.toBeInTheDocument()
})

test('An admin links an employee login to a person by code', async () => {
  await signInAs('admin@srtm.local')
  server.use(
    http.get('*/api/v1/employees', () =>
      HttpResponse.json({ items: [], total: 0, limit: 5, offset: 0 }),
    ),
  )
  const user = userEvent.setup()
  renderRoute('/admin?tab=users')
  await user.click(await screen.findByRole('button', { name: 'Add person' }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText('Work email'), 'asha@srtm.local')
  await user.type(within(dialog).getByLabelText('Name'), 'Asha')
  await user.click(within(dialog).getByRole('combobox', { name: 'Role' }))
  await user.click(await screen.findByRole('option', { name: /Employee/ }))
  await user.type(within(dialog).getByLabelText('Employee code'), 'SPY-99999')
  await user.click(within(dialog).getByRole('button', { name: 'Add person' }))
  expect(await within(dialog).findByText('No employee with code SPY-99999')).toBeInTheDocument()
})
