import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'

import { server } from '@/test/setup'
import { renderRoute } from '@/test/render'

const signedOut = () =>
  server.use(
    http.post('*/api/v1/auth/refresh', () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Unauthorized', status: 401, code: 'not_authenticated' },
        { status: 401 },
      ),
    ),
  )

test('signed-out visitors are sent to sign in, then back to where they were going', async () => {
  signedOut()
  const user = userEvent.setup()
  const { router } = renderRoute('/tasks/new')

  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  expect(router.state.location.search).toContain('next=%2Ftasks%2Fnew')

  await user.type(screen.getByLabelText('Work email'), 'manager1@srtm.local')
  await user.type(screen.getByLabelText('Password'), 'anything')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('heading', { name: 'New task' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/tasks/new')
})

test('a wrong password is explained', async () => {
  signedOut()
  server.use(
    http.post('*/api/v1/auth/login', () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Unauthorized', status: 401, code: 'bad_credentials' },
        { status: 401 },
      ),
    ),
  )
  const user = userEvent.setup()
  renderRoute('/tasks')
  await user.type(await screen.findByLabelText('Work email'), 'manager1@srtm.local')
  await user.type(screen.getByLabelText('Password'), 'nope')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/)
})

test('a sign-in lockout is explained, not blamed on the connection', async () => {
  signedOut()
  server.use(
    http.post('*/api/v1/auth/login', () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Rate limited', status: 429, code: 'rate_limited' },
        { status: 429 },
      ),
    ),
  )
  const user = userEvent.setup()
  renderRoute('/tasks')
  await user.type(await screen.findByLabelText('Work email'), 'manager1@srtm.local')
  await user.type(screen.getByLabelText('Password'), 'nope')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/Too many failed sign-ins/)
})

test('viewers can look but not create tasks or run matching', async () => {
  server.use(
    http.get('*/api/v1/auth/me', () =>
      HttpResponse.json({
        id: 'v1',
        email: 'viewer@srtm.local',
        display_name: 'Viewer',
        role: 'viewer',
      }),
    ),
  )
  renderRoute('/tasks')
  expect(await screen.findByRole('heading', { name: /^Tasks$/ })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /New task/ })).not.toBeInTheDocument()

  const user = userEvent.setup()
  const [first] = await screen.findAllByRole('link', { name: /TSK-/ })
  await user.click(first as HTMLElement)
  expect(await screen.findByText(/Skills/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /run matching/i })).not.toBeInTheDocument()
})

test('the form checks the email and password before sending, and the eye shows the password', async () => {
  signedOut()
  const user = userEvent.setup()
  renderRoute('/tasks')
  const email = await screen.findByLabelText('Work email')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByText('Enter your work email')).toBeInTheDocument()
  expect(screen.getByText('Enter your password')).toBeInTheDocument()

  await user.type(email, 'not-an-email')
  await user.tab()
  expect(await screen.findByText(/Enter a valid email/)).toBeInTheDocument()
  expect(email).toHaveAttribute('aria-invalid', 'true')

  const password = screen.getByLabelText('Password')
  await user.type(password, 'secret')
  expect(password).toHaveAttribute('type', 'password')
  await user.click(screen.getByRole('button', { name: 'Show password' }))
  expect(password).toHaveAttribute('type', 'text')

  await user.click(screen.getByRole('button', { name: /Viewer/ }))
  expect(email).toHaveValue('viewer@srtm.local')
  expect(screen.queryByText(/Enter a valid email/)).not.toBeInTheDocument()
})
