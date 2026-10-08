import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router'

import type { Level } from '@/api/types'
import { Field, FormSection, FormSheet } from '@/components/FormSheet'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import {
  useAddLeave,
  useAddProject,
  useConfirmReviewed,
  useDeleteEmployeeResume,
  useEmployee,
  useEmployeeResume,
  useEmployeeResumeFile,
  useProjects,
  useRemoveLeave,
  useRemoveProject,
  useResumeSkill,
  useSaveSkills,
  useUpdateEmployee,
  useUploadEmployeeResume,
} from '@/features/hr/api'
import type {
  EmployeeDetail,
  EmployeeProjectCreate,
  EmployeeSkill,
  EvidenceStatus,
  ProjectOutcome,
} from '@/features/hr/types'
import { ProfileStatus, ago } from '@/features/hr/EmployeesPage'
import { useSkills } from '@/features/newTask/api'
import { LEVEL_TITLES, date, domainLabel, humanize, levelLabel, locationLabel } from '@/lib/format'
import { useUnits } from '@/features/org/api'

const LOCATIONS = ['hyderabad', 'bengaluru', 'pune', 'chennai', 'remote_india', 'usa', 'uk']
const COST_BANDS = ['A', 'B', 'C', 'D', 'E']
const MIN_SKILLS = 3

const OUTCOME_LABELS: Record<ProjectOutcome, string> = {
  successful: 'Finished well',
  early_release: 'Left early',
  escalated: 'Escalated',
  ongoing: 'Still working on it',
}

const OUTCOME_TONE = {
  successful: 'ready',
  early_release: 'attention',
  escalated: 'danger',
  ongoing: 'info',
} as const

type Editing = 'details' | 'skills' | 'leave' | 'review' | 'project' | null

export default function EmployeePage() {
  const { employeeId = '' } = useParams()
  const allowed = useManagesPeople()
  const employee = useEmployee(employeeId)
  const [editing, setEditing] = useState<Editing>(null)
  const removeLeave = useRemoveLeave(employeeId)
  const removeProject = useRemoveProject(employeeId)
  if (!allowed) return <Navigate to="/tasks" replace />
  if (employee.isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (employee.isError) return <ErrorState error={employee.error} />
  const e = employee.data
  const close = () => setEditing(null)

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ to: '/company', label: 'All employees' }}
        title={e.full_name}
        status={<ProfileStatus e={e} />}
        meta={`${e.employee_code} · ${e.designation} · ${levelLabel(e.level)} · ${locationLabel(e.location)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing('details')}>
              <Pencil aria-hidden /> Edit details
            </Button>
            <Button
              variant={e.needs_review ? 'default' : 'outline'}
              onClick={() => setEditing('review')}
            >
              <CheckCircle2 aria-hidden /> Confirm profile is up to date
            </Button>
          </>
        }
      />
      <Attention employee={e} />
      <UnitPicker employeeId={e.id} current={e.business_unit_id ?? null} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Section
            title="Skills"
            count={e.skills.length}
            description="Level 1–5, years of use and when last used all feed matching."
            action={
              <Button variant="outline" size="sm" onClick={() => setEditing('skills')}>
                <Pencil aria-hidden /> Edit skills
              </Button>
            }
          >
            {e.skills.length === 0 ? (
              <Empty>No skills yet. Use Edit skills to add at least {MIN_SKILLS}.</Empty>
            ) : (
              <Table aria-label="Skills">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Skill</TableHead>
                    <TableHead className="text-xs">Level</TableHead>
                    <TableHead className="text-right text-xs">Years</TableHead>
                    <TableHead className="text-xs">Last used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...e.skills]
                    .sort((a, b) => b.proficiency - a.proficiency)
                    .map((s) => (
                      <TableRow key={s.skill_id}>
                        <TableCell className="font-medium">
                          {s.skill_name}
                          {s.certified && (
                            <StatusBadge tone="info" className="ml-2">
                              Certified
                            </StatusBadge>
                          )}
                        </TableCell>
                        <TableCell>
                          <LevelDots value={s.proficiency} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{s.years}</TableCell>
                        <TableCell>{date(s.last_used)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <ResumeSection employeeId={e.id} />

          <Section
            title="Project history"
            count={e.projects.length}
            description="Tells matching which kinds of work and clients they have experience with."
            action={
              <Button variant="outline" size="sm" onClick={() => setEditing('project')}>
                <Plus aria-hidden /> Add project
              </Button>
            }
          >
            {e.projects.length === 0 ? (
              <Empty>
                No projects yet. Add the projects they worked on, so matching knows which domains
                they have experience in.
              </Empty>
            ) : (
              <Table aria-label="Project history">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Project</TableHead>
                    <TableHead className="text-xs">Their role</TableHead>
                    <TableHead className="text-xs">When</TableHead>
                    <TableHead className="text-xs">How it went</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {e.projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.project_name}</div>
                        <div className="text-muted-foreground text-xs">{domainLabel(p.domain)}</div>
                      </TableCell>
                      <TableCell>{p.role_title}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {date(p.start_date)} – {date(p.end_date)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={OUTCOME_TONE[p.outcome as ProjectOutcome]}>
                          {OUTCOME_LABELS[p.outcome as ProjectOutcome]}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${p.project_name}`}
                          onClick={() => removeProject.mutate(p.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </div>

        <aside className="space-y-6">
          <Section
            title="Details"
            action={
              <Button variant="ghost" size="sm" onClick={() => setEditing('details')}>
                <Pencil aria-hidden /> Edit
              </Button>
            }
          >
            <dl className="divide-y text-sm">
              <Detail label="Experience" value={`${e.years_experience} years`} />
              <Detail label="Practice" value={humanize(e.practice)} />
              <Detail label="Cost band" value={`Band ${e.cost_band}`} />
              <Detail label="Booked now" value={`${e.current_allocation_pct}%`} />
              <Detail label="Free from" value={date(e.available_from)} />
              <Detail label="Works" value={humanize(e.work_mode_preference)} />
              <Detail label="Timezone" value={e.timezone} />
              <Detail label="Client clearances" value={e.client_clearances.join(', ') || '—'} />
              <Detail
                label="Last reviewed"
                value={
                  e.reviewed_at
                    ? `${ago(e.reviewed_at)}${e.reviewed_by ? ` by ${e.reviewed_by}` : ''}`
                    : 'Never'
                }
              />
            </dl>
          </Section>
          <Section
            title="Leave"
            action={
              <Button variant="ghost" size="sm" onClick={() => setEditing('leave')}>
                <CalendarPlus aria-hidden /> Add leave
              </Button>
            }
          >
            {e.leaves.length === 0 ? (
              <Empty>No leave planned.</Empty>
            ) : (
              <ul className="divide-y text-sm">
                {e.leaves.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-1.5">
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
          </Section>
        </aside>
      </div>

      {editing === 'details' && <DetailsSheet employee={e} onClose={close} />}
      {editing === 'skills' && <SkillsSheet employee={e} onClose={close} />}
      {editing === 'leave' && <LeaveDialog employeeId={e.id} onClose={close} />}
      {editing === 'review' && <ReviewDialog employee={e} onClose={close} />}
      {editing === 'project' && <AddProjectSheet employeeId={e.id} onClose={close} />}
    </div>
  )
}

function Section({
  title,
  count,
  description,
  action,
  children,
}: {
  title: string
  count?: number
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="bg-surface rounded-xl border">
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">
            {title}
            {count !== undefined && (
              <span className="text-muted-foreground ml-1.5 font-normal tabular-nums">{count}</span>
            )}
          </h2>
          {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
        </div>
        {action}
      </header>
      <div className="px-4 py-2">{children}</div>
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground py-3 text-sm">{children}</p>
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}

function LevelDots({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Level ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          aria-hidden
          className={n <= value ? 'bg-primary size-2 rounded-full' : 'bg-muted size-2 rounded-full'}
        />
      ))}
      <span className="text-muted-foreground ml-1 text-xs tabular-nums">{value}/5</span>
    </span>
  )
}

/** What this profile still needs, in plain words. */
function Attention({ employee: e }: { employee: EmployeeDetail }) {
  if (e.missing.length === 0 && !e.needs_review) return null
  const reviewed = e.reviewed_at
    ? `Last checked ${ago(e.reviewed_at)} (${date(e.reviewed_at)})${e.reviewed_by ? ` by ${e.reviewed_by}` : ''}.`
    : 'Never checked by HR.'
  return (
    <section
      className="border-band-review-foreground/20 bg-band-review/30 flex gap-3 rounded-xl border p-4"
      aria-label="This profile needs attention"
    >
      <AlertTriangle className="text-band-review-foreground mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">This profile needs attention</p>
        <ul className="list-disc space-y-0.5 pl-5 text-sm">
          {e.missing.includes('few_skills') && (
            <li>
              Add skills: matching needs at least {MIN_SKILLS}, and this profile has {e.skill_count}
              . Use <strong>Edit skills</strong>.
            </li>
          )}
          {e.missing.includes('no_projects') && (
            <li>
              Add at least one project they worked on, so matching knows their domain experience.
              Use <strong>Add project</strong>.
            </li>
          )}
          {e.needs_review && (
            <li>
              Check the profile is still right. {reviewed} People pick up new skills, change level
              or become free; when it looks right, choose{' '}
              <strong>Confirm profile is up to date</strong>.
            </li>
          )}
        </ul>
      </div>
    </section>
  )
}

function DetailsSheet({ employee: e, onClose }: { employee: EmployeeDetail; onClose: () => void }) {
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
    <FormSheet
      title={`Edit ${e.full_name}`}
      description="Matching uses these from the next run. Changes are recorded in the audit log."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={update.isPending}
            onClick={() => update.mutate(v, { onSuccess: onClose })}
          >
            Save changes
          </Button>
        </>
      }
    >
      <FormSection title="Role">
        <Field id="e-designation" label="Role" wide>
          <Input
            id="e-designation"
            value={v.designation}
            onChange={(x) => setV({ ...v, designation: x.target.value })}
          />
        </Field>
        <Field id="e-level" label="Level">
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
        </Field>
        <Field id="e-band" label="Cost band" help="Used to respect a task’s budget.">
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
        </Field>
      </FormSection>
      <FormSection title="Where and when they can work">
        <Field id="e-location" label="Location">
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
        </Field>
        <Field
          id="e-alloc"
          label="Booked now (%)"
          help="Share of their time already on other work."
        >
          <Input
            id="e-alloc"
            type="number"
            min={0}
            max={100}
            value={v.current_allocation_pct}
            onChange={(x) => setV({ ...v, current_allocation_pct: Number(x.target.value) })}
          />
        </Field>
        <Field id="e-free" label="Free from" help="First day they can start new work.">
          <Input
            id="e-free"
            type="date"
            value={v.available_from}
            onChange={(x) => setV({ ...v, available_from: x.target.value })}
          />
        </Field>
      </FormSection>
      {update.isError && <ErrorState error={update.error} />}
    </FormSheet>
  )
}

function SkillsSheet({ employee: e, onClose }: { employee: EmployeeDetail; onClose: () => void }) {
  const save = useSaveSkills(e.id)
  const catalog = useSkills()
  const [rows, setRows] = useState<EmployeeSkill[]>(e.skills)
  const [adding, setAdding] = useState('')
  const change = (id: string, patch: Partial<EmployeeSkill>) =>
    setRows((r) => r.map((s) => (s.skill_id === id ? { ...s, ...patch } : s)))
  const available = (catalog.data ?? []).filter((k) => !rows.some((r) => r.skill_id === k.id))

  return (
    <FormSheet
      title={`Skills of ${e.full_name}`}
      description="Level 1–5 (1 = beginner, 5 = expert), years of use and when last used all feed matching."
      onClose={onClose}
      footer={
        <>
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
        </>
      }
    >
      <section className="space-y-2">
        <div className="text-muted-foreground grid grid-cols-[1fr_4rem_4rem_8.5rem_2rem] gap-2 text-xs font-medium">
          <span>Skill</span>
          <span>Level</span>
          <span>Years</span>
          <span>Last used</span>
          <span />
        </div>
        {rows.map((s) => (
          <div
            key={s.skill_id}
            className="grid grid-cols-[1fr_4rem_4rem_8.5rem_2rem] items-center gap-2 text-sm"
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
      </section>
      <section className="space-y-1.5 border-t pt-4">
        <Label>Add a skill</Label>
        <div className="flex gap-2">
          <Select value={adding} onValueChange={setAdding}>
            <SelectTrigger className="flex-1" aria-label="Skill to add">
              <SelectValue placeholder="Choose from the skills list" />
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
      </section>
      {save.isError && <ErrorState error={save.error} />}
    </FormSheet>
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

function ReviewDialog({ employee: e, onClose }: { employee: EmployeeDetail; onClose: () => void }) {
  const confirm = useConfirmReviewed(e.id)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Is {e.full_name}&rsquo;s profile up to date?</DialogTitle>
          <DialogDescription>
            Before you confirm, check on this page that these are still right:
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-6 text-sm">
          <li>Skills, their levels and when each was last used</li>
          <li>Role, level and location</li>
          <li>How busy they are now and when they are free</li>
          <li>Planned leave and past projects</li>
        </ul>
        <p className="text-muted-foreground text-sm">
          Confirming records that you checked the profile today. Changing anything above does the
          same.
        </p>
        {confirm.isError && <ErrorState error={confirm.error} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Not yet
          </Button>
          <Button
            disabled={confirm.isPending}
            onClick={() => confirm.mutate(undefined, { onSuccess: onClose })}
          >
            Yes, it&rsquo;s up to date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddProjectSheet({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const projects = useProjects()
  const add = useAddProject(employeeId)
  const [v, setV] = useState<EmployeeProjectCreate>({
    project_id: '',
    role_title: '',
    start_date: '',
    end_date: '',
    outcome: 'successful',
  })
  const ready = v.project_id && v.role_title.trim() && v.start_date && v.end_date
  const wrongOrder = Boolean(v.start_date && v.end_date && v.end_date < v.start_date)
  return (
    <FormSheet
      title="Add a project"
      description="A project they worked on. Matching uses it to judge their experience in that project’s domain."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!ready || wrongOrder || add.isPending}
            onClick={() => add.mutate(v, { onSuccess: onClose })}
          >
            Add project
          </Button>
        </>
      }
    >
      <FormSection title="The project">
        <Field id="p-project" label="Project" required wide>
          <Select value={v.project_id} onValueChange={(id) => setV({ ...v, project_id: id })}>
            <SelectTrigger id="p-project">
              <SelectValue placeholder={projects.isPending ? 'Loading…' : 'Choose a project'} />
            </SelectTrigger>
            <SelectContent>
              {(projects.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {domainLabel(p.domain)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="p-role" label="Their role on it" required wide>
          <Input
            id="p-role"
            placeholder="e.g. Backend developer"
            value={v.role_title}
            onChange={(x) => setV({ ...v, role_title: x.target.value })}
          />
        </Field>
      </FormSection>
      <FormSection title="When and how it went">
        <Field id="p-from" label="From" required>
          <Input
            id="p-from"
            type="date"
            value={v.start_date}
            onChange={(x) => setV({ ...v, start_date: x.target.value })}
          />
        </Field>
        <Field id="p-to" label="To" required>
          <Input
            id="p-to"
            type="date"
            value={v.end_date}
            onChange={(x) => setV({ ...v, end_date: x.target.value })}
          />
        </Field>
        <Field id="p-outcome" label="How did it go?" wide>
          <Select
            value={v.outcome}
            onValueChange={(o) => setV({ ...v, outcome: o as ProjectOutcome })}
          >
            <SelectTrigger id="p-outcome">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(OUTCOME_LABELS) as ProjectOutcome[]).map((o) => (
                <SelectItem key={o} value={o}>
                  {OUTCOME_LABELS[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormSection>
      {wrongOrder && (
        <p className="text-destructive text-sm">The end date must be on or after the start.</p>
      )}
      {add.isError && <ErrorState error={add.error} />}
    </FormSheet>
  )
}

const EVIDENCE_LABEL: Record<EvidenceStatus, string> = {
  on_profile: 'Already on the profile',
  suggested: 'Not on the profile yet',
  accepted: 'Added to the profile',
  dismissed: 'Dismissed',
}

/** The employee's resume, read once: skills it shows that the profile lacks can be accepted. */
function ResumeSection({ employeeId }: { employeeId: string }) {
  const resume = useEmployeeResume(employeeId)
  const upload = useUploadEmployeeResume(employeeId)
  const act = useResumeSkill(employeeId)
  const remove = useDeleteEmployeeResume(employeeId)
  const [viewing, setViewing] = useState(false)
  const file = useEmployeeResumeFile(employeeId, viewing)
  const r = resume.data
  const pick = (
    <label className="cursor-pointer">
      <input
        type="file"
        accept=".pdf,.docx"
        aria-label="Resume file"
        className="sr-only"
        onChange={(ev) => {
          const f = ev.target.files?.[0]
          if (f) upload.mutate({ file: f })
          ev.target.value = ''
        }}
      />
      <span className="hover:bg-accent inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium">
        {upload.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Upload className="size-4" aria-hidden />
        )}
        {r ? 'Replace resume' : 'Upload resume'}
      </span>
    </label>
  )
  const suggested = r?.evidence.filter((x) => x.status === 'suggested') ?? []
  return (
    <Section
      title="Resume"
      description="Read once to find skills the profile is missing. Personal details are removed before reading; nothing changes until you accept a skill."
      action={pick}
    >
      {upload.isError && <ErrorState error={upload.error} />}
      {resume.isPending ? (
        <Skeleton className="my-3 h-16" />
      ) : resume.isError ? (
        <ErrorState error={resume.error} />
      ) : !r ? (
        <Empty>
          No resume yet. Upload one (PDF or Word) to see which skills it shows that the profile does
          not have.
        </Empty>
      ) : (
        <div className="space-y-4 py-3">
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>
              Read {date(r.uploaded_at)}
              {r.uploaded_by ? ` by ${r.uploaded_by}` : ''}
            </span>
            <button
              type="button"
              className="text-primary underline"
              onClick={() => setViewing((v) => !v)}
            >
              {viewing ? 'Hide the file' : 'View the file'}
            </button>
            <button
              type="button"
              className="text-destructive underline"
              disabled={remove.isPending}
              onClick={() => remove.mutate(undefined)}
            >
              Delete resume
            </button>
          </p>
          {viewing && <ResumeFile blob={file.data} failed={file.isError} />}
          {suggested.length > 0 && (
            <div
              className="border-band-review-foreground/20 bg-band-review/30 rounded-lg border p-3 text-sm"
              role="status"
            >
              The resume shows {suggested.length} skill{suggested.length === 1 ? '' : 's'} the
              profile does not have. Accept the ones that are right.
            </div>
          )}
          <ul className="divide-y text-sm" aria-label="Skills found in the resume">
            {r.evidence.map((x) => (
              <li
                key={x.skill_id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{x.skill_name}</span>
                  <span className="text-muted-foreground text-xs">
                    level {x.proficiency}/5 · {x.years} yrs · last used {date(x.last_used)}
                  </span>
                </span>
                {x.status === 'suggested' ? (
                  <span className="flex gap-1.5">
                    <Button
                      size="sm"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ skillId: x.skill_id, action: 'accept' })}
                    >
                      Accept as skill
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ skillId: x.skill_id, action: 'dismiss' })}
                    >
                      Dismiss
                    </Button>
                  </span>
                ) : (
                  <StatusBadge
                    tone={
                      x.status === 'dismissed'
                        ? 'neutral'
                        : x.status === 'accepted'
                          ? 'ready'
                          : 'info'
                    }
                  >
                    {EVIDENCE_LABEL[x.status]}
                  </StatusBadge>
                )}
              </li>
            ))}
          </ul>
          {r.notes.length > 0 && (
            <ul className="text-muted-foreground space-y-0.5 text-xs">
              {r.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  )
}

function ResumeFile({ blob, failed }: { blob: Blob | undefined; failed: boolean }) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )
  if (failed) return <Empty>The file could not be loaded.</Empty>
  if (!url || !blob) return <Skeleton className="h-40" />
  if (blob.type === 'application/pdf') {
    return <iframe title="Resume" src={url} className="h-[600px] w-full rounded-lg border" />
  }
  return (
    <Button asChild variant="outline" size="sm">
      <a href={url} download="resume.docx">
        Download the resume (Word)
      </a>
    </Button>
  )
}

/** HR moves a person between business units (ADR 026). */
function UnitPicker({ employeeId, current }: { employeeId: string; current: string | null }) {
  const units = useUnits()
  const update = useUpdateEmployee(employeeId)
  if (!units.data) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor="employee-unit" className="text-muted-foreground">
        Business unit
      </label>
      <select
        id="employee-unit"
        className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        value={current ?? ''}
        disabled={update.isPending}
        onChange={(ev) => update.mutate({ business_unit_id: ev.target.value || null })}
      >
        <option value="">None</option>
        {units.data.map((u) => (
          <option key={u.id} value={u.id}>
            {u.code} · {u.name}
            {u.head_name ? ` (head: ${u.head_name})` : ''}
          </option>
        ))}
      </select>
      {update.isError && <span className="text-destructive text-xs">Could not save the unit.</span>}
    </div>
  )
}
