import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { setupServer } from 'msw/node'

import { createDb } from '@/mocks/db'
import { createHandlers } from '@/mocks/handlers'

// Coverage instrumentation slows rendering; give the UI longer to appear only in that run.
const runningScript = (globalThis as { process?: { env: Record<string, string | undefined> } })
  .process?.env.npm_lifecycle_event
if (runningScript === 'test:coverage') configure({ asyncUtilTimeout: 5000 })

export const server = setupServer(...createHandlers(createDb()))

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  localStorage.clear()
})
afterAll(() => server.close())

// jsdom lacks these browser APIs; Radix (Select, Tooltip) calls them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub
Element.prototype.scrollIntoView = () => {}
Element.prototype.scrollTo = () => {}
Element.prototype.hasPointerCapture = () => false
Element.prototype.releasePointerCapture = () => {}
