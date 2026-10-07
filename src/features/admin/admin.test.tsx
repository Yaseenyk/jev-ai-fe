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

test('the Learning tab shows what feedback can teach the model', async () => {
  asAdmin()
  const user = userEvent.setup()
  renderRoute('/admin')
  await user.click(await screen.findByRole('tab', { name: 'Learning' }))
  const stats = await screen.findByRole('region', { name: 'Feedback so far' })
  expect(within(stats).getByText('Can train the model').nextSibling).toHaveTextContent('2')
  expect(screen.getByText(/Planning reasons/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Export training data \(2\)/ })).toBeEnabled()
})

test('an admin sees the models, is stopped from switching to a weaker one, and can force it', async () => {
  asAdmin()
  const user = userEvent.setup()
  renderRoute('/admin')
  await user.click(await screen.findByRole('tab', { name: 'Models' }))

  const list = await screen.findByRole('table', { name: 'Models' })
  expect(within(list).getByText('87.9%')).toBeInTheDocument()
  expect(within(list).getAllByText('simple ranking 86.1%')).toHaveLength(2)

  await user.click(within(list).getByRole('button', { name: 'Make active' }))
  await user.type(await screen.findByLabelText('Reason'), 'Compare the old one')
  await user.click(screen.getByRole('button', { name: 'Make active' }))
  expect(await screen.findByText(/ranks worse than student-v2/)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Switch anyway' }))
  const history = await screen.findByRole('region', { name: 'Switch history' })
  expect(await within(history).findByText('student-v2 → student')).toBeInTheDocument()
  expect(within(history).getByText('forced')).toBeInTheDocument()

  await user.click(within(history).getByRole('button', { name: 'Back to student-v2' }))
  expect(await within(history).findByText('student → student-v2')).toBeInTheDocument()
})

test('an admin adds a person, sees the temporary password once, and manages access', async () => {
  asAdmin()
  const user = userEvent.setup()
  renderRoute('/admin')
  await user.click(await screen.findByRole('tab', { name: 'Users' }))
  const people = await screen.findByRole('table', { name: 'People' })
  expect(within(people).getByText('viewer@srtm.local')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Add person/ }))
  await user.type(await screen.findByLabelText('Work email'), 'priya@srtm.local')
  await user.type(screen.getByLabelText('Name'), 'Priya')
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add person' }))
  expect(await screen.findByText(/Temporary password for Priya/)).toBeInTheDocument()
  expect(screen.getByLabelText('Temporary password')).toHaveTextContent(/^temp-/)
  await user.click(screen.getByRole('button', { name: 'Done' }))
  expect(await within(people).findByText('priya@srtm.local')).toBeInTheDocument()

  // The same email again is refused with a clear message.
  await user.click(screen.getByRole('button', { name: /Add person/ }))
  await user.type(await screen.findByLabelText('Work email'), 'priya@srtm.local')
  await user.type(screen.getByLabelText('Name'), 'Priya again')
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add person' }))
  expect(await screen.findByText(/already has an account/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  const viewerRow = within(people).getByText('viewer@srtm.local').closest('tr') as HTMLElement
  await user.click(within(viewerRow).getByRole('button', { name: 'Deactivate' }))
  await user.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: 'Deactivate' }),
  )
  expect(await within(viewerRow).findByText('Deactivated')).toBeInTheDocument()
  await user.click(within(viewerRow).getByRole('button', { name: /Reset password/ }))
  await user.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reset password' }),
  )
  expect(await screen.findByText(/Temporary password for Viewer/)).toBeInTheDocument()
})

test('the Health tab shows how often managers agree with the model', async () => {
  asAdmin()
  const user = userEvent.setup()
  renderRoute('/admin')
  await user.click(await screen.findByRole('tab', { name: 'Health' }))
  expect(await screen.findByText('Managers agree with the model')).toBeInTheDocument()
  expect(screen.getByText('78%')).toBeInTheDocument()
  expect(screen.getByText('36 of 46 decisions')).toBeInTheDocument()
  const weeks = screen.getByRole('region', { name: 'Week by week' })
  expect(within(weeks).getAllByRole('listitem')).toHaveLength(3)
  expect(within(weeks).getByText('—', { exact: false })).toBeInTheDocument() // 6 decisions: no rate
  const byModel = screen.getByRole('region', { name: 'By model' })
  expect(within(byModel).getByText('Skill gap')).toBeInTheDocument()
})

test('the Health tab explains when there are no decisions yet', async () => {
  asAdmin()
  server.use(
    http.get('*/api/v1/admin/health', () =>
      HttpResponse.json({
        overall: { decisions: 0, agreed: 0, rate: null },
        shortlist_override_rate: null,
        by_band: [],
        weeks: [],
        models: [],
        reject_reasons: {},
        planning_rejections: 0,
        min_decisions: 10,
      }),
    ),
  )
  const user = userEvent.setup()
  renderRoute('/admin')
  await user.click(await screen.findByRole('tab', { name: 'Health' }))
  expect(await screen.findByText('No manager decisions yet')).toBeInTheDocument()
})

test('HR adds a client and deactivates it; the Clients page is for admins and HR only', async () => {
  server.use(
    http.get('*/api/v1/auth/me', () =>
      HttpResponse.json({
        id: 'h1',
        email: 'hr@srtm.local',
        display_name: 'HR Partner',
        role: 'hr',
        must_change_password: false,
      }),
    ),
  )
  const user = userEvent.setup()
  renderRoute('/clients')
  expect(await screen.findByRole('heading', { name: 'Clients' })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /Company/ }).length).toBeGreaterThan(0)
  expect(screen.queryByRole('link', { name: /New task/ })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Add client/ }))
  await user.type(await screen.findByLabelText(/^Code/), 'cl-newco')
  await user.type(screen.getByLabelText(/^Name/), 'NewCo Insurance')
  await user.type(screen.getByLabelText('Timezone'), 'Asia/Kolkata')
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add client' }))
  const list = await screen.findByRole('table', { name: 'Clients' })
  const row = (await within(list).findByText(/NewCo Insurance/)).closest('tr') as HTMLElement
  expect(within(row).getByText(/CL-NEWCO/)).toBeInTheDocument() // code upper-cased

  await user.click(within(row).getByRole('button', { name: /Edit/ }))
  await user.click(await screen.findByLabelText(/Active/))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await within(row).findByText('Inactive')).toBeInTheDocument()
})

test('a resource manager is sent away from the Clients page', async () => {
  const { router } = renderRoute('/clients')
  await screen.findByRole('heading', { name: /^Tasks$/ })
  expect(router.state.location.pathname).toBe('/tasks')
})

test('the weekly feedback report shows themes an admin accepts or dismisses', async () => {
  asAdmin()
  const user = userEvent.setup()
  renderRoute('/admin')
  await user.click(await screen.findByRole('tab', { name: 'Learning' }))
  const report = await screen.findByRole('region', { name: 'What people are telling us' })
  const theme = await within(report).findByRole('listitem', {
    name: 'Resume skill levels look too high',
  })
  expect(within(theme).getByText(/Give skills mentioned only once level 2/)).toBeInTheDocument()
  await user.click(within(theme).getByRole('button', { name: 'Accept' }))
  expect(await within(theme).findByText('Accepted: to do')).toBeInTheDocument()
  await user.click(within(report).getByRole('button', { name: /Make this week/ }))
  expect(await screen.findByText(/to ChatGPT once/)).toBeInTheDocument()
})

test('an admin adds a decision API project, sees its key once, and can revoke it', async () => {
  asAdmin()
  const user = userEvent.setup()
  renderRoute('/admin')
  await user.click(await screen.findByRole('tab', { name: 'Decision API' }))
  await user.click(await screen.findByRole('button', { name: /Add a project/ }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText('Name'), 'agent-loop')
  await user.click(within(dialog).getByRole('button', { name: 'Add project' }))
  const project = await screen.findByRole('region', { name: 'Project agent-loop' })
  await user.click(within(project).getByRole('button', { name: /New key/ }))
  const shown = await screen.findByRole('dialog', { name: /Copy the key now/ })
  expect(within(shown).getByText(/^jev_/)).toBeInTheDocument()
  await user.click(within(shown).getByRole('button', { name: 'Done' }))
  await user.click(await within(project).findByRole('button', { name: 'Revoke' }))
  expect(await within(project).findByText('No active key.')).toBeInTheDocument()
})

test('an accepted suggestion can be marked done', async () => {
  asAdmin()
  const user = userEvent.setup()
  renderRoute('/admin')
  await user.click(await screen.findByRole('tab', { name: 'Learning' }))
  const theme = await screen.findByRole('listitem', { name: 'Candidates from HR are hard to find' })
  await user.click(within(theme).getByRole('button', { name: 'Accept' }))
  await user.click(await within(theme).findByRole('button', { name: 'Mark as done' }))
  expect(await within(theme).findByText('Done')).toBeInTheDocument()
})

test('the Runs tab lists recent runs with a link to each', async () => {
  asAdmin()
  renderRoute('/admin')
  const table = await screen.findByRole('table')
  const links = await within(table).findAllByRole('link')
  expect(links.length).toBeGreaterThan(0)
  expect(links[0]).toHaveAttribute('href', expect.stringMatching(/^\/runs\//))
})

test('the Test reports tab explains how to get a first report', async () => {
  asAdmin()
  renderRoute('/admin?tab=eval')
  expect(await screen.findByText('No test reports yet')).toBeInTheDocument()
})

test('a test report opens with the model against the simple ranking', async () => {
  asAdmin()
  const report = {
    id: 'r1',
    name: 'eval-40',
    created_at: '2026-10-07T10:00:00Z',
    dataset_seed: 7,
    decision_set_version: 'v1',
    model: 'student-v3-mini',
    tasks: 40,
    retrieval_recall: 0.98,
    model_hit5: 0.94,
    baseline_hit5: 0.72,
    model_hit1: 0.74,
    baseline_hit1: 0.43,
    ece: 0.23,
  }
  server.use(
    http.get('*/api/v1/eval/reports', () =>
      HttpResponse.json({ items: [report], total: 1, limit: 50, offset: 0 }),
    ),
    http.get('*/api/v1/eval/reports/r1', () => HttpResponse.json({ ...report, metrics: {} })),
  )
  renderRoute('/admin?tab=eval&report=r1')
  expect(await screen.findByText('Test report: student-v3-mini')).toBeInTheDocument()
  expect(await screen.findByText('94% (simple ranking 72%)')).toBeInTheDocument()
  expect(screen.getByText('74% (simple ranking 43%)')).toBeInTheDocument()
})

test("the operator's admin adds a company and sees its first admin's password once", async () => {
  asAdmin()
  const user = userEvent.setup()
  renderRoute('/admin?tab=companies')
  const table = await screen.findByRole('table', { name: 'Companies' })
  expect(within(table).getByText('Sparity')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Add company' }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText('Company name'), 'Acme Corp')
  expect(within(dialog).getByLabelText('Short id')).toHaveValue('acme-corp')
  await user.type(within(dialog).getByLabelText("First admin's name"), 'Asha Rao')
  await user.type(within(dialog).getByLabelText("First admin's work email"), 'Asha@Acme.com')
  await user.click(within(dialog).getByRole('button', { name: 'Add company' }))

  expect(await screen.findByText('Acme Corp is ready')).toBeInTheDocument()
  expect(screen.getByLabelText('Temporary password')).not.toBeEmptyDOMElement()
  expect(screen.getByText(/asha@acme\.com/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Done' }))
  expect(await within(table).findByText('Acme Corp')).toBeInTheDocument()
})

test("another company's admin does not see the Companies tab", async () => {
  asAdmin()
  server.use(
    http.get('*/api/v1/admin/companies', () =>
      HttpResponse.json(
        { title: 'Forbidden', status: 403, code: 'forbidden', detail: 'Operator only' },
        { status: 403 },
      ),
    ),
  )
  renderRoute('/admin?tab=companies')
  expect(await screen.findByRole('tab', { name: 'Runs' })).toHaveAttribute('data-state', 'active')
  expect(screen.queryByRole('tab', { name: 'Companies' })).not.toBeInTheDocument()
})
