import { bypass, http, passthrough } from 'msw'
import { setupWorker } from 'msw/browser'

import { createDb } from '@/mocks/db'
import { createHandlers } from '@/mocks/handlers'
import { createHrHandlers } from '@/mocks/hr'

export const worker = setupWorker(...createHandlers(createDb(), sessionStorage))

/**
 * Real-API mode: the backend has no HR, candidate or hiring-request endpoints yet (ADR 020), so
 * only those are answered here with demo data; everything else goes to the real API. The signed-in
 * user is read from the real /auth/me as it passes through.
 */
export function createHrOverlayWorker() {
  let user = { email: '', role: '' }
  return setupWorker(
    http.get('*/api/v1/auth/me', async ({ request }) => {
      const response = await fetch(bypass(request))
      if (response.ok) user = (await response.clone().json()) as typeof user
      return response
    }),
    // Resumes are read by the real backend (code + LLM, docs/08 §1a).
    http.post('*/api/v1/candidates/extract', () => passthrough()),
    ...createHrHandlers(createDb(), () => user),
  )
}
