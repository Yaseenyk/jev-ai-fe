import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import hrJson from '@/mocks/data/hr.json'
import { renderRoute, signInAs } from '@/test/render'

const hr = hrJson as unknown as {
  employees: { id: string; full_name: string }[]
  candidates: { id: string; full_name: string; status: string; email: string | null }[]
}
const employee = hr.employees[0]
const newCandidate = hr.candidates.find((c) => c.status === 'new')
if (!employee || !newCandidate) throw new Error('hr.json is missing an employee or a new candidate')

beforeEach(() => signInAs('hr@srtm.local'))
afterAll(() => signInAs('manager1@srtm.local'))

test('a manager cannot open the HR screens and sees no HR links', async () => {
  await signInAs('manager1@srtm.local')
  for (const path of ['/candidates', '/employees', '/import', '/hr']) {
    const { router, unmount } = renderRoute(path)
    await screen.findByRole('heading', { name: /^Tasks$/ })
    expect(router.state.location.pathname).toBe('/tasks')
    unmount()
  }
  renderRoute('/tasks')
  await screen.findByRole('heading', { name: /^Tasks$/ })
  expect(screen.queryByRole('link', { name: 'Candidates' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Company' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Requests' }).length).toBeGreaterThan(0)
})

test('HR lands on the HR home with the requests waiting on them', async () => {
  const { router } = renderRoute('/')
  expect(await screen.findByRole('heading', { name: 'HR home' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/hr')
  const requests = await screen.findByRole('region', { name: 'Needs your attention' })
  expect(await within(requests).findByText(/TSK-0020/)).toBeInTheDocument()
  expect(within(requests).getByText(/TSK-0011/)).toBeInTheDocument()
  // TSK-0013 waits on the manager, not on HR.
  expect(within(requests).queryByText(/TSK-0013/)).not.toBeInTheDocument()
})

test('uploading a resume shows what was removed and needs consent before saving', async () => {
  const user = userEvent.setup()
  const { router } = renderRoute('/candidates/new')
  const read = await screen.findByRole('button', { name: /Read the resume/ })
  expect(read).toBeDisabled()
  await user.upload(
    screen.getByLabelText('Resume file'),
    new File(['resume'], 'priya-cv.pdf', { type: 'application/pdf' }),
  )
  await user.click(read)

  const removed = await screen.findByRole('alert')
  expect(within(removed).getByText('Removed before ChatGPT')).toBeInTheDocument()
  for (const item of ['name', 'email address', 'phone number', 'date of birth']) {
    expect(within(removed).getByText(item)).toBeInTheDocument()
  }

  const save = screen.getByRole('button', { name: 'Save candidate' })
  expect(save).toBeDisabled()
  await user.clear(screen.getByLabelText(/^Full name/))
  await user.type(screen.getByLabelText(/^Full name/), 'Priya Test')
  await user.click(screen.getByRole('checkbox', { name: /candidate agreed/ }))
  await user.click(save)

  expect(await screen.findByRole('heading', { name: 'Priya Test' })).toBeInTheDocument()
  expect(router.state.location.pathname).toMatch(/^\/candidates\/cand-/)
})

test('a non-resume file is refused with a clear message', async () => {
  const user = userEvent.setup({ applyAccept: false })
  renderRoute('/candidates/new')
  await user.upload(
    await screen.findByLabelText('Resume file'),
    new File(['x'], 'photo.png', { type: 'image/png' }),
  )
  await user.click(screen.getByRole('button', { name: /Read the resume/ }))
  expect(await screen.findByText(/Upload a PDF or Word resume/)).toBeInTheDocument()
})

test('HR moves a candidate along with a note and can delete them', async () => {
  const user = userEvent.setup()
  const { router } = renderRoute(`/candidates/${newCandidate.id}`)
  expect(await screen.findByRole('heading', { name: newCandidate.full_name })).toBeInTheDocument()
  if (newCandidate.email) expect(screen.getByText(newCandidate.email)).toBeInTheDocument()

  const steps = screen.getByRole('list', { name: 'Status' })
  await user.click(within(steps).getByRole('button', { name: 'Contacted' }))
  await user.type(await screen.findByLabelText('Note'), 'Called, interested')
  await user.click(screen.getByRole('button', { name: 'Move to Contacted' }))
  await waitFor(() =>
    expect(within(steps).getByRole('button', { name: 'Contacted' })).toBeDisabled(),
  )
  expect(await screen.findByText('Called, interested')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Delete/ }))
  await user.click(await screen.findByRole('button', { name: 'Delete for good' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/candidates'))
  expect(screen.queryByText(newCandidate.full_name)).not.toBeInTheDocument()
})

test('HR adds and removes leave for an employee', async () => {
  const user = userEvent.setup()
  renderRoute(`/employees/${employee.id}`)
  expect(await screen.findByRole('heading', { name: employee.full_name })).toBeInTheDocument()
  const leave = screen.getByRole('region', { name: 'Leave' })
  expect(within(leave).getByText('No leave planned.')).toBeInTheDocument()

  await user.click(within(leave).getByRole('button', { name: /Add/ }))
  const add = await screen.findByRole('button', { name: 'Add leave' })
  expect(add).toBeDisabled()
  await user.type(screen.getByLabelText('From'), '2026-11-02')
  await user.type(screen.getByLabelText('To'), '2026-11-06')
  await user.click(add)

  const remove = await within(leave).findByRole('button', { name: /Remove leave from/ })
  await user.click(remove)
  expect(await within(leave).findByText('No leave planned.')).toBeInTheDocument()
})

test('an import is checked row by row and only valid rows are saved', async () => {
  const user = userEvent.setup()
  renderRoute('/import')
  const csv = [
    'employee_code,skill,proficiency,years,last_used',
    'SPY-00001,Python,4,3,2026-09-01',
    'SPY-99999,Python,4,3,2026-09-01',
  ].join('\n')
  await user.upload(
    await screen.findByLabelText('CSV file'),
    new File([csv], 'skills.csv', { type: 'text/csv' }),
  )
  await user.click(screen.getByRole('button', { name: /Check the file/ }))

  const rows = await screen.findByRole('region', { name: 'Rows' })
  expect(within(rows).getByText(/1 ready, 1 with problems/)).toBeInTheDocument()
  expect(within(rows).getByText('no employee SPY-99999')).toBeInTheDocument()
  await user.click(within(rows).getByRole('button', { name: 'Save 1 valid row' }))
  expect(await screen.findByText(/0 added, 1 updated, 1 skipped/)).toBeInTheDocument()
})

test('an import with missing columns is refused before any row is checked', async () => {
  const user = userEvent.setup()
  renderRoute('/import')
  await user.upload(
    await screen.findByLabelText('CSV file'),
    new File(['employee_code,skill\nSPY-00001,Python'], 'bad.csv', { type: 'text/csv' }),
  )
  await user.click(screen.getByRole('button', { name: /Check the file/ }))
  expect(
    await screen.findByText(/Missing columns: proficiency, years, last_used/),
  ).toBeInTheDocument()
})

test('notifications show unread hand-offs and can all be marked read', async () => {
  const user = userEvent.setup()
  renderRoute('/hr')
  await user.click(await screen.findByRole('button', { name: /Notifications, \d+ unread/ }))
  const list = await screen.findByRole('list', { name: 'Notifications' })
  expect(within(list).getByText(/New request for TSK-0020/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Mark all as read' }))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument(),
  )
})

test('HR adds an employee and lands on their page; a taken code is refused', async () => {
  const user = userEvent.setup()
  const { router } = renderRoute('/employees')
  await user.click(await screen.findByRole('button', { name: /Add employee/ }))
  const dialog = await screen.findByRole('dialog')
  const save = within(dialog).getByRole('button', { name: 'Add employee' })
  expect(save).toBeDisabled()
  await user.type(within(dialog).getByLabelText(/^Employee code/), 'spy-09200')
  await user.type(within(dialog).getByLabelText(/^Full name/), 'Neha Joshi')
  await user.type(within(dialog).getByLabelText(/^Role/), 'React Developer')
  await user.click(save)
  expect(await screen.findByRole('heading', { name: 'Neha Joshi' })).toBeInTheDocument()
  expect(router.state.location.pathname).toMatch(/^\/employees\//)

  await user.click(screen.getAllByRole('link', { name: 'Company' })[0] as HTMLElement)
  await user.click(await screen.findByRole('button', { name: /Add employee/ }))
  const again = await screen.findByRole('dialog')
  await user.type(within(again).getByLabelText(/^Employee code/), 'SPY-09200')
  await user.type(within(again).getByLabelText(/^Full name/), 'Someone Else')
  await user.type(within(again).getByLabelText(/^Role/), 'Tester')
  await user.click(within(again).getByRole('button', { name: 'Add employee' }))
  expect(await within(again).findByText(/already exists/)).toBeInTheDocument()
})

test('HR records the expected pay band on a candidate', async () => {
  const user = userEvent.setup()
  const anyone = hr.candidates[1]
  if (!anyone) throw new Error('hr.json has too few candidates')
  renderRoute(`/candidates/${anyone.id}`)
  const band = await screen.findByRole('combobox', { name: 'Expected pay band' })
  expect(band).toHaveTextContent('Not known yet')
  await user.click(band)
  await user.click(await screen.findByRole('option', { name: 'Band C' }))
  await waitFor(() => expect(band).toHaveTextContent('Band C'))
})

test('a scanned resume is sent to ChatGPT only after HR agrees', async () => {
  const user = userEvent.setup()
  renderRoute('/candidates/new')
  await user.upload(
    await screen.findByLabelText('Resume file'),
    new File(['scan'], 'scan-cv.pdf', { type: 'application/pdf' }),
  )
  await user.click(screen.getByRole('button', { name: /Read the resume/ }))
  expect(await screen.findByText('This is a scanned file')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save candidate' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Send the scanned pages to ChatGPT' }))
  expect(
    await screen.findByText(/page images, including personal details, were sent to ChatGPT/),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save candidate' })).toBeInTheDocument()
})

test('HR uploads an employee resume and accepts a skill it shows', async () => {
  const user = userEvent.setup()
  await signInAs('hr@srtm.local')
  renderRoute(`/employees/${employee.id}`)
  const section = await screen.findByRole('region', { name: 'Resume' })
  expect(await within(section).findByText(/No resume yet/)).toBeInTheDocument()
  await user.upload(
    within(section).getByLabelText('Resume file'),
    new File(['resume'], 'cv.pdf', { type: 'application/pdf' }),
  )
  const found = await within(section).findByRole('list', { name: 'Skills found in the resume' })
  const accept = within(found).getAllByRole('button', { name: 'Accept as skill' })
  const row = accept[0]?.closest('li')
  const skill = row?.querySelector('.font-medium')?.textContent ?? ''
  await user.click(accept[0] as HTMLElement)
  expect(await within(found).findAllByText('Added to the profile')).not.toHaveLength(0)
  const skills = await screen.findByRole('table', { name: 'Skills' })
  expect(within(skills).getByText(skill)).toBeInTheDocument()
})

test("a company's own skill name is mapped once and the rows are checked again", async () => {
  const user = userEvent.setup()
  renderRoute('/import')
  const csv = [
    'employee_code,skill,proficiency,years,last_used',
    'SPY-00001,PyLang,4,3,2026-09-01',
  ].join('\n')
  await user.upload(
    await screen.findByLabelText('CSV file'),
    new File([csv], 'skills.csv', { type: 'text/csv' }),
  )
  await user.click(screen.getByRole('button', { name: /Check the file/ }))
  const map = await screen.findByRole('region', { name: "Values we don't recognise" })
  expect(within(map).getByText('“PyLang”')).toBeInTheDocument()
  await user.click(within(map).getByRole('combobox', { name: 'Meaning of PyLang' }))
  await user.click(await screen.findByRole('option', { name: 'Python' }))
  await user.click(within(map).getByRole('button', { name: /Save 1 and check the rows again/ }))
  const rows = await screen.findByRole('region', { name: 'Rows' })
  expect(await within(rows).findByText(/1 ready, 0 with problems/)).toBeInTheDocument()
  expect(
    screen.queryByRole('region', { name: "Values we don't recognise" }),
  ).not.toBeInTheDocument()
})

test('the Company page lists employees and switches to clients', async () => {
  const user = userEvent.setup()
  const { router } = renderRoute('/company')
  expect(await screen.findByRole('heading', { name: 'Company' })).toBeInTheDocument()
  expect(await screen.findByText(employee.full_name)).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: 'Clients' }))
  expect(router.state.location.search).toContain('tab=clients')
})
