import { setupWorker } from 'msw/browser'

import { createDb } from '@/mocks/db'
import { createHandlers } from '@/mocks/handlers'

export const worker = setupWorker(...createHandlers(createDb()))
