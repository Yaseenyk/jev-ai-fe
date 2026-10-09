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

test('HR uploads a resume for a request and sees at once whether it fits, ready to send', async () => {
  const user = userEvent.setup()
  await signInAs('hr@srtm.local')
  const { router } = renderRoute('/hiring-requests')
  await user.click(await screen.findByRole('link', { name: /TSK-0020/ }))
  const requestPath = await waitFor(() => {
    expect(router.state.location.pathname).toMatch(/^\/hiring-requests\/req-/)
    return router.state.location.pathname
  })
  await user.click(await screen.findByRole('link', { name: /Upload resumes/ }))
  await user.upload(
    await screen.findByLabelText('Resume file'),
    // The mock reads a sample profile chosen by file name; this one fits TSK-0020.
    new File(['resume'], 'cv-0.pdf', { type: 'application/pdf' }),
  )
  await user.click(screen.getByRole('button', { name: /Read the resume/ }))
  const name = await screen.findByLabelText(/^Full name/)
  await user.clear(name)
  await user.type(name, 'Asha Test')
  await user.click(screen.getByRole('checkbox', { name: /candidate agreed/ }))
  await user.click(screen.getByRole('button', { name: 'Save candidate' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(requestPath))
  // Scoring the new candidate is the slow step when the whole suite runs at once.
  expect(
    await screen.findByText(/^Asha Test fits this task: \d+%/, {}, { timeout: 15_000 }),
  ).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Pick Asha Test' })).toBeChecked()
  expect(screen.getByRole('button', { name: /Send 1 to the manager/ })).toBeEnabled()
}, 40_000)

test('viewers see no hiring requests and no "ask HR" box', async () => {
  await signInAs('viewer@srtm.local')
  const view = renderRoute('/hiring-requests')
  await screen.findByRole('heading', { name: /^Tasks$/ })
  expect(view.router.state.location.pathname).toBe('/tasks')
  view.unmount()

  renderRoute(`/runs/${run.run.id}`)
  await screen.findByText(/Matching results/)
  expect(screen.queryByRole('region', { name: 'No internal fit' })).not.toBeInTheDocument()
})

test('HR checks a resume from a task page and sees the answer on that task', async () => {
  const user = userEvent.setup()
  await signInAs('hr@srtm.local')
  const { router } = renderRoute(`/tasks/${task.id}`)
  expect(await screen.findByText(/No resumes checked yet/)).toBeInTheDocument()
  expect(screen.getByText(/The manager runs matching for the company/)).toBeInTheDocument()
  await user.click(
    screen.getAllByRole('link', { name: /Check a resume for this task/ })[0] as HTMLElement,
  )
  expect(await screen.findByText(/Checking this person against/)).toBeInTheDocument()
  await user.upload(
    await screen.findByLabelText('Resume file'),
    new File(['resume'], 'cv-0.pdf', { type: 'application/pdf' }),
  )
  await user.click(screen.getByRole('button', { name: /Read the resume/ }))
  const name = await screen.findByLabelText(/^Full name/)
  await user.clear(name)
  await user.type(name, 'Ravi Check')
  await user.click(screen.getByRole('checkbox', { name: /candidate agreed/ }))
  await user.click(screen.getByRole('button', { name: 'Save candidate' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(`/tasks/${task.id}`))
  const list = await screen.findByRole('list', { name: 'Checked resumes' })
  const card = within(list).getByRole('listitem', { name: 'Ravi Check' })
  expect(within(card).getByText('Just checked')).toBeInTheDocument()
  expect(within(card).getByText(/Good fit|Worth a look|Weak fit|Not a fit/)).toBeInTheDocument()
})

test('a notice period the resume does not state is asked, never guessed', async () => {
  const user = userEvent.setup()
  await signInAs('hr@srtm.local')
  renderRoute('/candidates/new')
  await user.upload(
    await screen.findByLabelText('Resume file'),
    new File(['resume'], 'cv-nonotice.pdf', { type: 'application/pdf' }),
  )
  await user.click(screen.getByRole('button', { name: /Read the resume/ }))
  const ask = await screen.findByRole('region', { name: 'Ask the candidate' })
  expect(within(ask).getByText(/notice period/)).toBeInTheDocument()
  expect(screen.getByLabelText(/^Notice period/)).toHaveValue(null)
  await user.click(screen.getByRole('checkbox', { name: /candidate agreed/ }))
  expect(screen.getByText(/Enter the notice period, or tick/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save candidate' })).toBeDisabled()
  await user.type(screen.getByLabelText(/^Notice period/), '15')
  expect(screen.getByRole('button', { name: 'Save candidate' })).toBeEnabled()
})

test('HR suggests an outside candidate; the manager opens the resume and decides on the task page', async () => {
  const user = userEvent.setup()
  await signInAs('hr@srtm.local')
  const hrView = renderRoute(`/candidates/new?task=${task.id}`)
  await user.upload(
    await screen.findByLabelText('Resume file'),
    new File(['resume'], 'cv-0.pdf', { type: 'application/pdf' }),
  )
  await user.click(screen.getByRole('button', { name: /Read the resume/ }))
  const name = await screen.findByLabelText(/^Full name/)
  await user.clear(name)
  await user.type(name, 'Meera Suggest')
  await user.click(screen.getByRole('checkbox', { name: /candidate agreed/ }))
  await user.click(screen.getByRole('button', { name: 'Save candidate' }))
  const card = await screen.findByRole('listitem', { name: 'Meera Suggest' })
  await user.click(within(card).getByRole('button', { name: /Suggest to the manager/ }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText(/Note for the manager/), 'Strong fit')
  await user.click(within(dialog).getByRole('button', { name: /Send to the manager/ }))
  expect(await within(card).findByText('Sent to the manager')).toBeInTheDocument()
  hrView.unmount()

  await signInAs('manager1@srtm.local')
  renderRoute(`/tasks/${task.id}`)
  const section = await screen.findByRole('region', { name: 'Candidates from HR' })
  await user.click(within(section).getByRole('button', { name: /Meera/ }))
  const sheet = await screen.findByRole('dialog')
  expect(await within(sheet).findByText(/No resume file is kept/)).toBeInTheDocument()
  expect(within(sheet).getByText('Strong fit')).toBeInTheDocument()
  await user.click(within(sheet).getByRole('button', { name: /Fit, HR can contact them/ }))
  expect(await within(sheet).findByText('You said: fit')).toBeInTheDocument()
})
