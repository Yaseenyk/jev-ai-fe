import { http, passthrough } from 'msw'
import { setupWorker } from 'msw/browser'

import { createDb } from '@/mocks/db'
import { createHandlers } from '@/mocks/handlers'
import { createHrHandlers } from '@/mocks/hr'

export const worker = setupWorker(...createHandlers(createDb(), sessionStorage))

// Built in the backend (ADR 020): candidates, hiring requests, notifications, HR summary.
const BUILT =
  /\/api\/v1\/(candidates|hiring-requests|notifications|hr\/summary|tasks\/[^/]+\/(candidates|hiring-requests))/

/**
 * Real-API mode: the backend has no employee-editing or CSV-import endpoints yet, so only those are
 * answered here with demo data (reset on reload); everything else goes to the real API.
 */
export function createHrOverlayWorker() {
  return setupWorker(
    http.all(BUILT, () => passthrough()),
    ...createHrHandlers(createDb(), () => ({ email: '', role: '' })),
  )
}
