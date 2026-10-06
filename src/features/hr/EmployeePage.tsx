import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'

import type { Level } from '@/api/types'
import { ErrorState } from '@/components/QueryStates'
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
import {
  useAddLeave,
  useEmployee,
  useRemoveLeave,
  useSaveSkills,
  useUpdateEmployee,
} from '@/features/hr/api'
import type { EmployeeDetail, EmployeeSkill } from '@/features/hr/types'
import { Panel } from '@/features/hr/ui'
import { useSkills } from '@/features/newTask/api'
import { LEVEL_TITLES, date, domainLabel, levelLabel, locationLabel } from '@/lib/format'

const LOCATIONS = ['hyderabad', 'bengaluru', 'pune', 'chennai', 'remote_india', 'usa', 'uk']
const COST_BANDS = ['A', 'B', 'C', 'D', 'E']

export default function EmployeePage() {
  const { employeeId = '' } = useParams()
  const allowed = useManagesPeople()
  const employee = useEmployee(employeeId)
  const [editing, setEditing] = useState<'details' | 'skills' | 'leave' | null>(null)
  const removeLeave = useRemoveLeave(employeeId)
  if (!allowed) return <Navigate to="/tasks" replace />
  if (employee.isPending) return <Skeleton className="h-96 w-full rounded-2xl" />
  if (employee.isError) return <ErrorState error={employee.error} />
  const e = employee.data

  return (
    <div className="space-y-6">
      <Link
        to="/employees"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> All employees
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">{e.full_name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {e.employee_code} · {e.designation} · {levelLabel(e.level)} · {locationLabel(e.location)}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Panel
            title={`Skills (${e.skills.length})`}
            action={
              <Button variant="outline" size="sm" onClick={() => setEditing('skills')}>
                <Pencil aria-hidden /> Edit skills
              </Button>
            }
          >
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left text-xs">
                <tr>
                  <th className="pb-1 font-normal">Skill</th>
                  <th className="pb-1 font-normal">Level</th>
                  <th className="pb-1 font-normal">Years</th>
                  <th className="pb-1 font-normal">Last used</th>
                </tr>
              </thead>
              <tbody>
                {[...e.skills]
                  .sort((a, b) => b.proficiency - a.proficiency)
                  .map((s) => (
                    <tr key={s.skill_id} className="border-t">
                      <td className="py-1.5">
                        {s.skill_name}
                        {s.certified && (
                          <span className="text-primary ml-1 text-xs">certified</span>
                        )}
                      </td>
                      <td className="tabular-nums">{s.proficiency}/5</td>
                      <td className="tabular-nums">{s.years}</td>
                      <td>{date(s.last_used)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Panel>
          <Panel title={`Project history (${e.projects.length})`}>
            <ul className="divide-y text-sm">
              {e.projects.map((p) => (
                <li key={p.project_name + p.start_date} className="py-2">
                  <p className="font-medium">
                    {p.project_name} · {p.role_title}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {domainLabel(p.domain)} · {date(p.start_date)} – {date(p.end_date)} ·{' '}
                    {p.outcome}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="Details"
            action={
              <Button variant="outline" size="sm" onClick={() => setEditing('details')}>
                <Pencil aria-hidden /> Edit
              </Button>
            }
          >
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Detail label="Experience" value={`${e.years_experience} years`} />
              <Detail label="Cost band" value={e.cost_band} />
              <Detail label="Allocated now" value={`${e.current_allocation_pct}%`} />
              <Detail label="Free from" value={date(e.available_from)} />
              <Detail label="Works" value={e.work_mode_preference} />
              <Detail label="Timezone" value={e.timezone} />
              <Detail label="Client clearances" value={e.client_clearances.join(', ') || '—'} />
            </dl>
          </Panel>
          <Panel
            title="Leave"
            action={
              <Button variant="outline" size="sm" onClick={() => setEditing('leave')}>
                <Plus aria-hidden /> Add
              </Button>
            }
          >
            {e.leaves.length === 0 ? (
              <p className="text-muted-foreground text-sm">No leave planned.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {e.leaves.map((l) => (
                  <li key={l.id} className="flex items-center justify-between">
                    {date(l.start_date)} – {date(l.end_date)}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove leave from ${date(l.start_date)}`}
                      onClick={() => removeLeave.mutate(l.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {editing === 'details' && <DetailsDialog employee={e} onClose={() => setEditing(null)} />}
      {editing === 'skills' && <SkillsDialog employee={e} onClose={() => setEditing(null)} />}
      {editing === 'leave' && <LeaveDialog employeeId={e.id} onClose={() => setEditing(null)} />}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="capitalize">{value}</dd>
    </div>
  )
}

function DetailsDialog({
  employee: e,
  onClose,
}: {
  employee: EmployeeDetail
  onClose: () => void
}) {
  const update = useUpdateEmployee(e.id)
  const [v, setV] = useState({
    designation: e.designation,
    level: e.level,
    location: e.location,
    cost_band: e.cost_band,
    current_allocation_pct: e.current_allocation_pct,
    available_from: e.available_from,
  })
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {e.full_name}</DialogTitle>
          <DialogDescription>
            Matching uses these on the next run. Recorded in the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="e-designation">Role</Label>
            <Input
              id="e-designation"
              value={v.designation}
              onChange={(x) => setV({ ...v, designation: x.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-level">Level</Label>
            <Select value={v.level} onValueChange={(l) => setV({ ...v, level: l as Level })}>
              <SelectTrigger id="e-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LEVEL_TITLES) as Level[]).map((l) => (
                  <SelectItem key={l} value={l}>
                    {levelLabel(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-location">Location</Label>
            <Select value={v.location} onValueChange={(l) => setV({ ...v, location: l })}>
              <SelectTrigger id="e-location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {locationLabel(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-band">Cost band</Label>
            <Select value={v.cost_band} onValueChange={(b) => setV({ ...v, cost_band: b })}>
              <SelectTrigger id="e-band">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COST_BANDS.map((b) => (
                  <SelectItem key={b} value={b}>
                    Band {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-alloc">Allocated now (%)</Label>
            <Input
              id="e-alloc"
              type="number"
              min={0}
              max={100}
              value={v.current_allocation_pct}
              onChange={(x) => setV({ ...v, current_allocation_pct: Number(x.target.value) })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="e-free">Free from</Label>
            <Input
              id="e-free"
              type="date"
              value={v.available_from}
              onChange={(x) => setV({ ...v, available_from: x.target.value })}
            />
          </div>
        </div>
        {update.isError && <ErrorState error={update.error} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={update.isPending}
            onClick={() => update.mutate(v, { onSuccess: onClose })}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SkillsDialog({ employee: e, onClose }: { employee: EmployeeDetail; onClose: () => void }) {
  const save = useSaveSkills(e.id)
  const catalog = useSkills()
  const [rows, setRows] = useState<EmployeeSkill[]>(e.skills)
  const [adding, setAdding] = useState('')
  const change = (id: string, patch: Partial<EmployeeSkill>) =>
    setRows((r) => r.map((s) => (s.skill_id === id ? { ...s, ...patch } : s)))
  const available = (catalog.data ?? []).filter((k) => !rows.some((r) => r.skill_id === k.id))

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Skills of {e.full_name}</DialogTitle>
          <DialogDescription>
            Level 1–5, years of use and when last used all feed matching.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {rows.map((s) => (
            <div
              key={s.skill_id}
              className="grid grid-cols-[1fr_5rem_5rem_9rem_2rem] items-center gap-2 text-sm"
            >
              <span className="truncate">{s.skill_name}</span>
              <Input
                type="number"
                min={1}
                max={5}
                aria-label={`${s.skill_name} level`}
                value={s.proficiency}
                onChange={(x) => change(s.skill_id, { proficiency: Number(x.target.value) })}
              />
              <Input
                type="number"
                min={0}
                step={0.5}
                aria-label={`${s.skill_name} years`}
                value={s.years}
                onChange={(x) => change(s.skill_id, { years: Number(x.target.value) })}
              />
              <Input
                type="date"
                aria-label={`${s.skill_name} last used`}
                value={s.last_used}
                onChange={(x) => change(s.skill_id, { last_used: x.target.value })}
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove ${s.skill_name}`}
                onClick={() => setRows((r) => r.filter((x) => x.skill_id !== s.skill_id))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Select value={adding} onValueChange={setAdding}>
            <SelectTrigger className="flex-1" aria-label="Skill to add">
              <SelectValue placeholder="Add a skill from the list" />
            </SelectTrigger>
            <SelectContent>
              {available.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={!adding}
            onClick={() => {
              const k = catalog.data?.find((x) => x.id === adding)
              if (!k) return
              setRows((r) => [
                ...r,
                {
                  skill_id: k.id,
                  skill_name: k.name,
                  proficiency: 3,
                  years: 1,
                  last_used: new Date().toISOString().slice(0, 10),
                  certified: false,
                },
              ])
              setAdding('')
            }}
          >
            <Plus aria-hidden /> Add
          </Button>
        </div>
        {save.isError && <ErrorState error={save.error} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                rows.map((r) => ({
                  skill_id: r.skill_id,
                  proficiency: r.proficiency,
                  years: r.years,
                  last_used: r.last_used,
                  certified: r.certified,
                })),
                { onSuccess: onClose },
              )
            }
          >
            Save skills
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LeaveDialog({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const add = useAddLeave(employeeId)
  const [v, setV] = useState({ start_date: '', end_date: '' })
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add leave</DialogTitle>
          <DialogDescription>
            Matching avoids putting someone on a task during long leave.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="l-start">From</Label>
            <Input
              id="l-start"
              type="date"
              value={v.start_date}
              onChange={(x) => setV({ ...v, start_date: x.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-end">To</Label>
            <Input
              id="l-end"
              type="date"
              value={v.end_date}
              onChange={(x) => setV({ ...v, end_date: x.target.value })}
            />
          </div>
        </div>
        {add.isError && <ErrorState error={add.error} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!v.start_date || !v.end_date || add.isPending}
            onClick={() => add.mutate(v, { onSuccess: onClose })}
          >
            Add leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
