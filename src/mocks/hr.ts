// Mock API for the planned HR endpoints (docs/06: Employees, Import, HR overview, Candidates).
// Dummy data from backend/scripts/export_hr_mock.py; same task ids as demo.json.
import { HttpResponse, bypass, http } from 'msw'

import type { Task } from '@/api/types'

import type {
  CandidateProfile,
  EmployeeCreate,
  CandidateCreate,
  CandidateDetail,
  CandidateMatch,
  CandidateStatus,
  CandidateSummary,
  EmployeeDetail,
  EmployeeSkill,
  EmployeeSummary,
  EmployeeUpdate,
  Extraction,
  AppNotification,
  HiringRequestDetail,
  HiringRequestSummary,
  RequestStatus,
  Submission,
  Verdict,
  HrSummary,
  ImportKind,
  ImportPreview,
  TaskMatch,
} from '@/features/hr/types'
import { MAX_SUBMISSIONS } from '@/features/hr/types'
import type { Db } from '@/mocks/db'
import hrData from '@/mocks/data/hr.json'

interface MockCandidate extends Omit<
  CandidateDetail,
  | 'top_skills'
  | 'best_match'
  | 'designation'
  | 'level'
  | 'years_experience'
  | 'location'
  | 'history'
  | 'consent_at'
> {
  notice_days: number
  matches: TaskMatch[]
  history?: CandidateDetail['history']
  consent_at?: string
}

const data = hrData as unknown as {
  employees: EmployeeDetail[]
  candidates: MockCandidate[]
}

const api = (path: string) => `*/api/v1${path}`
const DAY = 86_400_000

function problem(status: number, code: string, detail: string) {
  return HttpResponse.json(
    { type: 'about:blank', title: code, status, code, detail },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

const IMPORT_COLUMNS: Record<ImportKind, string[]> = {
  clients: ['code', 'name', 'domain', 'timezone'],
  employees: [
    'employee_code',
    'full_name',
    'designation',
    'level',
    'practice',
    'years_experience',
    'location',
    'cost_band',
  ],
  employee_skills: ['employee_code', 'skill', 'proficiency', 'years', 'last_used'],
}
const LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')))
}

export function createHrHandlers(db: Db, currentUser: () => { email: string; role: string }) {
  let employees: EmployeeDetail[] = structuredClone(data.employees)
  let candidates: MockCandidate[] = structuredClone(data.candidates).map((c) => ({
    ...c,
    consent_at: c.uploaded_at,
    history: [{ at: c.uploaded_at, by: 'hr@srtm.local', status: 'new', note: 'Resume uploaded' }],
  }))
  const previews = new Map<string, ImportPreview>()
  const extractions = new Map<string, { sample: MockCandidate }>()
  const skillNames = new Map(db.skills.map((s) => [s.name.toLowerCase(), s]))

  const summary = (e: EmployeeDetail): EmployeeSummary => ({
    id: e.id,
    employee_code: e.employee_code,
    full_name: e.full_name,
    designation: e.designation,
    level: e.level,
    location: e.location,
    cost_band: e.cost_band,
    current_allocation_pct: e.current_allocation_pct,
    available_from: e.available_from,
    skill_count: e.skills.length,
  })

  const candidateSummary = (c: MockCandidate): CandidateSummary => ({
    id: c.id,
    full_name: c.full_name,
    designation: c.profile.designation,
    level: c.profile.level,
    years_experience: c.profile.years_experience,
    location: c.profile.location,
    status: c.status,
    source: c.source,
    uploaded_at: c.uploaded_at,
    delete_after: c.delete_after,
    top_skills: [...c.profile.skills]
      .sort((a, b) => b.proficiency - a.proficiency)
      .slice(0, 4)
      .map((s) => s.skill_name),
    best_match: c.matches[0]
      ? { task_code: c.matches[0].task_code, score: c.matches[0].score }
      : null,
  })

  const candidateDetail = (c: MockCandidate): CandidateDetail => ({
    ...candidateSummary(c),
    email: c.email,
    phone: c.phone,
    consent_recorded_by: c.consent_recorded_by,
    consent_at: c.consent_at ?? c.uploaded_at,
    profile: c.profile,
    history: [...(c.history ?? [])].reverse(),
  })

  const noInternalFit = () =>
    db.tasks
      .filter((t) => t.status === 'open' || t.status === 'matching' || t.status === 'shortlisted')
      .flatMap((t) => {
        const run = db.runsForTask(t.id)[0]
        const items = run ? (db.shortlist(run.id) ?? []) : []
        if (!run || items.some((i) => i.band === 'shortlist' || i.band === 'review')) return []
        const best = items.reduce<number | null>((m, i) => Math.max(m ?? 0, i.rank_score), null)
        return [
          {
            task_id: t.id,
            code: t.code,
            title: t.title,
            client_code: t.client_code,
            best_internal_score: best,
          },
        ]
      })

  // --- Hiring requests: seeded at every stage so both logins have something to show --------
  interface MockRequest extends HiringRequestSummary {
    submissions: (Omit<Submission, 'candidate' | 'match'> & { candidate_id: string })[]
  }
  interface MockNotification extends AppNotification {
    to: string // 'hr' = every HR user; otherwise one manager's email
  }
  const MANAGER = 'manager1@srtm.local'
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
  const taskByCode = (code: string) => db.tasks.find((t) => t.code === code)
  const matchesFor = (taskId: string) =>
    candidates
      .flatMap((c) => {
        const m = c.matches.find((x) => x.task_id === taskId)
        return m ? [{ c, m }] : []
      })
      .sort((a, b) => b.m.score - a.m.score)

  let requests: MockRequest[] = []
  let notifications: MockNotification[] = []
  let nextId = 1
  const notify = (
    to: MockNotification['to'],
    n: Omit<AppNotification, 'id' | 'read' | 'created_at'>,
    at?: string,
  ) => {
    notifications = [
      { ...n, id: `n-${nextId++}`, to, read: false, created_at: at ?? new Date().toISOString() },
      ...notifications,
    ]
  }
  const seed = (
    code: string,
    status: RequestStatus,
    sent: number,
    verdicts: (Verdict | null)[],
    ago: number,
  ) => {
    const task = taskByCode(code)
    if (!task) return
    const picks = matchesFor(task.id).slice(0, sent)
    const req: MockRequest = {
      id: `req-${nextId++}`,
      task_id: task.id,
      task_code: task.code,
      task_title: task.title,
      client_code: task.client_code,
      requested_by: MANAGER,
      requested_at: hoursAgo(ago),
      wanted: 5,
      note: 'Nobody internal fits. Client wants someone within a month.',
      status,
      sent_count: picks.length,
      fit_count: verdicts.filter((v) => v === 'fit').length,
      submissions: picks.map(({ c }, i) => ({
        candidate_id: c.id,
        hr_note: i === 0 ? 'Strongest on the must-have skills.' : '',
        verdict: verdicts[i] ?? null,
        verdict_note:
          verdicts[i] === 'not_fit'
            ? 'Too junior for this client.'
            : verdicts[i]
              ? 'Good fit, please proceed.'
              : '',
        decided_at: verdicts[i] ? hoursAgo(ago - 20) : null,
      })),
    }
    requests = [req, ...requests]
    const link = `/hiring-requests/${req.id}`
    notify(
      'hr',
      {
        kind: 'request_new',
        title: `New request for ${task.code}`,
        body: `${MANAGER} needs candidates for "${task.title}"`,
        link,
      },
      hoursAgo(ago),
    )
    if (sent)
      notify(
        MANAGER,
        {
          kind: 'request_sent',
          title: `HR sent ${sent} candidates for ${task.code}`,
          body: 'Mark each one fit or not a fit.',
          link,
        },
        hoursAgo(ago - 4),
      )
    if (status === 'reviewed')
      notify(
        'hr',
        {
          kind: 'request_reviewed',
          title: `Manager decided on ${task.code}`,
          body: `${req.fit_count} fit — contact them next.`,
          link,
        },
        hoursAgo(ago - 20),
      )
  }
  seed('TSK-0011', 'reviewed', 3, ['fit', 'fit', 'not_fit'], 52)
  seed('TSK-0013', 'sent', 4, [], 30)
  seed('TSK-0020', 'new', 0, [], 3)
  // Older events are read; the latest ones stay unread.
  notifications = notifications.map((n, i) => ({ ...n, read: i > 2 }))

  const requestSummary = (r: MockRequest): HiringRequestSummary => {
    return {
      id: r.id,
      task_id: r.task_id,
      task_code: r.task_code,
      task_title: r.task_title,
      client_code: r.client_code,
      requested_by: r.requested_by,
      requested_at: r.requested_at,
      wanted: r.wanted,
      note: r.note,
      status: r.status,
      sent_count: r.submissions.length,
      fit_count: r.submissions.filter((s) => s.verdict === 'fit').length,
    }
  }
  const requestDetail = (r: MockRequest): HiringRequestDetail => ({
    ...requestSummary(r),
    submissions: r.submissions.flatMap((s) => {
      const c = candidates.find((x) => x.id === s.candidate_id)
      const m = c?.matches.find((x) => x.task_id === r.task_id)
      if (!c || !m) return []
      return [
        {
          hr_note: s.hr_note,
          verdict: s.verdict,
          verdict_note: s.verdict_note,
          decided_at: s.decided_at,
          // Managers see professional details only: first name, no email or phone (docs/08).
          candidate: {
            id: c.id,
            first_name: c.full_name.split(' ')[0] ?? c.full_name,
            designation: c.profile.designation,
            level: c.profile.level,
            years_experience: c.profile.years_experience,
            location: c.profile.location,
            notice_days: c.profile.notice_days,
            profile: c.profile,
          },
          match: m,
        },
      ]
    }),
  })
  const findRequest = (id: unknown) => requests.find((r) => r.id === id)
  const isHr = () => ['hr', 'admin'].includes(currentUser().role)
  const update = (id: string, change: (r: MockRequest) => MockRequest) => {
    requests = requests.map((r) => (r.id === id ? change(r) : r))
    return findRequest(id)
  }

  // Real-API mode: tasks created after the demo data are read from the real backend and scored
  // here with the same simple ranking as the dummy data (scripts/export_hr_mock.py).
  const realTasks = new Map<string, Task>()
  const taskFor = async (id: string, request: Request): Promise<Task | undefined> => {
    const known = db.tasks.find((t) => t.id === id) ?? realTasks.get(id)
    if (known) return known
    const res = await fetch(
      bypass(
        new Request(new URL(`/api/v1/tasks/${id}`, request.url), { headers: request.headers }),
      ),
    )
    if (!res.ok) return undefined
    const task = (await res.json()) as Task
    realTasks.set(id, task)
    return task
  }
  const LEVEL_ORDER = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']
  const matchFor = (c: MockCandidate, task: Task): TaskMatch | undefined => {
    const cached = c.matches.find((m) => m.task_id === task.id)
    if (cached) return cached
    if (
      task.location_constraint.length > 0 &&
      task.work_mode !== 'remote' &&
      !task.location_constraint.includes(c.profile.location as Task['location_constraint'][number])
    ) {
      return undefined
    }
    const have = new Map(c.profile.skills.map((k) => [k.skill_id, k.proficiency]))
    const met = (r: Task['requirements'][number]) =>
      (have.get(r.skill.id) ?? 0) >= r.min_proficiency
    const must = task.requirements.filter((r) => r.must_have)
    const nice = task.requirements.filter((r) => !r.must_have)
    const mustCov = must.length ? must.filter(met).length / must.length : 1
    const niceCov = nice.length ? nice.filter(met).length / nice.length : 1
    if (mustCov === 0) return undefined
    const gap = LEVEL_ORDER.indexOf(c.profile.level) - LEVEL_ORDER.indexOf(task.required_level)
    const domain = c.profile.domains.includes(task.domain) ? 1 : 0
    const score =
      Math.round(
        (0.5 * mustCov +
          0.2 * niceCov +
          0.2 * Math.max(0, 1 - 0.5 * Math.abs(gap)) +
          (0.1 * domain) / 3) *
          1000,
      ) / 1000
    const reasons = [`Has ${must.filter(met).length} of ${must.length} must-have skills`]
    reasons.push(
      gap === 0
        ? 'Level matches'
        : gap > 0
          ? `${gap} level(s) above the role`
          : `${-gap} level(s) below the role`,
    )
    const match: TaskMatch = {
      task_id: task.id,
      task_code: task.code,
      title: task.title,
      client_code: task.client_code,
      score,
      band: score >= 0.8 ? 'shortlist' : score >= 0.5 ? 'review' : 'hidden',
      must_have_coverage: Math.round(mustCov * 1000) / 1000,
      matched_skills: must.filter(met).map((r) => r.skill.name),
      missing_skills: must.filter((r) => !met(r)).map((r) => r.skill.name),
      reasons,
    }
    c.matches = [...c.matches, match]
    return match
  }

  return [
    // --- HR overview -------------------------------------------------------------------
    http.get(api('/hr/summary'), () => {
      const now = Date.now()
      const byStatus: HrSummary['candidates_by_status'] = {}
      for (const c of candidates) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1
      const body: HrSummary = {
        open_tasks: db.tasks.filter((t) => t.status !== 'filled' && t.status !== 'cancelled')
          .length,
        tasks_without_internal_fit: noInternalFit(),
        candidates_by_status: byStatus,
        due_for_deletion_30d: candidates.filter(
          (c) => c.delete_after && new Date(c.delete_after).getTime() - now < 30 * DAY,
        ).length,
        recent_candidates: [...candidates]
          .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
          .slice(0, 5)
          .map(candidateSummary),
      }
      return HttpResponse.json(body)
    }),

    // --- Employees -----------------------------------------------------------------------
    http.post(api('/employees'), async ({ request }) => {
      const body = (await request.json()) as EmployeeCreate
      const code = body.employee_code.trim().toUpperCase()
      if (employees.some((e) => e.employee_code === code)) {
        return problem(409, 'employee_exists', `Employee ${code} already exists`)
      }
      const made: EmployeeDetail = {
        ...body,
        id: crypto.randomUUID(),
        employee_code: code,
        timezone:
          body.location === 'usa'
            ? 'America/New_York'
            : body.location === 'uk'
              ? 'Europe/London'
              : 'Asia/Kolkata',
        work_mode_preference: 'hybrid',
        client_clearances: [],
        summary: '',
        skill_count: 0,
        skills: [],
        projects: [],
        leaves: [],
      }
      employees = [made, ...employees]
      return HttpResponse.json(made, { status: 201 })
    }),
    http.get(api('/employees'), ({ request }) => {
      const url = new URL(request.url)
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const level = url.searchParams.get('level')
      const location = url.searchParams.get('location')
      const items = employees
        .filter(
          (e) =>
            (!q ||
              e.full_name.toLowerCase().includes(q) ||
              e.employee_code.toLowerCase().includes(q) ||
              e.designation.toLowerCase().includes(q)) &&
            (!level || e.level === level) &&
            (!location || e.location === location),
        )
        .map(summary)
      return HttpResponse.json({ items, total: items.length, limit: items.length, offset: 0 })
    }),
    http.get(api('/employees/:id'), ({ params }) => {
      const e = employees.find((x) => x.id === params.id)
      return e ? HttpResponse.json(e) : problem(404, 'employee_not_found', 'Employee not found')
    }),
    http.patch(api('/employees/:id'), async ({ params, request }) => {
      const body = (await request.json()) as EmployeeUpdate
      if (
        body.current_allocation_pct !== undefined &&
        (body.current_allocation_pct < 0 || body.current_allocation_pct > 100)
      ) {
        return problem(422, 'invalid_request', 'current_allocation_pct: must be between 0 and 100')
      }
      employees = employees.map((e) => (e.id === params.id ? { ...e, ...body } : e))
      return HttpResponse.json(employees.find((e) => e.id === params.id))
    }),
    http.put(api('/employees/:id/skills'), async ({ params, request }) => {
      const skills = (await request.json()) as Omit<EmployeeSkill, 'skill_name'>[]
      const named = skills.map((s) => ({
        ...s,
        skill_name: db.skills.find((k) => k.id === s.skill_id)?.name ?? s.skill_id,
      }))
      employees = employees.map((e) => (e.id === params.id ? { ...e, skills: named } : e))
      return HttpResponse.json(employees.find((e) => e.id === params.id))
    }),
    http.post(api('/employees/:id/leaves'), async ({ params, request }) => {
      const body = (await request.json()) as { start_date: string; end_date: string }
      if (body.end_date < body.start_date) {
        return problem(422, 'invalid_request', 'end_date: must be on or after start_date')
      }
      const leave = { id: crypto.randomUUID(), ...body }
      employees = employees.map((e) =>
        e.id === params.id ? { ...e, leaves: [...e.leaves, leave] } : e,
      )
      return HttpResponse.json(leave, { status: 201 })
    }),
    http.delete(api('/employees/:id/leaves/:leaveId'), ({ params }) => {
      employees = employees.map((e) =>
        e.id === params.id ? { ...e, leaves: e.leaves.filter((l) => l.id !== params.leaveId) } : e,
      )
      return new HttpResponse(null, { status: 204 })
    }),

    // --- Import --------------------------------------------------------------------------
    http.post(api('/imports/preview'), async ({ request }) => {
      const form = await request.formData()
      const kind = form.get('kind') as ImportKind
      const file = form.get('file') as File
      const [header = [], ...lines] = parseCsv(await file.text())
      const columns = IMPORT_COLUMNS[kind]
      const missing = columns.filter((c) => !header.includes(c))
      if (missing.length) {
        return problem(422, 'import_columns', `Missing columns: ${missing.join(', ')}`)
      }
      const rows = lines.map((cells, i) => {
        const values = Object.fromEntries(header.map((h, j) => [h, cells[j] ?? '']))
        const errors: string[] = []
        for (const c of columns) if (!values[c]) errors.push(`${c} is empty`)
        if (values.level && !LEVELS.includes(values.level)) errors.push(`level must be L1–L6`)
        if (values.skill && !skillNames.has(values.skill.toLowerCase())) {
          errors.push(`unknown skill "${values.skill}"`)
        }
        if (values.proficiency && !/^[1-5]$/.test(values.proficiency)) {
          errors.push('proficiency must be 1–5')
        }
        const exists =
          kind === 'clients'
            ? false
            : employees.some((e) => e.employee_code === values.employee_code)
        if (kind === 'employee_skills' && values.employee_code && !exists) {
          errors.push(`no employee ${values.employee_code}`)
        }
        return {
          row: i + 2,
          values,
          action: exists ? ('update' as const) : ('create' as const),
          errors,
        }
      })
      const preview: ImportPreview = {
        preview_id: crypto.randomUUID(),
        kind,
        columns,
        rows,
        valid: rows.filter((r) => r.errors.length === 0).length,
        invalid: rows.filter((r) => r.errors.length > 0).length,
      }
      previews.set(preview.preview_id, preview)
      return HttpResponse.json(preview)
    }),
    http.post(api('/imports/:id/commit'), ({ params }) => {
      const preview = previews.get(String(params.id))
      if (!preview) return problem(404, 'preview_not_found', 'Upload the file again')
      const ok = preview.rows.filter((r) => r.errors.length === 0)
      return HttpResponse.json({
        created: ok.filter((r) => r.action === 'create').length,
        updated: ok.filter((r) => r.action === 'update').length,
        skipped: preview.invalid,
      })
    }),

    // --- Candidates ------------------------------------------------------------------------
    http.post(api('/candidates/extract'), async ({ request }) => {
      const form = await request.formData()
      const file = form.get('file') as File
      if (!/\.(pdf|docx?)$/i.test(file.name)) {
        return problem(422, 'unsupported_file', 'Upload a PDF or Word resume')
      }
      // Demo: a sample profile stands in for reading the file; the real API reads it in code.
      let hash = 0
      for (let i = 0; i < file.name.length; i++) hash += file.name.charCodeAt(i)
      const sample = data.candidates[hash % data.candidates.length]
      if (!sample) return problem(500, 'no_sample', 'No demo profiles loaded')
      const extraction: Extraction = {
        extraction_id: crypto.randomUUID(),
        removed: [
          'name',
          'email address',
          'phone number',
          'postal address',
          'LinkedIn link',
          'date of birth',
        ],
        contact: {
          full_name: sample.full_name,
          email: sample.email ?? undefined,
          phone: sample.phone ?? undefined,
        },
        profile: structuredClone(sample.profile),
        unmatched_skills: ['Team leadership', 'Agile ceremonies'],
        notes: ['Level estimated from 2 lead roles in the last 3 years'],
        model: 'demo-extractor',
      }
      extractions.set(extraction.extraction_id, { sample })
      return HttpResponse.json(extraction)
    }),
    http.post(api('/candidates'), async ({ request }) => {
      const body = (await request.json()) as CandidateCreate
      if ((body as { consent?: boolean }).consent !== true) {
        return problem(422, 'consent_required', 'Record the candidate’s consent')
      }
      const sample = body.extraction_id ? extractions.get(body.extraction_id)?.sample : undefined
      const now = new Date()
      const made: MockCandidate = {
        id: `cand-${String(candidates.length + 1).padStart(3, '0')}-${now.getTime() % 1000}`,
        full_name: body.full_name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        status: 'new',
        source: body.source,
        notice_days: body.profile.notice_days,
        uploaded_at: now.toISOString(),
        delete_after: new Date(now.getTime() + 365 * DAY).toISOString().slice(0, 10),
        consent_recorded_by: 'hr@srtm.local',
        consent_at: now.toISOString(),
        profile: body.profile,
        matches: sample?.matches ?? [],
        history: [
          { at: now.toISOString(), by: 'hr@srtm.local', status: 'new', note: 'Resume uploaded' },
        ],
      }
      candidates = [made, ...candidates]
      return HttpResponse.json(candidateDetail(made), { status: 201 })
    }),
    http.get(api('/candidates'), ({ request }) => {
      const url = new URL(request.url)
      const status = url.searchParams.get('status')
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const items = candidates
        .filter(
          (c) =>
            (!status || c.status === status) &&
            (!q ||
              c.full_name.toLowerCase().includes(q) ||
              c.profile.designation.toLowerCase().includes(q) ||
              c.profile.skills.some((s) => s.skill_name.toLowerCase().includes(q))),
        )
        .map(candidateSummary)
      return HttpResponse.json({ items, total: items.length, limit: items.length, offset: 0 })
    }),
    http.get(api('/candidates/:id'), ({ params }) => {
      const c = candidates.find((x) => x.id === params.id)
      return c
        ? HttpResponse.json(candidateDetail(c))
        : problem(404, 'candidate_not_found', 'Candidate not found')
    }),
    http.patch(api('/candidates/:id'), async ({ params, request }) => {
      const body = (await request.json()) as {
        status?: CandidateStatus
        note?: string
        profile?: CandidateProfile
      }
      candidates = candidates.map((c) => {
        if (c.id !== params.id) return c
        const status = body.status ?? c.status
        // Like the API: a step is recorded only for a status change or a note.
        const recorded = body.status !== undefined || (body.note ?? '').trim() !== ''
        return {
          ...c,
          status,
          profile: body.profile ?? c.profile,
          delete_after: status === 'hired' ? null : c.delete_after,
          history: recorded
            ? [
                ...(c.history ?? []),
                {
                  at: new Date().toISOString(),
                  by: 'hr@srtm.local',
                  status,
                  note: body.note ?? '',
                },
              ]
            : c.history,
        }
      })
      const c = candidates.find((x) => x.id === params.id)
      return c
        ? HttpResponse.json(candidateDetail(c))
        : problem(404, 'candidate_not_found', 'Candidate not found')
    }),
    http.delete(api('/candidates/:id'), ({ params }) => {
      candidates = candidates.filter((c) => c.id !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
    http.get(api('/candidates/:id/matches'), ({ params }) => {
      const c = candidates.find((x) => x.id === params.id)
      return c
        ? HttpResponse.json(c.matches)
        : problem(404, 'candidate_not_found', 'Candidate not found')
    }),
    http.get(api('/tasks/:id/candidates'), async ({ params, request }) => {
      const task = await taskFor(String(params.id), request)
      const ranked: CandidateMatch[] = candidates
        .flatMap((c) => {
          const m = task && matchFor(c, task)
          if (!m) return []
          return [
            {
              score: m.score,
              band: m.band,
              must_have_coverage: m.must_have_coverage,
              matched_skills: m.matched_skills,
              missing_skills: m.missing_skills,
              reasons: m.reasons,
              candidate: candidateSummary(c),
            },
          ]
        })
        .sort((a, b) => b.score - a.score)
      return HttpResponse.json(ranked)
    }),
    // --- Hiring requests ----------------------------------------------------------------------
    http.post(api('/tasks/:id/hiring-requests'), async ({ params, request }) => {
      const body = (await request.json()) as { wanted: number; note: string }
      const task = await taskFor(String(params.id), request)
      if (!task) return problem(404, 'task_not_found', 'Task not found')
      if (requests.some((r) => r.task_id === task.id && r.status !== 'closed')) {
        return problem(409, 'request_open', 'HR is already working on a request for this task')
      }
      if (body.wanted < 1 || body.wanted > MAX_SUBMISSIONS) {
        return problem(422, 'invalid_request', `wanted: between 1 and ${MAX_SUBMISSIONS}`)
      }
      const me = currentUser().email
      const req: MockRequest = {
        id: `req-${nextId++}`,
        task_id: task.id,
        task_code: task.code,
        task_title: task.title,
        client_code: task.client_code,
        requested_by: me,
        requested_at: new Date().toISOString(),
        wanted: body.wanted,
        note: body.note,
        status: 'new',
        sent_count: 0,
        fit_count: 0,
        submissions: [],
      }
      requests = [req, ...requests]
      notify('hr', {
        kind: 'request_new',
        title: `New request for ${task.code}`,
        body: `${me} needs ${body.wanted} candidates for "${task.title}"`,
        link: `/hiring-requests/${req.id}`,
      })
      return HttpResponse.json(requestSummary(req), { status: 201 })
    }),
    http.get(api('/hiring-requests'), ({ request }) => {
      const status = new URL(request.url).searchParams.get('status')
      const mine = isHr()
        ? requests
        : requests.filter((r) => r.requested_by === currentUser().email)
      return HttpResponse.json(
        mine.filter((r) => !status || r.status === status).map(requestSummary),
      )
    }),
    http.get(api('/hiring-requests/:id'), ({ params }) => {
      const r = findRequest(params.id)
      if (!r || (!isHr() && r.requested_by !== currentUser().email)) {
        return problem(404, 'request_not_found', 'Request not found')
      }
      return HttpResponse.json(requestDetail(r))
    }),
    http.post(api('/hiring-requests/:id/start'), ({ params }) => {
      const r = update(String(params.id), (x) =>
        x.status === 'new' ? { ...x, status: 'in_progress' } : x,
      )
      return r
        ? HttpResponse.json(requestDetail(r))
        : problem(404, 'request_not_found', 'Request not found')
    }),
    http.post(api('/hiring-requests/:id/submissions'), async ({ params, request }) => {
      const body = (await request.json()) as { candidate_ids: string[]; note: string }
      const r = findRequest(params.id)
      if (!r) return problem(404, 'request_not_found', 'Request not found')
      const task = await taskFor(r.task_id, request)
      if (task) for (const c of candidates) if (body.candidate_ids.includes(c.id)) matchFor(c, task)
      const ids = body.candidate_ids.filter(
        (id) => !r.submissions.some((s) => s.candidate_id === id),
      )
      const total = r.submissions.length + ids.length
      if (ids.length === 0 || total > MAX_SUBMISSIONS) {
        return problem(
          422,
          'invalid_request',
          `Send between 1 and ${MAX_SUBMISSIONS} candidates in total`,
        )
      }
      const updated = update(r.id, (x) => ({
        ...x,
        status: 'sent',
        submissions: [
          ...x.submissions,
          ...ids.map((id) => ({
            candidate_id: id,
            hr_note: body.note,
            verdict: null,
            verdict_note: '',
            decided_at: null,
          })),
        ],
      }))
      if (!updated) return problem(404, 'request_not_found', 'Request not found')
      candidates = candidates.map((c) =>
        ids.includes(c.id) && c.status === 'new' ? { ...c, status: 'screened' } : c,
      )
      notify(r.requested_by, {
        kind: 'request_sent',
        title: `HR sent ${ids.length} candidates for ${r.task_code}`,
        body: 'Mark each one fit or not a fit.',
        link: `/hiring-requests/${r.id}`,
      })
      return HttpResponse.json(requestDetail(updated))
    }),
    http.put(api('/hiring-requests/:id/submissions/:candidateId'), async ({ params, request }) => {
      const body = (await request.json()) as { verdict: Verdict; note: string }
      const r = findRequest(params.id)
      if (!r) return problem(404, 'request_not_found', 'Request not found')
      const updated = update(r.id, (x) => {
        const submissions = x.submissions.map((s) =>
          s.candidate_id === params.candidateId
            ? {
                ...s,
                verdict: body.verdict,
                verdict_note: body.note,
                decided_at: new Date().toISOString(),
              }
            : s,
        )
        const done = submissions.every((s) => s.verdict !== null)
        return { ...x, submissions, status: done ? 'reviewed' : x.status }
      })
      if (!updated) return problem(404, 'request_not_found', 'Request not found')
      if (body.verdict === 'fit') {
        const c = candidates.find((x) => x.id === params.candidateId)
        notify('hr', {
          kind: 'candidate_fit',
          title: `Get this candidate: ${c?.full_name.split(' ')[0] ?? 'candidate'} for ${r.task_code}`,
          body: `${currentUser().email} marked them fit. Contact them to start hiring.`,
          link: `/candidates/${String(params.candidateId)}`,
        })
      }
      if (updated.status === 'reviewed' && r.status !== 'reviewed') {
        const fit = updated.submissions.filter((s) => s.verdict === 'fit').length
        notify('hr', {
          kind: 'request_reviewed',
          title: `Manager decided on ${r.task_code}`,
          body: `${fit} fit — contact them next.`,
          link: `/hiring-requests/${r.id}`,
        })
      }
      return HttpResponse.json(requestDetail(updated))
    }),
    http.post(api('/hiring-requests/:id/close'), ({ params }) => {
      const r = update(String(params.id), (x) => ({ ...x, status: 'closed' }))
      return r
        ? HttpResponse.json(requestDetail(r))
        : problem(404, 'request_not_found', 'Request not found')
    }),

    // --- Notifications --------------------------------------------------------------------
    http.get(api('/notifications'), () => {
      const me = currentUser()
      const mine = notifications.filter((n) => (n.to === 'hr' ? isHr() : n.to === me.email))
      return HttpResponse.json(
        mine.map((n) => ({
          id: n.id,
          kind: n.kind,
          title: n.title,
          body: n.body,
          link: n.link,
          created_at: n.created_at,
          read: n.read,
        })),
      )
    }),
    http.post(api('/notifications/read-all'), () => {
      const me = currentUser()
      notifications = notifications.map((n) =>
        (n.to === 'hr' ? isHr() : n.to === me.email) ? { ...n, read: true } : n,
      )
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(api('/notifications/:id/read'), ({ params }) => {
      notifications = notifications.map((n) => (n.id === params.id ? { ...n, read: true } : n))
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}
