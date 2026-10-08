import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import demo from '@/mocks/data/demo.json'
import { renderRoute, signInAs } from '@/test/render'

const data = demo as unknown as { runs: Record<string, { run: { id: string } }> }
const runId = Object.values(data.runs)[0]?.run.id
if (!runId) throw new Error('demo.json needs a recorded run')

afterAll(() => signInAs('manager1@srtm.local'))

test('a manager sees which people are in another unit and whom to contact', async () => {
  renderRoute(`/runs/${runId}`)
  // Manager 1 heads BU001: people in BU002 show their unit and its head; BU001 shows nothing.
  const badges = await screen.findAllByText('BU002 · contact Resource Manager 2')
  expect(badges.length).toBeGreaterThan(0)
  expect(badges[0]?.closest('a')).toHaveAttribute('href', 'mailto:manager2@srtm.local')
  expect(screen.queryByText(/^BU001 ·/)).not.toBeInTheDocument()
})

test('on the bench too, only people from other units are marked', async () => {
  renderRoute('/planning')
  const table = await screen.findByRole('table', { name: 'Bench' })
  expect(
    (await within(table).findAllByText('BU002 · contact Resource Manager 2')).length,
  ).toBeGreaterThan(0)
  expect(within(table).queryByText(/^BU001 ·/)).not.toBeInTheDocument()
})

test('HR adds a unit and changes a head', async () => {
  await signInAs('hr@srtm.local')
  const user = userEvent.setup()
  renderRoute('/company?tab=units')
  const table = await screen.findByRole('table', { name: 'Business units' })
  expect(within(table).getByText('BU001')).toBeInTheDocument()
  await user.type(screen.getByLabelText('Code'), 'bu003')
  await user.type(screen.getByLabelText('Name'), 'Cloud')
  await user.selectOptions(screen.getByLabelText('Head'), 'm2')
  await user.click(screen.getByRole('button', { name: 'Add unit' }))
  expect(await within(table).findByText('BU003')).toBeInTheDocument()
  const head = screen.getByLabelText('Head of BU003')
  expect(head).toHaveValue('m2')
  await user.selectOptions(head, 'm1')
  expect(await screen.findByLabelText('Head of BU003')).toHaveValue('m1')
})
