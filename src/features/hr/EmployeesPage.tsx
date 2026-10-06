import { Search } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router'

import type { Level } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import { useEmployees } from '@/features/hr/api'
import { LEVEL_TITLES, date, levelLabel, locationLabel } from '@/lib/format'

const ANY = 'any'
const LOCATIONS = ['hyderabad', 'bengaluru', 'pune', 'chennai', 'remote_india', 'usa', 'uk']

export default function EmployeesPage() {
  const allowed = useManagesPeople()
  const [q, setQ] = useState('')
  const [level, setLevel] = useState(ANY)
  const [location, setLocation] = useState(ANY)
  const employees = useEmployees({
    q: q || undefined,
    level: level === ANY ? undefined : level,
    location: location === ANY ? undefined : location,
  })
  if (!allowed) return <Navigate to="/tasks" replace />

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">Employees</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          The people matching ranks. Keep skills, availability and leave current so results stay
          right. Every change is recorded.
        </p>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder="Name, code or role"
            aria-label="Search employees"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="w-44" aria-label="Level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All levels</SelectItem>
            {(Object.keys(LEVEL_TITLES) as Level[]).map((l) => (
              <SelectItem key={l} value={l}>
                {levelLabel(l)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="w-44" aria-label="Location">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All locations</SelectItem>
            {LOCATIONS.map((l) => (
              <SelectItem key={l} value={l}>
                {locationLabel(l)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {employees.data && (
          <span className="text-muted-foreground text-sm">{employees.data.total} people</span>
        )}
      </div>

      {employees.isPending ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : employees.isError ? (
        <ErrorState error={employees.error} />
      ) : employees.data.items.length === 0 ? (
        <EmptyState title="Nobody matches">Clear the search or filters.</EmptyState>
      ) : (
        <ul className="divide-y rounded-2xl border" aria-label="Employees">
          {employees.data.items.map((e) => (
            <li key={e.id}>
              <Link
                to={`/employees/${e.id}`}
                className="hover:bg-accent/40 flex flex-wrap items-center gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {e.full_name}{' '}
                    <span className="text-muted-foreground font-normal">· {e.employee_code}</span>
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    {e.designation} · {levelLabel(e.level)} · {locationLabel(e.location)} ·{' '}
                    {e.skill_count} skills
                  </p>
                </div>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {e.current_allocation_pct}% allocated · free from {date(e.available_from)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
