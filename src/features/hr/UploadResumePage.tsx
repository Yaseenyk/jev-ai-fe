import {
  FileText,
  Loader2,
  MessageCircleQuestion,
  ScanText,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'

import { ApiError } from '@/api/client'
import type { Level } from '@/api/types'
import { Field } from '@/components/FormSheet'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState } from '@/components/QueryStates'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import { useCreateCandidate, useExtractResume, useHiringRequest } from '@/features/hr/api'
import type { CandidateProfile, Extraction } from '@/features/hr/types'
import { Panel, SkillChip } from '@/features/hr/ui'
import { useTask } from '@/features/tasks/api'
import { LEVEL_TITLES, locationLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

const isScan = (error: Error) =>
  error instanceof ApiError && error.problem?.code === 'scanned_needs_consent'

const SOURCES = ['Naukri', 'LinkedIn', 'Referral', 'Job portal', 'Walk-in', 'Campus']
const LOCATIONS = ['hyderabad', 'bengaluru', 'pune', 'chennai', 'remote_india', 'usa', 'uk']

export default function UploadResumePage() {
  const allowed = useManagesPeople()
  const [params] = useSearchParams()
  const requestId = params.get('request')
  const taskId = params.get('task')
  const extract = useExtractResume()
  const [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState('Naukri')
  if (!allowed) return <Navigate to="/tasks" replace />

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        back={
          requestId
            ? { to: `/hiring-requests/${requestId}`, label: 'Back to the request' }
            : taskId
              ? { to: `/tasks/${taskId}`, label: 'Back to the task' }
              : { to: '/candidates', label: 'All candidates' }
        }
        title="Upload a resume"
        description="Our own code reads the file and removes personal details (name, email, phone, address, links, date of birth) before ChatGPT sees anything. ChatGPT only turns the professional part into fields you check here."
      />
      {requestId && <RequestBanner id={requestId} />}
      {taskId && !requestId && <TaskBanner id={taskId} />}
      <Steps current={extract.data ? 2 : 1} />

      {!extract.data ? (
        <Panel title="Choose the resume">
          <label
            htmlFor="resume"
            className="hover:bg-accent/40 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center"
          >
            <FileText className="text-muted-foreground size-8" aria-hidden />
            <span className="font-medium">
              {file ? file.name : 'Click to choose a PDF or Word file'}
            </span>
            <span className="text-muted-foreground text-xs">
              Downloaded from Naukri, LinkedIn or email. Up to 5 MB.
            </span>
          </label>
          <input
            id="resume"
            type="file"
            accept=".pdf,.doc,.docx"
            className="sr-only"
            aria-label="Resume file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="source" label="Where it came from" help="Recorded with the candidate.">
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {extract.isError &&
            (isScan(extract.error) ? (
              <Alert className="mt-4">
                <ScanText />
                <AlertTitle>This is a scanned file</AlertTitle>
                <AlertDescription>
                  <p>
                    It has no text our code can read, so personal details cannot be removed first.
                    Reading it sends the page images, including the name, contact details and photo,
                    to ChatGPT.
                  </p>
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={!file || extract.isPending}
                    onClick={() => file && extract.mutate({ file, allowImages: true })}
                  >
                    Send the scanned pages to ChatGPT
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="mt-4">
                <ErrorState error={extract.error} />
              </div>
            ))}
          <div className="mt-4 flex justify-end border-t pt-4">
            <Button
              disabled={!file || extract.isPending}
              onClick={() => file && extract.mutate({ file })}
            >
              {extract.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Upload aria-hidden />
              )}
              Read the resume
            </Button>
          </div>
        </Panel>
      ) : (
        <ReviewForm
          extraction={extract.data}
          source={source}
          requestId={requestId}
          taskId={taskId}
          onRestart={() => {
            extract.reset()
            setFile(null)
          }}
        />
      )}
    </div>
  )
}

function Steps({ current }: { current: 1 | 2 }) {
  const steps = ['Choose the resume', 'Check the details and save']
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Steps">
      {steps.map((label, i) => {
        const n = i + 1
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span className="bg-border h-px w-8" aria-hidden />}
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full border text-xs tabular-nums',
                n === current
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground',
              )}
              aria-hidden
            >
              {n}
            </span>
            <span
              className={cn(n === current ? 'font-medium' : 'text-muted-foreground')}
              aria-current={n === current ? 'step' : undefined}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function LaterBox({
  id,
  checked,
  onChange,
  text,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  text: string
}) {
  return (
    <span className="block space-y-1">
      <span className="text-band-review-foreground block">{text}</span>
      <label htmlFor={id} className="flex items-center gap-1.5">
        <input
          id={id}
          type="checkbox"
          className="size-3.5"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        Not known yet: I will ask and update it later
      </label>
    </span>
  )
}

function TaskBanner({ id }: { id: string }) {
  const task = useTask(id)
  if (!task.data) return null
  return (
    <p className="bg-accent/50 rounded-lg px-3 py-2 text-sm">
      Checking this person against <strong>{task.data.code}</strong> · {task.data.title}. You see
      how well they fit on the task&rsquo;s page after saving.
    </p>
  )
}

function RequestBanner({ id }: { id: string }) {
  const request = useHiringRequest(id)
  if (!request.data) return null
  return (
    <p className="bg-accent/50 rounded-lg px-3 py-2 text-sm">
      For the request on <strong>{request.data.task_code}</strong> · {request.data.task_title}. The
      candidate is scored against it after saving.
    </p>
  )
}

function ReviewForm({
  extraction: x,
  source,
  requestId,
  taskId,
  onRestart,
}: {
  extraction: Extraction
  source: string
  requestId: string | null
  taskId: string | null
  onRestart: () => void
}) {
  const create = useCreateCandidate()
  const navigate = useNavigate()
  const [contact, setContact] = useState({
    full_name: x.contact.full_name ?? '',
    email: x.contact.email ?? '',
    phone: x.contact.phone ?? '',
  })
  const [profile, setProfile] = useState<CandidateProfile>(x.profile)
  const [consent, setConsent] = useState(false)
  // What the resume did not say starts empty: HR asks the candidate (nothing is guessed silently).
  const asked = x.profile.unconfirmed ?? []
  const [notice, setNotice] = useState(
    asked.includes('notice_days') ? '' : String(x.profile.notice_days),
  )
  const [location, setLocation] = useState(asked.includes('location') ? '' : x.profile.location)
  const [levelChecked, setLevelChecked] = useState(!asked.includes('level'))
  const [noticeLater, setNoticeLater] = useState(false)
  const [locationLater, setLocationLater] = useState(false)
  const noticeOk = noticeLater || (notice !== '' && Number(notice) >= 0 && Number(notice) <= 180)
  const locationOk = locationLater || location !== ''
  const toAsk = [
    ...(asked.includes('notice_days') ? ['notice period'] : []),
    ...(asked.includes('location') ? ['where they live or want to work'] : []),
    ...(!profile.cost_band ? ['expected pay band'] : []),
  ]
  const set = <K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }))
  const missing = !contact.full_name.trim()
    ? 'Enter the full name to save.'
    : !noticeOk
      ? 'Enter the notice period, or tick “Not known yet”, to save.'
      : !locationOk
        ? 'Choose a location, or tick “Not known yet”, to save.'
        : !consent
          ? 'Confirm the candidate’s consent to save.'
          : null

  const save = () =>
    create.mutate(
      {
        full_name: contact.full_name.trim(),
        email: contact.email.trim() || undefined,
        phone: contact.phone.trim() || undefined,
        source,
        consent: true,
        profile: {
          ...profile,
          notice_days: noticeLater || notice === '' ? x.profile.notice_days : Number(notice),
          location: locationLater || location === '' ? x.profile.location : location,
          unconfirmed: [
            ...(noticeLater ? (['notice_days'] as const) : []),
            ...(locationLater ? (['location'] as const) : []),
            ...(levelChecked ? [] : (['level'] as const)),
          ],
        },
        extraction_id: x.extraction_id,
        task_id: taskId ?? undefined,
      },
      {
        onSuccess: (c) =>
          void navigate(
            requestId
              ? `/hiring-requests/${requestId}`
              : taskId
                ? `/tasks/${taskId}`
                : `/candidates/${c.id}`,
            {
              state: { uploaded: c.id },
            },
          ),
      },
    )

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldCheck />
        <AlertTitle>Removed before ChatGPT</AlertTitle>
        <AlertDescription>
          <p className="flex flex-wrap gap-1">
            {x.removed.map((r) => (
              <SkillChip key={r}>{r}</SkillChip>
            ))}
          </p>
          {x.notes.map((n) => (
            <p key={n} className="mt-1 text-xs">
              {n}
            </p>
          ))}
        </AlertDescription>
      </Alert>

      {toAsk.length > 0 && (
        <section
          aria-label="Ask the candidate"
          className="border-band-review-foreground/20 bg-band-review/30 flex gap-3 rounded-xl border p-4"
        >
          <MessageCircleQuestion
            className="text-band-review-foreground mt-0.5 size-5 shrink-0"
            aria-hidden
          />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Ask the candidate before you save</p>
            <p>
              The resume does not say: <strong>{toAsk.join(', ')}</strong>. Nothing is guessed: fill
              these in below, or mark them “Not known yet” and the match will say what is still to
              confirm.
            </p>
          </div>
        </section>
      )}

      <Panel title="Contact details" label="Contact details">
        <p className="text-muted-foreground mb-3 text-xs">
          Kept for HR only and never sent to ChatGPT. Managers do not see them.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="c-full_name" label="Full name" required wide>
            <Input
              id="c-full_name"
              placeholder="e.g. Priya Sharma"
              value={contact.full_name}
              onChange={(e) => setContact((c) => ({ ...c, full_name: e.target.value }))}
            />
          </Field>
          <Field id="c-email" label="Email">
            <Input
              id="c-email"
              type="email"
              value={contact.email}
              onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
            />
          </Field>
          <Field id="c-phone" label="Phone">
            <Input
              id="c-phone"
              value={contact.phone}
              onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
            />
          </Field>
        </div>
      </Panel>

      <Panel title="Check what was read" label="Check what was read">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="p-designation" label="Role" wide>
            <Input
              id="p-designation"
              value={profile.designation}
              onChange={(e) => set('designation', e.target.value)}
            />
          </Field>
          <Field
            id="p-level"
            label="Level"
            help={
              levelChecked ? undefined : (
                <span className="text-band-review-foreground">
                  Estimated from {profile.years_experience} years of experience. Check it.{' '}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => setLevelChecked(true)}
                  >
                    Looks right
                  </button>
                </span>
              )
            }
          >
            <Select
              value={profile.level}
              onValueChange={(v) => {
                set('level', v as Level)
                setLevelChecked(true)
              }}
            >
              <SelectTrigger id="p-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LEVEL_TITLES) as Level[]).map((l) => (
                  <SelectItem key={l} value={l}>
                    {LEVEL_TITLES[l]} ({l})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="p-years" label="Years of experience">
            <Input
              id="p-years"
              type="number"
              min={0}
              max={40}
              step={0.5}
              value={profile.years_experience}
              onChange={(e) => set('years_experience', Number(e.target.value))}
            />
          </Field>
          <Field
            id="p-location"
            label="Location"
            required={asked.includes('location')}
            help={
              asked.includes('location') && (
                <LaterBox
                  id="p-location-later"
                  checked={locationLater}
                  onChange={(v) => {
                    setLocationLater(v)
                    if (v) setLocation('')
                  }}
                  text="Not in the resume. Ask the candidate."
                />
              )
            }
          >
            <Select value={location} disabled={locationLater} onValueChange={(v) => setLocation(v)}>
              <SelectTrigger id="p-location">
                <SelectValue placeholder={locationLater ? 'Not known yet' : 'Choose a location'} />
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
            id="p-notice"
            label="Notice period (days)"
            required={asked.includes('notice_days')}
            help={
              asked.includes('notice_days') ? (
                <LaterBox
                  id="p-notice-later"
                  checked={noticeLater}
                  onChange={(v) => {
                    setNoticeLater(v)
                    if (v) setNotice('')
                  }}
                  text="Not in the resume. Ask the candidate; 0 if they can join now."
                />
              ) : (
                'When they can join. Used as their availability when matching.'
              )
            }
          >
            <Input
              id="p-notice"
              type="number"
              min={0}
              max={180}
              placeholder={noticeLater ? 'Not known yet' : 'e.g. 30'}
              disabled={noticeLater}
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
            />
          </Field>
          <Field
            id="p-band"
            label="Expected pay band"
            help="Ask the candidate. Never read from the resume. Until it is entered, the budget is not checked and the match says so."
          >
            <Select
              value={profile.cost_band ?? 'none'}
              onValueChange={(v) => set('cost_band', v === 'none' ? null : v)}
            >
              <SelectTrigger id="p-band">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not known yet</SelectItem>
                {['A', 'B', 'C', 'D', 'E'].map((b) => (
                  <SelectItem key={b} value={b}>
                    Band {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-4 space-y-1.5">
          <p className="text-sm font-medium">Skills (matched to our skills list)</p>
          <p className="flex flex-wrap gap-1">
            {profile.skills.map((k) => (
              <span
                key={k.skill_id}
                className="bg-surface inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs"
              >
                {k.skill_name} {k.proficiency}/5
                <button
                  type="button"
                  aria-label={`Remove ${k.skill_name}`}
                  onClick={() =>
                    set(
                      'skills',
                      profile.skills.filter((s) => s.skill_id !== k.skill_id),
                    )
                  }
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </p>
          {x.unmatched_skills.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Not in our skills list (not used for matching): {x.unmatched_skills.join(', ')}
            </p>
          )}
        </div>
        <div className="mt-4">
          <Field id="p-summary" label="Summary">
            <Textarea
              id="p-summary"
              rows={3}
              value={profile.summary}
              onChange={(e) => set('summary', e.target.value)}
            />
          </Field>
        </div>
      </Panel>

      <div className="bg-surface space-y-4 rounded-xl border p-4">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          The candidate agreed that we keep their resume for up to one year to match them to roles.
        </label>
        {create.isError && <ErrorState error={create.error} />}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
          {missing && <span className="text-muted-foreground mr-auto text-sm">{missing}</span>}
          <Button variant="outline" onClick={onRestart}>
            Use another file
          </Button>
          <Button disabled={!!missing || create.isPending} onClick={save}>
            {create.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Save candidate
          </Button>
        </div>
      </div>
    </div>
  )
}
