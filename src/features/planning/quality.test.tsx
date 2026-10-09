import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'

import hrJson from '@/mocks/data/hr.json'
import { server } from '@/test/setup'
import { renderRoute, signInAs } from '@/test/render'

const employee = (hrJson as unknown as { employees: { id: string; full_name: string }[] })
  .employees[0]
if (!employee) throw new Error('hr.json needs an employee')

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

afterAll(() => signInAs('manager1@srtm.local'))

test('HR adds a skill suggested by the person’s work, at a chosen level, or dismisses one', async () => {
  await signInAs('hr@srtm.local')
  const user = userEvent.setup()
  renderRoute(`/employees/${employee.id}`)
  const panel = await screen.findByRole('region', { name: 'Suggested skills' })
  expect(within(panel).getByText('Kubernetes')).toBeInTheDocument()
  await user.selectOptions(within(panel).getByLabelText('Level for Kubernetes'), '3')
  await user.click(within(panel).getByRole('button', { name: 'Add Kubernetes' }))
  expect(await within(panel).findByText('Terraform')).toBeInTheDocument()
  expect(within(panel).queryByText('Kubernetes')).not.toBeInTheDocument()
  await user.click(within(panel).getByRole('button', { name: 'Dismiss Terraform' }))
  expect(await screen.findByRole('heading', { name: employee.full_name })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Suggested skills' })).not.toBeInTheDocument()
})

test('HR sees how far matching can trust the profiles and who to fix first', async () => {
  await signInAs('hr@srtm.local')
  const user = userEvent.setup()
  renderRoute('/company')
  const card = await screen.findByRole('region', { name: 'Data quality' })
  expect(within(card).getByText(/Matching is limited by/)).toBeInTheDocument()
  expect(within(card).getByText(/Fix these first/)).toBeInTheDocument()
  await user.click(within(card).getByRole('button', { name: /Refresh skills from work/ }))
  expect(await within(card).findByText(/Updated 12 “last used” dates/)).toBeInTheDocument()
})

test('a value card shows career paths and opens a printable plan', async () => {
  const user = userEvent.setup()
  renderRoute(`/planning/people/${employee.id}`)
  const panel = await screen.findByRole('region', { name: 'Career paths' })
  expect(within(panel).getByText(/1 skill away from 6 tasks/)).toBeInTheDocument()
  expect(within(panel).getByText(/Kubernetes \(level 2 → 3\)/)).toBeInTheDocument()
  await user.click(within(panel).getByRole('link', { name: 'Printable plan' }))
  expect(await screen.findByRole('heading', { name: 'Career plan' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Print or save as PDF/ })).toBeInTheDocument()
})

test('an admin gives a client its own bill rate and can remove it', async () => {
  asAdmin()
  const user = userEvent.setup()
  renderRoute('/admin?tab=rate-card')
  const panel = await screen.findByRole('region', { name: 'Client rates' })
  expect(within(panel).getByText('No client has its own rates yet.')).toBeInTheDocument()
  const client = within(panel).getByLabelText('Client')
  const options = await within(client).findAllByRole('option')
  await user.selectOptions(client, (options[1] as HTMLOptionElement).value)
  await user.selectOptions(within(panel).getByLabelText('Band'), 'B')
  const rate = within(panel).getByLabelText('Bill rate per week')
  await user.clear(rate)
  await user.type(rate, '1800')
  await user.click(within(panel).getByRole('button', { name: 'Save client rate' }))
  expect(await within(panel).findByText(/\$1,800 a week/)).toBeInTheDocument()
  expect(within(panel).getByText('50% margin')).toBeInTheDocument()
  await user.click(within(panel).getByRole('button', { name: /^Remove .* band B$/ }))
  expect(await within(panel).findByText('No client has its own rates yet.')).toBeInTheDocument()
})

test('an admin changes the margin target and margins are judged against it', async () => {
  asAdmin()
  const user = userEvent.setup()
  renderRoute('/admin?tab=rate-card')
  const target = await screen.findByLabelText('Margin target (%)')
  expect(target).toHaveValue(30)
  await user.clear(target)
  await user.type(target, '45')
  await user.click(screen.getByRole('button', { name: /Save rate card/ }))
  expect(await screen.findByText(/under the 45% margin target/)).toBeInTheDocument()
})

test('HR searches the skills list and adds a missing skill once', async () => {
  await signInAs('hr@srtm.local')
  const user = userEvent.setup()
  renderRoute('/company?tab=skills')
  const form = await screen.findByRole('form', { name: 'Add a skill' })
  await user.type(within(form).getByLabelText('Skill'), 'Qwik')
  await user.selectOptions(within(form).getByLabelText('Category'), 'framework')
  await user.type(within(form).getByLabelText(/Other names/), 'qwikjs')
  await user.click(within(form).getByRole('button', { name: 'Add skill' }))
  const list = screen.getByRole('list', { name: 'Skills' })
  expect(await within(list).findByText('Qwik')).toBeInTheDocument()
  await user.type(within(form).getByLabelText('Skill'), 'qwik')
  await user.click(within(form).getByRole('button', { name: 'Add skill' }))
  expect(await within(form).findByText(/Already a skill or alias: qwik/)).toBeInTheDocument()
})
