import { Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'

import { env } from '@/lib/env'
import { cn } from '@/lib/utils'

export function Layout() {
  return (
    <div className="bg-background min-h-svh">
      <header className="bg-card border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <NavLink to="/tasks" className="flex items-center gap-2 font-semibold whitespace-nowrap">
            <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md">
              <Users className="size-4" aria-hidden />
            </span>
            Resource Matching
          </NavLink>
          <nav aria-label="Main">
            <NavLink
              to="/tasks"
              className={({ isActive }) =>
                cn(
                  'text-muted-foreground hover:text-foreground text-sm',
                  isActive && 'text-foreground font-medium',
                )
              }
            >
              Tasks
            </NavLink>
          </nav>
          <span className="text-muted-foreground ml-auto hidden text-xs sm:inline">
            Signed in as Resource manager
          </span>
        </div>
      </header>
      {env.VITE_USE_MOCKS && (
        <div className="bg-muted text-muted-foreground border-b px-4 py-1.5 text-center text-xs">
          Demo mode: synthetic employees and tasks. Decisions come from a recorded test run, not
          live data.
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
