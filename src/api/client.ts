import type { Problem } from '@/api/types'
import { getAccessToken, refreshAccessToken, signedOut } from '@/features/auth/session'
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

async function send(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(new URL(`${env.VITE_API_BASE_URL}${path}`, window.location.origin), {
    ...init,
    headers,
    credentials: 'include',
  })
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await send(path, init)
  // An expired access token is renewed once from the refresh cookie, then the call is retried.
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshAccessToken()) res = await send(path, init)
    if (res.status === 401) signedOut()
  }
  if (!res.ok) {
    const isProblem = res.headers.get('content-type')?.includes('json') ?? false
    throw new ApiError(res.status, isProblem ? ((await res.json()) as Problem) : null)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
