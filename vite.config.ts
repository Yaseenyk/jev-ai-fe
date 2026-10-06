import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // `npm run dev:api` talks to the real backend for everything. In mock mode (`npm run dev`)
    // MSW answers in the browser first; only free-text intake reaches the backend.
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Page-level tests render the whole app; the default 5 s is too tight when files run in parallel.
    testTimeout: 15_000,
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // npm run test:coverage — floor from docs/07: feature code >= 70% of lines
    coverage: {
      provider: 'v8',
      include: ['src/features/**'],
      exclude: ['**/*.test.*'],
      reporter: ['text-summary', 'json-summary'],
      thresholds: { lines: 70 },
    },
  },
})
