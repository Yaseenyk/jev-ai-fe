import { ArrowLeft, FileText, Loader2, ShieldCheck, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'

import type { Level } from '@/api/types'
import { ErrorState } from '@/components/QueryStates'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { LEVEL_TITLES, locationLabel } from '@/lib/format'

const SOURCES = ['Naukri', 'LinkedIn', 'Referral', 'Job portal', 'Walk-in', 'Campus']
const LOCATIONS = ['hyderabad', 'bengaluru', 'pune', 'chennai', 'remote_india', 'usa', 'uk']

export default function UploadResumePage() {
  const allowed = useManagesPeople()
  const [params] = useSearchParams()
  const requestId = params.get('request')
  const extract = useExtractResume()
  const [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState('Naukri')
  if (!allowed) return <Navigate to="/tasks" replace />

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to={requestId ? `/hiring-requests/${requestId}` : '/candidates'}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />{' '}
        {requestId ? 'Back to the request' : 'All candidates'}
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">Upload a resume</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          The text is read in our own code. Personal details (name, email, phone, address, links,
          date of birth) are removed before ChatGPT sees anything; it only turns the professional
          part into fields you check here.
        </p>
      </header>
      {requestId && <RequestBanner id={requestId} />}

      {!extract.data ? (
        <Panel title="1. Choose the resume">
          <label
            htmlFor="resume"
            className="hover:bg-accent/40 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center"
          >
            <FileText className="text-muted-foreground size-8" aria-hidden />
            <span className="font-medium">{file ? file.name : 'PDF or Word file'}</span>
            <span className="text-muted-foreground text-xs">
              Downloaded from Naukri, LinkedIn or email
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
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="source">Where it came from</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="source" className="w-44">
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
            </div>
            <Button
              disabled={!file || extract.isPending}
              onClick={() => file && extract.mutate(file)}
            >
              {extract.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Upload aria-hidden />
              )}
              Read the resume
            </Button>
          </div>
          {extract.isError && <ErrorState error={extract.error} />}
        </Panel>
      ) : (
        <ReviewForm
          extraction={extract.data}
          source={source}
          requestId={requestId}
          onRestart={() => {
            extract.reset()
            setFile(null)
          }}
        />
      )}
    </div>
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
  onRestart,
}: {
  extraction: Extraction
  source: string
  requestId: string | null
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
  const set = <K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }))

  const save = () =>
    create.mutate(
      {
        full_name: contact.full_name.trim(),
        email: contact.email.trim() || undefined,
        phone: contact.phone.trim() || undefined,
        source,
        consent: true,
        profile,
        extraction_id: x.extraction_id,
      },
      {
        onSuccess: (c) =>
          void navigate(requestId ? `/hiring-requests/${requestId}` : `/candidates/${c.id}`),
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

      <Panel title="2. Contact details (kept for HR only, never sent to ChatGPT)">
        <div className="grid gap-3 sm:grid-cols-3">
          {(['full_name', 'email', 'phone'] as const).map((k) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`c-${k}`}>
                {k === 'full_name' ? 'Full name' : k === 'email' ? 'Email' : 'Phone'}
              </Label>
              <Input
                id={`c-${k}`}
                value={contact[k]}
                onChange={(e) => setContact((c) => ({ ...c, [k]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="3. Check what was read">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="p-designation">Role</Label>
            <Input
              id="p-designation"
              value={profile.designation}
              onChange={(e) => set('designation', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-level">Level</Label>
            <Select value={profile.level} onValueChange={(v) => set('level', v as Level)}>
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-years">Years of experience</Label>
            <Input
              id="p-years"
              type="number"
              min={0}
              max={40}
              step={0.5}
              value={profile.years_experience}
              onChange={(e) => set('years_experience', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-notice">Notice period (days)</Label>
            <Input
              id="p-notice"
              type="number"
              min={0}
              max={180}
              value={profile.notice_days}
              onChange={(e) => set('notice_days', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-location">Location</Label>
            <Select value={profile.location} onValueChange={(v) => set('location', v)}>
              <SelectTrigger id="p-location">
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
        </div>
        <div className="mt-3 space-y-1.5">
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
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="p-summary">Summary</Label>
          <Textarea
            id="p-summary"
            rows={3}
            value={profile.summary}
            onChange={(e) => set('summary', e.target.value)}
          />
        </div>
      </Panel>

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
      <div className="flex gap-2">
        <Button disabled={!consent || !contact.full_name.trim() || create.isPending} onClick={save}>
          {create.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Save candidate
        </Button>
        <Button variant="outline" onClick={onRestart}>
          Use another file
        </Button>
      </div>
    </div>
  )
}
