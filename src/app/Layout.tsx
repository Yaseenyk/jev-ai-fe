import {
  Building2,
  FileUp,
  Inbox,
  Info,
  KeyRound,
  LayoutDashboard,
  LayoutList,
  LogOut,
  Plus,
  ShieldCheck,
  UserSearch,
  Users,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Link, Outlet, useLocation } from 'react-router'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  CHANGE_PASSWORD_PATH,
  useAuth,
  useCanEdit,
  useManagesPeople,
} from '@/features/auth/AuthProvider'
import { NotificationsBell } from '@/features/hr/NotificationsBell'
import { ROLE_LABELS } from '@/lib/format'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  isActive: (path: string) => boolean
  editorsOnly?: boolean
  adminOnly?: boolean
  peopleManagersOnly?: boolean // admin and HR (ADR 019)
  requestsOnly?: boolean // anyone who asks for or answers hiring requests
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Staffing',
    items: [
      {
        to: '/tasks',
        label: 'Tasks',
        icon: LayoutList,
        isActive: (p) => (p.startsWith('/tasks') && p !== '/tasks/new') || p.startsWith('/runs'),
      },
      {
        to: '/tasks/new',
        label: 'New task',
        icon: Plus,
        isActive: (p) => p === '/tasks/new',
        editorsOnly: true,
      },
      {
        to: '/hiring-requests',
        label: 'Requests',
        icon: Inbox,
        isActive: (p) => p.startsWith('/hiring-requests'),
        requestsOnly: true,
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        to: '/hr',
        label: 'HR home',
        icon: LayoutDashboard,
        isActive: (p) => p === '/hr',
        peopleManagersOnly: true,
      },
      {
        to: '/candidates',
        label: 'Candidates',
        icon: UserSearch,
        isActive: (p) => p.startsWith('/candidates'),
        peopleManagersOnly: true,
      },
      {
        to: '/company',
        label: 'Company',
        icon: Building2,
        isActive: (p) => p.startsWith('/company') || p.startsWith('/employees'),
        peopleManagersOnly: true,
      },
      {
        to: '/import',
        label: 'Import',
        icon: FileUp,
        isActive: (p) => p === '/import',
        peopleManagersOnly: true,
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        to: '/admin',
        label: 'Admin',
        icon: ShieldCheck,
        isActive: (p) => p.startsWith('/admin'),
        adminOnly: true,
      },
    ],
  },
]

const DEMO_NOTE =
  'Demo data: employees and tasks are synthetic. Results come from a recorded test run, not live data.'

const ICON_BUTTON =
  'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring grid size-9 shrink-0 place-items-center rounded-lg focus-visible:ring-2 focus-visible:outline-none'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

function useNavGroups() {
  const canEdit = useCanEdit()
  const isAdmin = useAuth().user?.role === 'admin'
  const managesPeople = useManagesPeople()
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(
      (item) =>
        (canEdit || !item.editorsOnly) &&
        (isAdmin || !item.adminOnly) &&
        (managesPeople || !item.peopleManagersOnly) &&
        (managesPeople || canEdit || !item.requestsOnly),
    ),
  })).filter((g) => g.items.length > 0)
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="flex min-w-0 items-center gap-2.5 rounded-lg"
      aria-label="Resource Matching home"
    >
      <span className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-lg">
        <Users className="size-4" aria-hidden />
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="font-heading block truncate text-[15px] font-semibold">
            Resource Matching
          </span>
          <span className="text-muted-foreground block truncate text-[11px]">
            Staffing recommendations
          </span>
        </span>
      )}
    </Link>
  )
}

function TopBar({ section }: { section: string | undefined }) {
  const { user, logout } = useAuth()
  return (
    <header className="bg-surface/95 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur sm:px-6 lg:px-8">
      <span className="md:hidden">
        <Brand compact />
      </span>
      <p className="hidden min-w-0 items-center gap-2 text-sm md:flex">
        <span className="text-muted-foreground">Resource Matching</span>
        {section && (
          <>
            <span className="text-muted-foreground/60" aria-hidden>
              /
            </span>
            <span className="truncate font-medium">{section}</span>
          </>
        )}
      </p>

      <div className="ml-auto flex items-center gap-1">
        {env.VITE_USE_MOCKS && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="border-band-review-foreground/20 bg-band-review text-band-review-foreground mr-2 flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium"
              >
                <Info className="size-3.5" aria-hidden /> Demo data
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{DEMO_NOTE}</TooltipContent>
          </Tooltip>
        )}
        <NotificationsBell />
        {user && (
          <>
            <span className="bg-border mx-2 hidden h-6 w-px sm:block" aria-hidden />
            <div className="flex items-center gap-2.5 pr-1">
              <span
                className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold"
                aria-hidden
              >
                {initials(user.display_name)}
              </span>
              <span className="hidden min-w-0 leading-tight sm:block">
                <span className="block max-w-44 truncate text-sm font-medium">
                  {user.display_name}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {ROLE_LABELS[user.role]}
                </span>
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to={CHANGE_PASSWORD_PATH}
                  aria-label="Change password"
                  className={ICON_BUTTON}
                >
                  <KeyRound className="size-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>Change password</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Sign out"
                  onClick={() => void logout()}
                  className={ICON_BUTTON}
                >
                  <LogOut className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Sign out</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </header>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  const groups = useNavGroups()
  const items = groups.flatMap((g) => g.items)
  const current = items.find((item) => item.isActive(pathname))

  return (
    <div className="bg-background min-h-svh md:flex">
      {/* Desktop sidebar (lg+) and tablet icon rail (md): stretches with the page, contents stay in view */}
      <aside className="bg-surface z-30 hidden w-[72px] shrink-0 border-r md:block lg:w-60">
        <div className="sticky top-0 flex h-svh flex-col">
          <div className="flex h-14 shrink-0 items-center border-b px-5 lg:px-4">
            <span className="hidden min-w-0 lg:block">
              <Brand />
            </span>
            <span className="lg:hidden">
              <Brand compact />
            </span>
          </div>

          <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="text-muted-foreground mb-1 hidden px-3 text-[11px] font-semibold tracking-wide uppercase lg:block">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = item.isActive(pathname)
                    return (
                      <li key={item.to}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              to={item.to}
                              aria-current={active ? 'page' : undefined}
                              className={cn(
                                'relative flex h-9 items-center justify-center gap-3 rounded-lg px-3 text-sm transition-colors lg:justify-start',
                                active
                                  ? 'bg-accent text-accent-foreground font-semibold'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground font-medium',
                              )}
                            >
                              {active && (
                                <span
                                  className="bg-primary absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full"
                                  aria-hidden
                                />
                              )}
                              <item.icon className="size-[18px] shrink-0" />
                              <span className="sr-only lg:not-sr-only">{item.label}</span>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="lg:hidden">
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <p className="text-muted-foreground hidden border-t px-4 py-3 text-[11px] leading-snug lg:block">
            The system recommends; people decide. Nobody is assigned automatically.
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <TopBar section={current?.label} />
        <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-28 sm:px-6 md:pb-12 lg:px-8 lg:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Main"
        className="bg-surface/95 fixed inset-x-0 bottom-0 z-30 flex gap-1 overflow-x-auto border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {items.map((item) => {
          const active = item.isActive(pathname)
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-12 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-xs font-medium whitespace-nowrap',
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
