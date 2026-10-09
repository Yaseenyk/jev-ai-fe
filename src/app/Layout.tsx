import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  CalendarRange,
  LifeBuoy,
  ListChecks,
  PiggyBank,
  UserRound,
  FileUp,
  Gauge,
  Inbox,
  Info,
  KeyRound,
  LayoutDashboard,
  LayoutList,
  LogOut,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  UserSearch,
} from 'lucide-react'
import { useId, useState, type ComponentType, type SyntheticEvent } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'

import { apiFetch } from '@/api/client'
import type { Page, Task } from '@/api/types'
import { ThemeSwitch } from '@/components/ThemeSwitch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  CHANGE_PASSWORD_PATH,
  useAuth,
  useCanEdit,
  useManagesPeople,
} from '@/features/auth/AuthProvider'
import { GiveFeedbackButton } from '@/components/FeedbackPrompt'
import { useHiringRequests } from '@/features/hr/api'
import { needsHr } from '@/features/hr/HiringRequestsPage'
import { NotificationsBell } from '@/features/hr/NotificationsBell'
import { ROLE_LABELS } from '@/lib/format'
import { env } from '@/lib/env'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

type Badge = 'openTasks' | 'requests'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  isActive: (path: string) => boolean
  badge?: Badge
  editorsOnly?: boolean
  adminOnly?: boolean
  peopleManagersOnly?: boolean // admin and HR (ADR 019)
  requestsOnly?: boolean // anyone who asks for or answers hiring requests
  plannersOnly?: boolean // admin, resource managers and HR (ADR 024)
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      {
        to: '/dashboard',
        label: 'Dashboard',
        icon: Gauge,
        isActive: (p) => p === '/dashboard',
        plannersOnly: true,
      },
      {
        to: '/reports',
        label: 'Savings',
        icon: PiggyBank,
        isActive: (p) => p.startsWith('/reports'),
        plannersOnly: true,
      },
    ],
  },
  {
    label: 'Staffing',
    items: [
      {
        to: '/tasks',
        label: 'Tasks',
        icon: LayoutList,
        isActive: (p) => (p.startsWith('/tasks') && p !== '/tasks/new') || p.startsWith('/runs'),
        badge: 'openTasks',
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
        badge: 'requests',
      },
      {
        to: '/planning',
        label: 'Planning',
        icon: CalendarRange,
        isActive: (p) => p.startsWith('/planning'),
        plannersOnly: true,
      },
      {
        to: '/people/search',
        label: 'Find people',
        icon: Search,
        isActive: (p) => p.startsWith('/people/search'),
        plannersOnly: true,
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
      {
        to: '/setup',
        label: 'Setup',
        icon: ListChecks,
        isActive: (p) => p.startsWith('/setup'),
        peopleManagersOnly: true,
      },
      {
        to: '/help',
        label: 'Help',
        icon: LifeBuoy,
        isActive: (p) => p.startsWith('/help'),
      },
    ],
  },
]

const DEMO_NOTE =
  'Demo data: employees and tasks are synthetic. Results come from a recorded test run, not live data.'

const ICON_BUTTON =
  'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring grid size-9 shrink-0 place-items-center rounded-xl focus-visible:ring-2 focus-visible:outline-none'

const CARD = 'bg-surface rounded-2xl shadow-(--card-shadow)'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

// An employee login has its own short menu: never screens with other people's data (ADR 032).
const EMPLOYEE_NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Me',
    items: [
      { to: '/me', label: 'My profile', icon: UserRound, isActive: (p) => p === '/me' },
      { to: '/help', label: 'Help', icon: LifeBuoy, isActive: (p) => p.startsWith('/help') },
    ],
  },
]

function useNavGroups() {
  const canEdit = useCanEdit()
  const role = useAuth().user?.role
  const isAdmin = role === 'admin'
  const managesPeople = useManagesPeople()
  if (role === 'employee') return EMPLOYEE_NAV
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(
      (item) =>
        (canEdit || !item.editorsOnly) &&
        (isAdmin || !item.adminOnly) &&
        (managesPeople || !item.peopleManagersOnly) &&
        (managesPeople || canEdit || !item.requestsOnly) &&
        (managesPeople || canEdit || !item.plannersOnly),
    ),
  })).filter((g) => g.items.length > 0)
}

/** Counts next to navigation items: open tasks, and requests waiting for HR (HR only). */
function useBadges(): Record<Badge, number | undefined> {
  const managesPeople = useManagesPeople()
  const openTasks = useQuery({
    queryKey: ['nav', 'open-tasks'],
    queryFn: () => apiFetch<Page<Task>>('/tasks?status=open&limit=1'),
    staleTime: 60_000,
    enabled: useAuth().user?.role !== 'employee',
  })
  const requests = useHiringRequests(undefined, managesPeople)
  return {
    openTasks: openTasks.data?.total,
    requests: managesPeople ? requests.data?.filter(needsHr).length : undefined,
  }
}

function LogoMark({ className }: { className?: string }) {
  // Own gradient ids: the sidebar's copy is display:none on phones, and a hidden gradient cannot paint.
  const id = useId()
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ec4899" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect
        x="3"
        y="5"
        width="18"
        height="18"
        rx="6"
        fill="none"
        stroke={`url(#${id}a)`}
        strokeWidth="3.5"
      />
      <rect
        x="11"
        y="9"
        width="18"
        height="18"
        rx="6"
        fill="none"
        stroke={`url(#${id}b)`}
        strokeWidth="3.5"
      />
    </svg>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="flex min-w-0 items-center gap-2.5 rounded-xl"
      aria-label="Resource Matching home"
    >
      <LogoMark className="size-9 shrink-0" />
      {!compact && (
        <span className="font-heading truncate text-[19px] leading-tight font-bold tracking-tight">
          Resource Matching
        </span>
      )}
    </Link>
  )
}

/** Search tasks from anywhere: opens the task list filtered by the text. */
function SearchBox({ className }: { className?: string }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const submit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const text = q.trim()
    void navigate(text ? `/tasks?q=${encodeURIComponent(text)}` : '/tasks')
  }
  return (
    <form role="search" onSubmit={submit} className={cn('relative', className)}>
      <label htmlFor="global-search" className="sr-only">
        Find a task
      </label>
      <input
        id="global-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find a task or skill…"
        className="bg-muted/70 placeholder:text-muted-foreground focus-visible:ring-ring h-10 w-full rounded-xl border-0 pr-10 pl-4 text-sm outline-none focus-visible:ring-2"
      />
      <button
        type="submit"
        aria-label="Find"
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg"
      >
        <Search className="size-4" />
      </button>
    </form>
  )
}

function PilotCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-200 via-fuchsia-100 to-pink-200 p-4 dark:border dark:border-violet-400/20 dark:from-violet-500/20 dark:via-fuchsia-500/10 dark:to-pink-500/15">
      <div
        className="absolute -top-6 -right-6 size-24 rounded-full bg-gradient-to-br from-violet-500/40 to-pink-500/30 blur-xl dark:from-violet-400/25 dark:to-pink-400/15"
        aria-hidden
      />
      <Sparkles className="relative size-6 text-violet-600 dark:text-violet-300" aria-hidden />
      <p className="relative mt-3 text-sm font-semibold">The system recommends.</p>
      <p className="text-muted-foreground relative mt-1 text-xs leading-snug">
        People decide. Nobody is ever assigned automatically.
      </p>
    </div>
  )
}

function Sidebar() {
  const { pathname } = useLocation()
  const groups = useNavGroups()
  const badges = useBadges()
  const { logout } = useAuth()
  return (
    <aside
      className={cn(
        CARD,
        'sticky top-4 hidden h-[calc(100svh-2rem)] w-64 shrink-0 flex-col lg:flex',
      )}
    >
      <div className="px-5 pt-5">
        <Brand />
      </div>
      <nav aria-label="Main" className="mt-5 flex-1 space-y-5 overflow-y-auto px-3">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-primary mb-1.5 px-3 text-[11px] font-semibold tracking-[0.12em] uppercase">
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = item.isActive(pathname)
                const count = item.badge ? badges[item.badge] : undefined
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors',
                        active
                          ? 'bg-sidebar-accent text-foreground font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground font-medium',
                      )}
                    >
                      <item.icon className={cn('size-[18px] shrink-0', active && 'text-primary')} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count ? (
                        <span
                          className={cn(
                            'min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold text-white',
                            item.badge === 'requests' ? 'bg-pink-500' : 'bg-primary',
                          )}
                        >
                          {count}
                          <span className="sr-only">
                            {item.badge === 'requests' ? ' need you' : ' open'}
                          </span>
                        </span>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      {/* Only when there is room: on short screens the menu needs the space. */}
      <div className="hidden shrink-0 px-3 pt-3 [@media(min-height:860px)]:block">
        <PilotCard />
      </div>
      <div className="space-y-1 px-3 pt-3 pb-4">
        <Link
          to={CHANGE_PASSWORD_PATH}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 items-center gap-3 rounded-xl px-3 text-sm font-medium"
        >
          <KeyRound className="size-[18px]" aria-hidden /> Change password
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium"
        >
          <LogOut className="size-[18px]" aria-hidden /> Sign out
        </button>
        <div className="pt-2">
          <ThemeSwitch />
        </div>
      </div>
    </aside>
  )
}

function TopBar() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  return (
    <header className={cn(CARD, 'sticky top-4 z-20 flex h-16 items-center gap-3 px-3 sm:px-4')}>
      <span className="lg:hidden">
        <Brand compact />
      </span>
      <SearchBox className="hidden w-full max-w-md sm:block" />

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
        <GiveFeedbackButton page={pathname} />
        <NotificationsBell />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn(ICON_BUTTON, 'lg:hidden')}
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</TooltipContent>
        </Tooltip>
        {user && (
          <>
            <span className="bg-border mx-2 hidden h-6 w-px sm:block" aria-hidden />
            <div className="flex items-center gap-2.5 pr-1">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-xs font-semibold text-white"
                aria-hidden
              >
                {initials(user.display_name)}
              </span>
              <span className="hidden min-w-0 leading-tight sm:block">
                <span className="block max-w-44 truncate text-sm font-semibold">
                  {user.display_name}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {ROLE_LABELS[user.role]}
                </span>
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Sign out"
                  onClick={() => void logout()}
                  className={cn(ICON_BUTTON, 'lg:hidden')}
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
  const items = useNavGroups().flatMap((g) => g.items)

  return (
    <div className="bg-background min-h-svh lg:flex lg:gap-5 lg:p-4">
      <Sidebar />

      <div className="min-w-0 flex-1 px-3 pt-3 sm:px-4 lg:px-0 lg:pt-0">
        <TopBar />
        <main className="mx-auto w-full max-w-[90rem] pt-5 pb-28 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile and tablet bottom tab bar */}
      <nav
        aria-label="Main"
        className="bg-surface/95 fixed inset-x-0 bottom-0 z-30 flex gap-1 overflow-x-auto border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
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
