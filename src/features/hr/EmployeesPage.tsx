import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'

import type { Level } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import { useCreateEmployee, useEmployees } from '@/features/hr/api'
import type { EmployeeCreate } from '@/features/hr/types'
import { LEVEL_TITLES, date, humanize, levelLabel, locationLabel } from '@/lib/format'

const ANY = 'any'
const LOCATIONS = ['hyderabad', 'bengaluru', 'pune', 'chennai', 'remote_india', 'usa', 'uk']
const PRACTICES = ['app_dev', 'data_analytics', 'cloud', 'devops', 'ai_ml', 'qa']
const COST_BANDS = ['A', 'B', 'C', 'D', 'E']

export default function EmployeesPage() {
  const allowed = useManagesPeople()
  const [q, setQ] = useState('')
  const [level, setLevel] = useState(ANY)
  const [location, setLocation] = useState(ANY)
  const [adding, setAdding] = useState(false)
  const employees = useEmployees({
    q: q || undefined,
    level: level === ANY ? undefined : level,
    location: location === ANY ? undefined : location,
  })
  if (!allowed) return <Navigate to="/tasks" replace />

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">Employees</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            The people matching ranks. Keep skills, availability and leave current so results stay
            right. Every change is recorded.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus aria-hidden /> Add employee
        </Button>
      </header>
      {adding && <AddEmployeeDialog onClose={() => setAdding(false)} />}
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

function AddEmployeeDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateEmployee()
  const navigate = useNavigate()
  const [v, setV] = useState<EmployeeCreate>({
    employee_code: '',
    full_name: '',
    designation: '',
    level: 'L3',
    practice: 'app_dev',
    years_experience: 0,
    location: 'hyderabad',
    cost_band: 'C',
    current_allocation_pct: 0,
    available_from: new Date().toISOString().slice(0, 10),
  })
  const ready = v.employee_code.trim() && v.full_name.trim() && v.designation.trim()
  const text = (key: 'employee_code' | 'full_name' | 'designation', label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`n-${key}`}>{label}</Label>
      <Input
        id={`n-${key}`}
        value={v[key]}
        onChange={(x) => setV({ ...v, [key]: x.target.value })}
      />
    </div>
  )
  const pick = (
    key: 'level' | 'practice' | 'location' | 'cost_band',
    label: string,
    options: string[],
    show: (o: string) => string,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`n-${key}`}>{label}</Label>
      <Select value={v[key]} onValueChange={(o) => setV({ ...v, [key]: o })}>
        <SelectTrigger id={`n-${key}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {show(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            Matching includes them from the next run. Add skills on their page next.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {text('employee_code', 'Employee code')}
          {text('full_name', 'Full name')}
          <div className="sm:col-span-2">{text('designation', 'Role')}</div>
          {pick('level', 'Level', Object.keys(LEVEL_TITLES), (l) => levelLabel(l as Level))}
          {pick('practice', 'Practice', PRACTICES, humanize)}
          <div className="space-y-1.5">
            <Label htmlFor="n-years">Years of experience</Label>
            <Input
              id="n-years"
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={v.years_experience}
              onChange={(x) => setV({ ...v, years_experience: Number(x.target.value) })}
            />
          </div>
          {pick('location', 'Location', LOCATIONS, locationLabel)}
          {pick('cost_band', 'Cost band', COST_BANDS, (b) => `Band ${b}`)}
          <div className="space-y-1.5">
            <Label htmlFor="n-alloc">Allocated now (%)</Label>
            <Input
              id="n-alloc"
              type="number"
              min={0}
              max={100}
              value={v.current_allocation_pct}
              onChange={(x) => setV({ ...v, current_allocation_pct: Number(x.target.value) })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="n-free">Free from</Label>
            <Input
              id="n-free"
              type="date"
              value={v.available_from}
              onChange={(x) => setV({ ...v, available_from: x.target.value })}
            />
          </div>
        </div>
        {create.isError && <ErrorState error={create.error} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!ready || create.isPending}
            onClick={() =>
              create.mutate(v, { onSuccess: (e) => void navigate(`/employees/${e.id}`) })
            }
          >
            Add employee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
