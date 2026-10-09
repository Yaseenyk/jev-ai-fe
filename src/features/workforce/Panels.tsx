import { GraduationCap, Heart, Loader2, MessageSquareText } from 'lucide-react'
import { useState } from 'react'

import type { Domain, LearningStatus, Location } from '@/api/types'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/AuthProvider'
import { useSkills } from '@/features/newTask/api'
import {
  useAssignCourse,
  useClearPreferences,
  useCourses,
  useEmployeeLearning,
  useInterview,
  usePreferences,
  useSavePreferences,
  useUpdateAssignment,
} from '@/features/workforce/api'
import { domainLabel, locationLabel } from '@/lib/format'

const DOMAINS: Domain[] = [
  'bfsi',
  'healthcare',
  'retail',
  'manufacturing',
  'public_sector',
  'education',
  'telecom',
  'logistics',
]
const LOCATIONS: Location[] = [
  'hyderabad',
  'bengaluru',
  'pune',
  'chennai',
  'remote_india',
  'usa',
  'uk',
]
const SELECT = 'border-input bg-background h-9 rounded-md border px-2 text-sm'

function Box({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="bg-surface space-y-3 rounded-xl border p-4" aria-label={title}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

/** What work the person would like, recorded by HR with consent (ADR 031). */
export function PreferencesPanel({ employeeId }: { employeeId: string }) {
  const role = useAuth().user?.role
  const canEdit = role === 'admin' || role === 'hr'
  const prefs = usePreferences(employeeId)
  const skills = useSkills()
  const save = useSavePreferences(employeeId)
  const clear = useClearPreferences(employeeId)
  const [editing, setEditing] = useState(false)
  const [domains, setDomains] = useState<Domain[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [consent, setConsent] = useState(false)
  const p = prefs.data

  const start = () => {
    setDomains(p?.domains ?? [])
    setLocations(p?.locations ?? [])
    setSkillIds(p?.skill_ids ?? [])
    setConsent(false)
    setEditing(true)
  }
  return (
    <Box title="Work they would like" icon={<Heart className="size-4" aria-hidden />}>
      {!editing &&
        (p ? (
          <div className="space-y-1 text-sm">
            {p.domains.length > 0 && <p>Areas: {p.domains.map(domainLabel).join(', ')}</p>}
            {p.skill_names.length > 0 && <p>Skills to use: {p.skill_names.join(', ')}</p>}
            {p.locations.length > 0 && (
              <p>Locations: {p.locations.map(locationLabel).join(', ')}</p>
            )}
            <p className="text-muted-foreground text-xs">
              Shown to managers next to a match; never changes the score.
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Nothing recorded.</p>
        ))}
      {canEdit && !editing && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={start}>
            {p ? 'Change' : 'Record preferences'}
          </Button>
          {p && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => clear.mutate()}
              disabled={clear.isPending}
            >
              Remove
            </Button>
          )}
        </div>
      )}
      {editing && (
        <form
          aria-label="Preferences"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate(
              { domains, locations, skill_ids: skillIds, consent },
              { onSuccess: () => setEditing(false) },
            )
          }}
        >
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1 text-xs font-semibold">Areas</legend>
            {DOMAINS.map((d) => (
              <label key={d} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={domains.includes(d)}
                  onChange={() => setDomains(toggle(domains, d))}
                />
                {domainLabel(d)}
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1 text-xs font-semibold">Locations</legend>
            {LOCATIONS.map((l) => (
              <label key={l} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={locations.includes(l)}
                  onChange={() => setLocations(toggle(locations, l))}
                />
                {locationLabel(l)}
              </label>
            ))}
          </fieldset>
          <div className="space-y-1">
            <select
              className={`${SELECT} w-full`}
              aria-label="Add a skill they want to use"
              value=""
              onChange={(e) => e.target.value && setSkillIds(toggle(skillIds, e.target.value))}
            >
              <option value="">Add a skill they want to use…</option>
              {(skills.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="flex flex-wrap gap-1">
              {skillIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="bg-muted rounded-full px-2 py-0.5 text-xs"
                  onClick={() => setSkillIds(toggle(skillIds, id))}
                >
                  {skills.data?.find((s) => s.id === id)?.name ?? id} ×
                </button>
              ))}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            The person agreed these are recorded and shown to managers
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!consent || save.isPending}>
              Save preferences
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
          {save.isError && <ErrorState error={save.error} />}
        </form>
      )}
    </Box>
  )
}

const STATUS_LABELS: Record<LearningStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  done: 'Done',
  dropped: 'Dropped',
}

/** The person's courses, and assigning a new one (ADR 031). */
export function LearningPanel({ employeeId }: { employeeId: string }) {
  const plan = useEmployeeLearning(employeeId)
  const courses = useCourses()
  const assign = useAssignCourse(employeeId)
  const update = useUpdateAssignment()
  const [course, setCourse] = useState('')
  const [due, setDue] = useState('')
  const taken = new Set((plan.data ?? []).map((a) => a.course.id))
  return (
    <Box title="Learning plan" icon={<GraduationCap className="size-4" aria-hidden />}>
      {(plan.data ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No courses yet.</p>
      ) : (
        <ul className="-my-1 divide-y" aria-label="Courses in the plan">
          {(plan.data ?? []).map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <span>
                {a.course.name}{' '}
                <span className="text-muted-foreground text-xs">
                  · {a.course.skill_name} up to {a.course.reaches_level}/5
                </span>
                {a.overdue && (
                  <StatusBadge tone="attention" className="ml-2">
                    Overdue
                  </StatusBadge>
                )}
              </span>
              <select
                className={SELECT}
                aria-label={`Status of ${a.course.name}`}
                value={a.status}
                onChange={(e) =>
                  update.mutate({ id: a.id, status: e.target.value as LearningStatus })
                }
              >
                {(Object.keys(STATUS_LABELS) as LearningStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
      <form
        aria-label="Assign a course"
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          assign.mutate(
            { course_id: course, due_date: due || null },
            { onSuccess: () => setCourse('') },
          )
        }}
      >
        <select
          className={SELECT}
          aria-label="Course"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          <option value="">Choose a course…</option>
          {(courses.data ?? [])
            .filter((c) => !taken.has(c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.skill_name})
              </option>
            ))}
        </select>
        <div className="space-y-1">
          <Label htmlFor={`due-${employeeId}`} className="text-xs">
            Due
          </Label>
          <Input
            id={`due-${employeeId}`}
            type="date"
            className="h-9"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" disabled={!course || assign.isPending}>
          Assign course
        </Button>
      </form>
      {(assign.isError || update.isError) && <ErrorState error={assign.error ?? update.error} />}
      <p className="text-muted-foreground text-xs">
        When a course is done, its skill is suggested on the profile for HR to accept at a level.
      </p>
    </Box>
  )
}

/** Questions for an interview that check the candidate's skill gaps for a task (ADR 031). */
export function InterviewPanel({
  candidateId,
  tasks,
}: {
  candidateId: string
  tasks: { task_id: string; task_code: string; title: string }[]
}) {
  const ask = useInterview(candidateId)
  const [taskId, setTaskId] = useState(tasks[0]?.task_id ?? '')
  if (tasks.length === 0) return null
  return (
    <Box title="Interview questions" icon={<MessageSquareText className="size-4" aria-hidden />}>
      <div className="flex flex-wrap gap-2">
        <select
          className={SELECT}
          aria-label="Task to interview for"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
        >
          {tasks.map((t) => (
            <option key={t.task_id} value={t.task_id}>
              {t.task_code} · {t.title}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={() => ask.mutate(taskId)} disabled={!taskId || ask.isPending}>
          {ask.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Suggest questions
        </Button>
      </div>
      {ask.isError && <ErrorState error={ask.error} />}
      {ask.data && (
        <div className="space-y-2 text-sm">
          <ul className="text-muted-foreground list-disc pl-5 text-xs" aria-label="Gaps to check">
            {ask.data.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          <ol className="list-decimal space-y-2 pl-5" aria-label="Questions">
            {ask.data.questions.map((q, i) => (
              <li key={i}>
                <span className="text-muted-foreground text-xs">{q.skill}: </span>
                {q.question}
                <span className="text-muted-foreground block text-xs">
                  Listen for: {q.listen_for}
                </span>
              </li>
            ))}
          </ol>
          {ask.data.source === 'template' && (
            <p className="text-muted-foreground text-xs">
              Standard questions: the assistant was not available.
            </p>
          )}
        </div>
      )}
    </Box>
  )
}

/** What the person said they would like that this task offers (shown, never scored). */
export function WantsBadges({ wants }: { wants?: string[] }) {
  if (!wants || wants.length === 0) return null
  return (
    <p className="flex flex-wrap gap-1" aria-label="Would like this work">
      {wants.map((w) => (
        <StatusBadge key={w} tone="info">
          <Heart className="mr-1 inline size-3" aria-hidden />
          {w}
        </StatusBadge>
      ))}
    </p>
  )
}
