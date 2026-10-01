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
