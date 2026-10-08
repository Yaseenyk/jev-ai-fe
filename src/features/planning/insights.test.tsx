import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'

import demo from '@/mocks/data/demo.json'
import hrJson from '@/mocks/data/hr.json'
import { server } from '@/test/setup'
import { renderRoute } from '@/test/render'

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

test('people rolling off can be held for a task or planned for upskilling', async () => {
  const user = userEvent.setup()
  renderRoute('/planning?tab=rolloffs')
  expect(await screen.findByText('Weekly cost at risk')).toBeInTheDocument()
  const hold = (await screen.findAllByRole('button', { name: /^Hold for TSK-/ }))[0] as HTMLElement
  await user.click(hold)
  expect((await screen.findAllByText('Held')).length).toBeGreaterThan(0)
  await user.click(screen.getByRole('button', { name: 'Plan upskilling' }))
  expect(await screen.findByText('Upskilling planned')).toBeInTheDocument()
})

test('what-if says whether a project could be staffed from inside', async () => {
  const user = userEvent.setup()
  renderRoute('/planning?tab=whatif')
  const pick = await screen.findByLabelText('Role 1 add skill')
  await waitFor(() => expect(within(pick).getAllByRole('option').length).toBeGreaterThan(1))
  const options = within(pick).getAllByRole('option')
  await user.selectOptions(pick, (options[1] as HTMLOptionElement).value)
  await user.click(screen.getByRole('button', { name: /Can we staff it/ }))
  const result = await screen.findByRole('region', { name: 'What-if result' })
  expect(await within(result).findByText('Staffed from inside')).toBeInTheDocument()
  expect(within(result).getByText('Margin per week')).toBeInTheDocument()
})

test('a filled task asks how each placed person is doing', async () => {
  const data = demo as unknown as { tasks: { id: string }[]; runs: Record<string, unknown> }
  const task = data.tasks.find((t) => t.id in data.runs)
  if (!task) throw new Error('demo.json needs a task with a recorded run')
  const status = (value: string) =>
    fetch(`http://localhost/api/v1/tasks/${task.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: value }),
    })
  await status('filled')
  const user = userEvent.setup()
  renderRoute(`/tasks/${task.id}`)
  const card = await screen.findByRole('region', { name: 'How is it going?' })
  await user.click(await within(card).findByRole('button', { name: 'Working well' }))
  expect(
    await within(card).findByRole('button', { name: 'Working well', pressed: true }),
  ).toBeInTheDocument()
  await status('open')
})

test('admins see what managers value and the fairness check', async () => {
  asAdmin()
  renderRoute('/admin?tab=fairness')
  const values = await screen.findByRole('region', { name: 'What your managers value' })
  expect(within(values).getByText('Has the must-have skills')).toBeInTheDocument()
  const fair = screen.getByRole('region', { name: 'Fairness check' })
  const table = await within(fair).findByRole('table', { name: 'By location' })
  expect(within(table).getByText('63%')).toBeInTheDocument() // the flagged group
})

test('the Health tab shows the proof from outcomes', async () => {
  asAdmin()
  renderRoute('/admin?tab=health')
  expect(await screen.findByRole('region', { name: 'Proof from outcomes' })).toBeInTheDocument()
})

test('a client profile leaves out everything internal', async () => {
  renderRoute(`/planning/people/${employee.id}`)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('link', { name: 'Client profile' }))
  const profile = await screen.findByRole('article', { name: `Profile of ${employee.full_name}` })
  expect(within(profile).getByRole('region', { name: 'Key skills' })).toBeInTheDocument()
  expect(within(profile).queryByText(/\$|margin|band|rated/i)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Print or save as PDF/ })).toBeInTheDocument()
})
