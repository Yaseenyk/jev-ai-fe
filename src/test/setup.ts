import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { setupServer } from 'msw/node'

import { createDb } from '@/mocks/db'
import { createHandlers } from '@/mocks/handlers'

// Whole-app pages can take over a second to appear on a busy machine (or under coverage).
configure({ asyncUtilTimeout: 5000 })

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

// Node's fetch only sends and parses its own FormData/File/Blob; Vitest's jsdom bridge drops file
// names. Vitest defines these globals as accessors, so plain assignment would be ignored.
// The app's tsconfig has no Node types, hence the untyped import.
const nodeBuffer = 'node:buffer'
const { Blob: NodeBlob, File: NodeFile } = (await import(/* @vite-ignore */ nodeBuffer)) as {
  Blob: typeof Blob
  File: typeof File
}
const NodeFormData = (await new Response(new URLSearchParams()).formData()).constructor
for (const [name, value] of [
  ['File', NodeFile],
  ['Blob', NodeBlob],
  ['FormData', NodeFormData],
] as const) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
}
