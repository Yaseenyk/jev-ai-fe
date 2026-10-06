import '@/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import { Providers } from '@/app/providers'
import { router } from '@/app/router'
import { env } from '@/lib/env'

async function start() {
  if (env.VITE_USE_MOCKS) {
    const { worker } = await import('@/mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  } else {
    const { createHrOverlayWorker } = await import('@/mocks/browser')
    await createHrOverlayWorker().start({ onUnhandledRequest: 'bypass', quiet: true })
  }
  const root = document.getElementById('root')
  if (!root) throw new Error('Missing #root element')
  createRoot(root).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  )
}

void start()
