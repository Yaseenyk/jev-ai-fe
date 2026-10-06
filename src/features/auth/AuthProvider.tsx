import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router'

import { apiFetch } from '@/api/client'
import type { TokenResponse, User } from '@/api/types'
import { SIGNED_OUT_EVENT, refreshAccessToken, setAccessToken } from '@/features/auth/session'

type Status = 'loading' | 'signedIn' | 'signedOut'

interface AuthState {
  status: Status
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (current: string, next: string) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<User | null>(null)

  const signOutLocally = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setStatus('signedOut')
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    const abort = new AbortController()
    const done = () => abort.signal.aborted
    void (async () => {
      const restored = await refreshAccessToken()
      if (done()) return
      if (!restored) {
        setStatus('signedOut')
        return
      }
      try {
        const me = await apiFetch<User>('/auth/me')
        if (done()) return
        setUser(me)
        setStatus('signedIn')
      } catch {
        if (!done()) setStatus('signedOut')
      }
    })()
    window.addEventListener(SIGNED_OUT_EVENT, signOutLocally)
    return () => {
      abort.abort()
      window.removeEventListener(SIGNED_OUT_EVENT, signOutLocally)
    }
  }, [signOutLocally])

  const login = async (email: string, password: string) => {
    const tokens = await apiFetch<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setAccessToken(tokens.access_token)
    setUser(await apiFetch<User>('/auth/me'))
    setStatus('signedIn')
  }

  const changePassword = async (current: string, next: string) => {
    const tokens = await apiFetch<TokenResponse>('/auth/password', {
      method: 'POST',
      body: JSON.stringify({ current_password: current, new_password: next }),
    })
    setAccessToken(tokens.access_token)
    setUser(await apiFetch<User>('/auth/me'))
  }

  const logout = async () => {
    try {
      await apiFetch<undefined>('/auth/logout', { method: 'POST' })
    } finally {
      signOutLocally()
    }
  }

  return (
    <AuthContext.Provider value={{ status, user, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Admins and resource managers can create tasks, run matching and give feedback. */
export function useCanEdit(): boolean {
  const role = useAuth().user?.role
  return role === 'admin' || role === 'resource_manager'
}

/** Admins and HR maintain clients, employees and candidates (ADR 019). */
export function useManagesPeople(): boolean {
  const role = useAuth().user?.role
  return role === 'admin' || role === 'hr'
}

export const CHANGE_PASSWORD_PATH = '/account/password'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'loading') {
    return (
      <div className="grid min-h-svh place-items-center" role="status">
        <Loader2 className="text-primary size-6 animate-spin" aria-label="Loading" />
      </div>
    )
  }
  if (status === 'signedOut') {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  if (user?.must_change_password && location.pathname !== CHANGE_PASSWORD_PATH) {
    // A temporary password from an admin: the server refuses everything else until it is replaced.
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />
  }
  return children
}
