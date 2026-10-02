import { Info, LayoutList, Plus, Users } from 'lucide-react'
import type { ComponentType } from 'react'
import { Link, Outlet, useLocation } from 'react-router'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  isActive: (path: string) => boolean
}

const NAV: NavItem[] = [
  {
    to: '/tasks',
    label: 'Tasks',
    icon: LayoutList,
    isActive: (p) => (p.startsWith('/tasks') && p !== '/tasks/new') || p.startsWith('/runs'),
  },
  { to: '/tasks/new', label: 'New task', icon: Plus, isActive: (p) => p === '/tasks/new' },
]

const DEMO_NOTE =
  'Demo data: employees and tasks are synthetic. Results come from a recorded test run, not live data.'

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/tasks"
      className="flex items-center gap-2.5 rounded-lg"
      aria-label="Resource Matching home"
    >
      <span className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-xl">
        <Users className="size-[18px]" aria-hidden />
      </span>
      {!compact && (
        <span className="font-heading text-[17px] leading-tight font-semibold">
          Resource
          <br />
          Matching
        </span>
      )}
    </Link>
  )
}

export function Layout() {
  const { pathname } = useLocation()

  return (
    <div className="bg-background min-h-svh">
      {/* Desktop sidebar (lg+) and tablet icon rail (md) */}
      <aside className="bg-surface fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col border-r px-3 py-5 md:flex lg:w-60 lg:px-4">
        <div className="px-1.5 lg:px-2">
          <span className="hidden lg:block">
            <Brand />
          </span>
          <span className="lg:hidden">
            <Brand compact />
          </span>
        </div>

        <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => {
            const active = item.isActive(pathname)
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-11 items-center justify-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors lg:justify-start',
                      active
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span className="sr-only lg:not-sr-only">{item.label}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="lg:hidden">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        <div className="mt-auto space-y-3">
          {env.VITE_USE_MOCKS && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground bg-muted flex h-8 w-full items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs lg:justify-start"
                >
                  <Info className="size-3.5 shrink-0" aria-hidden />
                  <span className="sr-only lg:not-sr-only">Demo data</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-60">
                {DEMO_NOTE}
              </TooltipContent>
            </Tooltip>
          )}
          <div className="flex items-center justify-center gap-2.5 lg:justify-start lg:px-1">
            <span className="bg-secondary text-secondary-foreground grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold">
              RM
            </span>
            <span className="hidden min-w-0 lg:block">
              <span className="block truncate text-sm font-medium">Resource manager</span>
              <span className="text-muted-foreground block text-xs">Sparity</span>
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="bg-surface/90 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur md:hidden">
        <Brand compact />
        {env.VITE_USE_MOCKS && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground bg-muted flex h-8 items-center gap-1.5 rounded-full px-3 text-xs"
              >
                <Info className="size-3.5" aria-hidden /> Demo data
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-60">{DEMO_NOTE}</TooltipContent>
          </Tooltip>
        )}
      </header>

      <main className="px-4 pt-6 pb-28 sm:px-6 md:pt-8 md:pb-12 md:pl-[calc(72px+1.5rem)] lg:pt-10 lg:pr-10 lg:pl-[calc(15rem+2.5rem)]">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Main"
        className="bg-surface/95 fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t px-6 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {NAV.map((item) => {
          const active = item.isActive(pathname)
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
