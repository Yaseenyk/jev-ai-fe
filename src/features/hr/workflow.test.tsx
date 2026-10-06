import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { MatchRun, ShortlistItem, Task } from '@/api/types'
import demoJson from '@/mocks/data/demo.json'
import { renderRoute, signInAs } from '@/test/render'

const demo = demoJson as unknown as {
  tasks: Task[]
  runs: Record<string, { run: MatchRun; shortlist: ShortlistItem[] }>
}
// TSK-0019 has nobody in the shortlist or review band and no hiring request yet.
const task = demo.tasks.find((t) => t.code === 'TSK-0019')
const run = task && demo.runs[task.id]
if (!task || !run) throw new Error('demo data is missing TSK-0019 or its run')
if (run.shortlist.some((i) => i.band === 'shortlist' || i.band === 'review')) {
  throw new Error('TSK-0019 is expected to have no internal fit')
}

afterAll(() => signInAs('manager1@srtm.local'))

test('no internal fit: manager asks HR, HR sends candidates, manager decides, HR contacts', async () => {
  const user = userEvent.setup()

  // 1. The manager finds nobody internal and asks HR.
  await signInAs('manager1@srtm.local')
  let view = renderRoute(`/runs/${run.run.id}`)
  const noFit = await screen.findByRole('region', { name: 'No internal fit' })
  expect(within(noFit).queryByText('See external candidates')).not.toBeInTheDocument()
  await user.click(within(noFit).getByRole('button', { name: /Ask HR for candidates/ }))
  const wanted = await screen.findByLabelText(/How many candidates/)
  await user.clear(wanted)
  await user.type(wanted, '11')
  expect(screen.getByText('Between 1 and 10.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send to HR' })).toBeDisabled()
  await user.clear(wanted)
  await user.type(wanted, '3')
  await user.type(screen.getByLabelText('Anything HR should know'), 'Client needs a lead soon')
  await user.click(screen.getByRole('button', { name: 'Send to HR' }))
  const openRequest = await within(noFit).findByRole('link', { name: 'Open the request' })
  const requestPath = openRequest.getAttribute('href') ?? ''
  expect(requestPath).toMatch(/^\/hiring-requests\/req-/)
  expect(within(noFit).queryByRole('button', { name: /Ask HR/ })).not.toBeInTheDocument()
  view.unmount()

  // 2. HR is notified and opens the request from the notification.
  await signInAs('hr@srtm.local')
  view = renderRoute('/hr')
  await user.click(await screen.findByRole('button', { name: /Notifications, \d+ unread/ }))
  const notifications = await screen.findByRole('list', { name: 'Notifications' })
  await user.click(within(notifications).getByText(`New request for ${task.code}`))
  await waitFor(() => expect(view.router.state.location.pathname).toBe(requestPath))
  expect(await screen.findByText('“Client needs a lead soon”')).toBeInTheDocument()

  // 3. HR starts, picks two candidates from the ranked pool and sends them.
  await user.click(screen.getByRole('button', { name: 'Start searching' }))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Start searching' })).not.toBeInTheDocument(),
  )
  const picks = await screen.findAllByRole('checkbox', { name: /^Pick / })
  expect(picks.length).toBeGreaterThanOrEqual(2)
  const [first, second] = picks as [HTMLElement, HTMLElement]
  const names = [first, second].map((p) =>
    (p.getAttribute('aria-label') ?? '').replace(/^Pick /, ''),
  ) as [string, string]
  await user.click(first)
  await user.click(second)
  await user.type(screen.getByLabelText('Note for the manager'), 'Both can join in a month')
  await user.click(screen.getByRole('button', { name: /Send 2 to the manager/ }))
  const sent = await screen.findByRole('region', { name: 'Sent to the manager' })
  expect(within(sent).getByText(/Sent to the manager \(2 of 10\)/)).toBeInTheDocument()
  view.unmount()

  // 4. The manager sees professional profiles only and marks one fit, one not.
  await signInAs('manager1@srtm.local')
  view = renderRoute(requestPath)
  const cards = await screen.findByRole('list', { name: 'Candidates sent by HR' })
  const firstNames = names.map((n) => n.split(' ')[0] ?? n) as [string, string]
  for (const full of names) expect(within(cards).queryByText(new RegExp(full))).toBeNull()
  expect(within(cards).getAllByText('HR: “Both can join in a month”')).toHaveLength(2)
  expect(screen.queryByRole('link', { name: 'Open to contact' })).not.toBeInTheDocument()

  await user.type(within(cards).getByLabelText(`Note about ${firstNames[0]}`), 'Strong match')
  const [firstCard, secondCard] = [...cards.children] as [HTMLElement, HTMLElement]
  await user.click(within(firstCard).getByRole('button', { name: /^Fit/ }))
  await user.click(await within(secondCard).findByRole('button', { name: /Not a fit/ }))
  expect(
    await screen.findByText(/All decided. HR has been told and will contact/),
  ).toBeInTheDocument()
  view.unmount()

  // 5. HR is told, sees the fit candidate and moves them to Contacted.
  await signInAs('hr@srtm.local')
  view = renderRoute(requestPath)
  const fit = await screen.findByRole('region', { name: 'Marked fit' })
  expect(within(fit).getByText(/Manager: “Strong match”/)).toBeInTheDocument()
  await user.click(within(fit).getByRole('link', { name: 'Open to contact' }))
  expect(await screen.findByRole('heading', { name: names[0] })).toBeInTheDocument()
  const steps = screen.getByRole('list', { name: 'Status' })
  await user.click(within(steps).getByRole('button', { name: 'Contacted' }))
  await user.click(await screen.findByRole('button', { name: 'Move to Contacted' }))
  await waitFor(() =>
    expect(within(steps).getByRole('button', { name: 'Contacted' })).toBeDisabled(),
  )

  await user.click(screen.getByRole('button', { name: /Notifications, \d+ unread/ }))
  expect(
    await screen.findByText(`Manager decided on ${task.code}`, { selector: 'p' }),
  ).toBeInTheDocument()
}, 30_000)

test('a manager cannot ask twice while a request is open', async () => {
  await signInAs('manager1@srtm.local')
  const seeded = demo.tasks.find((t) => t.code === 'TSK-0013')
  const seededRun = seeded && demo.runs[seeded.id]
  if (!seededRun) throw new Error('demo data is missing TSK-0013')
  renderRoute(`/runs/${seededRun.run.id}`)
  const noFit = await screen.findByRole('region', { name: 'No internal fit' })
  expect(await within(noFit).findByRole('link', { name: 'Open the request' })).toBeInTheDocument()
  expect(within(noFit).queryByRole('button', { name: /Ask HR/ })).not.toBeInTheDocument()
})

test('HR can see external candidates from a task with no internal fit', async () => {
  const user = userEvent.setup()
  await signInAs('hr@srtm.local')
  const { router } = renderRoute(`/runs/${run.run.id}`)
  const noFit = await screen.findByRole('region', { name: 'No internal fit' })
  await user.click(within(noFit).getByRole('link', { name: 'See external candidates' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(`/tasks/${task.id}/candidates`))
  const ranked = await screen.findByRole('list', { name: 'Ranked candidates' })
  expect(within(ranked).getAllByText(/^#\d+$/).length).toBeGreaterThan(0)
})
