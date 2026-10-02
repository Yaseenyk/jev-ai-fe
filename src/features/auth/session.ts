import type { TokenResponse } from '@/api/types'
import { env } from '@/lib/env'

// The access token lives in memory only; the refresh token is an httpOnly cookie the browser
// sends to /auth/refresh. A page reload restores the session through that cookie.
let accessToken: string | null = null
let refreshing: Promise<boolean> | null = null

export const SIGNED_OUT_EVENT = 'srtm:signed-out'

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function signedOut() {
  accessToken = null
  window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
}

/** One refresh at a time, shared by every request that hit an expired token. */
export function refreshAccessToken(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(new URL(`${env.VITE_API_BASE_URL}/auth/refresh`, location.origin), {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) return false
      accessToken = ((await res.json()) as TokenResponse).access_token
      return true
    } catch {
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}
