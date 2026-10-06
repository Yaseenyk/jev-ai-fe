import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'

import { Providers, createQueryClient } from '@/app/providers'
import { routes } from '@/app/router'

export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  return {
    router,
    ...render(
      <Providers client={client}>
        <RouterProvider router={router} />
      </Providers>,
    ),
  }
}

/** Switches the mock API's signed-in account (e.g. 'hr@srtm.local'); render again afterwards. */
export async function signInAs(email: string) {
  await fetch('http://localhost/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'x' }),
  })
}
