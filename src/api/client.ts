import type { Problem } from '@/api/types'
import { env } from '@/lib/env'

export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem | null

  constructor(status: number, problem: Problem | null) {
    super(problem?.detail ?? `Request failed with status ${status}`)
    this.status = status
    this.problem = problem
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  const res = await fetch(new URL(`${env.VITE_API_BASE_URL}${path}`, window.location.origin), {
    ...init,
    headers,
  })
  if (!res.ok) {
    const isProblem = res.headers.get('content-type')?.includes('json') ?? false
    throw new ApiError(res.status, isProblem ? ((await res.json()) as Problem) : null)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
