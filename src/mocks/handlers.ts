import { http, HttpResponse } from 'msw'

import type {
  FeedbackInput,
  ApiProject,
  Company,
  CompanyCreate,
  ApiProjectCreate,
  FeedbackReport,
  Page,
  Problem,
  Task,
  TaskCreate,
  ThresholdsHistory,
  ThresholdsUpdate,
  Client,
  ClientCreate,
  ClientUpdate,
  ModelActivate,
  ModelHealth,
  ModelsList,
  UserAdmin,
  UserCreate,
  UserUpdate,
  User,
} from '@/api/types'
import type { Db } from '@/mocks/db'
import { createHrHandlers } from '@/mocks/hr'
import { createInsightHandlers } from '@/mocks/insights'
import { createOrgHandlers } from '@/mocks/org'
import { createPlanningHandlers } from '@/mocks/planning'

const MOCK_USER_ID = 'demo-resource-manager'

function problem(status: number, title: string, code: string, detail: string) {
  const body: Problem = { type: 'about:blank', title, status, code, detail }
  return HttpResponse.json(body, {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

function page<T>(items: T[], url: URL): Page<T> {
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)
  const offset = Number(url.searchParams.get('offset') ?? 0)
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset }
}

export function createHandlers(db: Db, session?: Storage) {
  let feedbackGiven = 0
  const apiProjects: ApiProject[] = []
  const companies: Company[] = [
    {
      id: 'sparity',
      name: 'Sparity',
      created_at: '2026-10-01T09:00:00Z',
      users: 6,
      employees: 720,
    },
  ]
  const feedbackReports: FeedbackReport[] = [
    {
      id: 'fbr-1',
      period_start: '2026-09-30T00:00:00Z',
      period_end: '2026-10-07T00:00:00Z',
      feedback_count: 34,
      thumbs_up: 21,
      thumbs_down: 13,
      summary:
        'Managers like the top of the shortlists but say resume skill levels look too high. HR asks for clearer notice periods. A few people could not find the candidates HR sent them.',
      themes: [
        {
          title: 'Resume skill levels look too high',
          area: 'resume_reading',
          mentions: 6,
          examples: ['Python 5/5 from one line in the resume', 'levels look inflated'],
          suggestion:
            'Give skills mentioned only once level 2, and check ten recent resumes first.',
          kind: 'resume_reading',
          status: 'open',
        },
        {
          title: 'Candidates from HR are hard to find',
          area: 'other',
          mentions: 3,
          examples: ['where do I see what HR sent?'],
          suggestion: 'Link the task page from the notification and show a count on the task list.',
          kind: 'screen_or_wording',
          status: 'open',
        },
      ],
      model: 'gpt-5.4-mini',
      prompt_version: 'feedback_report_v1',
      cost_usd: 0.0021,
      created_by: null,
      created_at: '2026-10-07T00:00:00Z',
    },
  ]
  const api = (path: string) => `*/api/v1${path}`

  // Mock sign-in: a resource manager unless "viewer..." or "admin..." signs in.
  let user: User = {
    id: MOCK_USER_ID,
    email: 'manager1@srtm.local',
    display_name: 'Resource Manager 1',
    role: 'resource_manager',
    must_change_password: false,
  }
  const account = (
    id: string,
    email: string,
    display_name: string,
    role: UserAdmin['role'],
  ): UserAdmin => ({
    id,
    email,
    display_name,
    role,
    is_active: true,
    must_change_password: false,
    created_at: '2026-10-02T00:00:00Z',
  })
  let accounts: UserAdmin[] = [
    account('demo-admin', 'admin@srtm.local', 'Pilot Admin', 'admin'),
    account(MOCK_USER_ID, 'manager1@srtm.local', 'Resource Manager 1', 'resource_manager'),
    account('demo-hr', 'hr@srtm.local', 'HR Partner', 'hr'),
    account('demo-viewer', 'viewer@srtm.local', 'Viewer', 'viewer'),
  ]
  let clients: Client[] = [...new Set(db.tasks.map((t) => t.client_code))].sort().map((code) => ({
    code,
    name: code.replace(/^CL-/, '').replace(/^\w/, (ch) => ch.toUpperCase()),
    domain: null,
    timezone: null,
    notes: '',
    is_active: true,
  }))
  const temporary = () => `temp-${Math.random().toString(36).slice(2, 12)}`
  let signedIn = true
  // The browser mock keeps who is signed in across page reloads; tests pass no storage.
  const SESSION_KEY = 'srtm-mock-email'
  const signInAs = (email: string) => {
    const known = accounts.find((a) => a.email === email.toLowerCase())
    user = known
      ? {
          id: known.id,
          email: known.email,
          display_name: known.display_name,
          role: known.role,
          must_change_password: known.must_change_password,
        }
      : { ...user, email }
    signedIn = true
  }
  const remembered = session?.getItem(SESSION_KEY)
  if (remembered === '') signedIn = false
  else if (remembered) signInAs(remembered)
  const token = { access_token: 'mock-token', token_type: 'bearer', expires_in: 1800 }
  const firstVersion = {
    version: 1,
    label: 'overall_fit@1',
    shortlist_min: 0.8,
    review_min: 0.5,
    reason: 'Initial pilot cut-offs',
    created_by: null,
    created_at: '2026-10-01T00:00:00Z',
    active: true,
  }
  let thresholds: ThresholdsHistory = {
    decision_key: 'overall_fit',
    active: firstVersion,
    history: [firstVersion],
  }
  const scores = (pairwise: number, hit5: number, hit1: number, report: string) => ({
    report_id: report,
    pairwise_order: pairwise,
    baseline_pairwise_order: 0.861,
    hit_at_5: hit5,
    hit_at_1: hit1,
  })
  let models: ModelsList = {
    active: 'student-v2',
    pinned_dir: null,
    models: [
      {
        name: 'student',
        fingerprint: '3efa7d737abb25eb',
        decision_set_version: 'v1',
        note: 'teacher only (2 Oct)',
        registered_at: '2026-10-05T09:11:00Z',
        active: false,
        calibrated: false,
        combiner: false,
        scores: scores(0.722, 0.8, 0.4, '20261005T053603Z'),
      },
      {
        name: 'student-v2',
        fingerprint: '10780d63239f11b5',
        decision_set_version: 'v1',
        note: '+ simulated managers + combiner (5 Oct)',
        registered_at: '2026-10-05T09:11:00Z',
        active: true,
        calibrated: true,
        combiner: true,
        scores: scores(0.879, 0.94, 0.54, '20261005T073524Z'),
      },
    ],
    history: [],
  }
  const switchTo = (name: string, reason: string, forced: boolean) => {
    const from = models.active
    models = {
      ...models,
      active: name,
      models: models.models.map((m) => ({ ...m, active: m.name === name })),
      history: [
        { at: new Date().toISOString(), from_model: from, to_model: name, forced, reason },
        ...models.history,
      ],
    }
  }

  return [
    ...createHrHandlers(db, () => user),
    ...createPlanningHandlers(db),
    ...createInsightHandlers(db),
    ...createOrgHandlers(() => user),
    http.post(api('/auth/login'), async ({ request }) => {
      const { email } = (await request.json()) as { email: string }
      signInAs(email)
      session?.setItem(SESSION_KEY, email)
      return HttpResponse.json(token)
    }),
    // Signed in until someone signs out, so the mock can switch between accounts (e.g. HR).
    http.post(api('/auth/refresh'), () =>
      signedIn
        ? HttpResponse.json(token)
        : HttpResponse.json(
            { type: 'about:blank', title: 'Unauthorized', status: 401, code: 'not_authenticated' },
            { status: 401 },
          ),
    ),
    http.post(api('/auth/password'), () => {
      user = { ...user, must_change_password: false }
      accounts = accounts.map((a) => (a.id === user.id ? { ...a, must_change_password: false } : a))
      return HttpResponse.json(token)
    }),
    http.get(api('/admin/users'), () => HttpResponse.json(accounts)),
    http.post(api('/admin/users'), async ({ request }) => {
      const body = (await request.json()) as UserCreate
      const email = body.email.toLowerCase()
      if (accounts.some((a) => a.email === email)) {
        return problem(409, 'Conflict', 'email_taken', `${email} already has an account`)
      }
      const made = {
        ...account(`u-${accounts.length + 1}`, email, body.display_name, body.role),
        must_change_password: true,
      }
      accounts = [...accounts, made]
      return HttpResponse.json({ user: made, temporary_password: temporary() }, { status: 201 })
    }),
    http.patch(api('/admin/users/:id'), async ({ params, request }) => {
      const body = (await request.json()) as UserUpdate
      if (
        params.id === user.id &&
        (body.is_active === false || (body.role && body.role !== 'admin'))
      ) {
        return problem(
          422,
          'Validation error',
          'cannot_demote_self',
          'You cannot remove your own admin access or deactivate yourself.',
        )
      }
      accounts = accounts.map((a) =>
        a.id === params.id
          ? {
              ...a,
              ...(body.display_name ? { display_name: body.display_name } : {}),
              ...(body.role ? { role: body.role } : {}),
              ...(body.is_active === undefined || body.is_active === null
                ? {}
                : { is_active: body.is_active }),
            }
          : a,
      )
      return HttpResponse.json(accounts.find((a) => a.id === params.id))
    }),
    http.post(api('/admin/users/:id/reset-password'), ({ params }) => {
      accounts = accounts.map((a) =>
        a.id === params.id ? { ...a, must_change_password: true } : a,
      )
      return HttpResponse.json({
        user: accounts.find((a) => a.id === params.id),
        temporary_password: temporary(),
      })
    }),
    http.get(api('/auth/me'), () => HttpResponse.json(user)),
    http.post(api('/auth/logout'), () => {
      signedIn = false
      session?.setItem(SESSION_KEY, '')
      return new HttpResponse(null, { status: 204 })
    }),

    http.get(api('/decisions'), () => HttpResponse.json({ items: db.decisions })),
    http.get(api('/decisions/overall_fit/thresholds'), () => HttpResponse.json(thresholds)),
    http.put(api('/decisions/overall_fit/thresholds'), async ({ request }) => {
      const body = (await request.json()) as ThresholdsUpdate
      const next = thresholds.active.version + 1
      const version = {
        ...body,
        version: next,
        label: `overall_fit@${next}`,
        created_by: user.email,
        created_at: new Date().toISOString(),
        active: true,
      }
      thresholds = {
        ...thresholds,
        active: version,
        history: [version, ...thresholds.history.map((v) => ({ ...v, active: false }))],
      }
      return HttpResponse.json(thresholds)
    }),
    http.get(api('/clients'), () => HttpResponse.json(clients)),
    http.post(api('/clients'), async ({ request }) => {
      const body = (await request.json()) as ClientCreate
      if (clients.some((c) => c.code === body.code)) {
        return problem(409, 'Conflict', 'client_exists', `Client ${body.code} already exists`)
      }
      const made: Client = {
        code: body.code,
        name: body.name,
        domain: body.domain ?? null,
        timezone: body.timezone ?? null,
        notes: body.notes,
        is_active: true,
      }
      clients = [...clients, made]
      return HttpResponse.json(made, { status: 201 })
    }),
    http.patch(api('/clients/:code'), async ({ params, request }) => {
      const body = (await request.json()) as ClientUpdate
      clients = clients.map((c) =>
        c.code === params.code
          ? {
              ...c,
              ...(body.name ? { name: body.name } : {}),
              domain: body.domain === undefined ? c.domain : body.domain,
              timezone: body.timezone === undefined ? c.timezone : body.timezone,
              notes: body.notes ?? c.notes,
              is_active: body.is_active ?? c.is_active,
            }
          : c,
      )
      return HttpResponse.json(clients.find((c) => c.code === params.code))
    }),
    http.get(api('/admin/models'), () => HttpResponse.json(models)),
    http.get(api('/admin/health'), () => {
      const week = (w: string, starts: string, decisions: number, agreed: number) => ({
        week: w,
        starts,
        decisions,
        agreed,
        rate: decisions >= 10 ? agreed / decisions : null,
      })
      const health: ModelHealth = {
        overall: { decisions: 46, agreed: 36, rate: 36 / 46 },
        shortlist_override_rate: 0.15,
        by_band: [
          { band: 'shortlist', accepted: 17, rejected: 3 },
          { band: 'review', accepted: 9, rejected: 12 },
          { band: 'hidden', accepted: 1, rejected: 4 },
        ],
        weeks: [
          week('2026-W40', '2026-09-28', 14, 10),
          week('2026-W41', '2026-10-05', 26, 21),
          week('2026-W42', '2026-10-12', 6, 5),
        ],
        models: [
          {
            model: 'student:answerdotai/ModernBERT-base@10780d63239f11b5',
            decisions: 32,
            agreed: 27,
            rate: 27 / 32,
          },
          {
            model: 'student:answerdotai/ModernBERT-base@3efa7d737abb25eb',
            decisions: 14,
            agreed: 9,
            rate: 9 / 14,
          },
        ],
        reject_reasons: { skill_gap: 9, level_mismatch: 6, domain_gap: 2, other: 2 },
        planning_rejections: 4,
        min_decisions: 10,
      }
      return HttpResponse.json(health)
    }),
    http.post(api('/admin/models/:name/activate'), async ({ params, request }) => {
      const body = (await request.json()) as ModelActivate
      const target = models.models.find((m) => m.name === params.name)
      const current = models.models.find((m) => m.active)
      if (!target)
        return problem(
          404,
          'Not found',
          'model_not_found',
          `Model ${String(params.name)} is not registered`,
        )
      const worse =
        (target.scores?.pairwise_order ?? 0) < (current?.scores?.pairwise_order ?? 0) - 0.01
      if (worse && !body.force) {
        return problem(
          409,
          'Activation refused',
          'activation_refused',
          `${target.name} ranks worse than ${current?.name ?? ''}; use force to switch anyway`,
        )
      }
      switchTo(target.name, body.reason, body.force)
      return HttpResponse.json(models)
    }),
    http.post(api('/admin/models/rollback'), () => {
      const last = models.history[0]
      if (!last?.from_model)
        return problem(409, 'Rollback refused', 'rollback_refused', 'nothing to roll back to')
      switchTo(last.from_model, 'rollback', true)
      return HttpResponse.json(models)
    }),
    http.get(api('/match-runs'), ({ request }) =>
      HttpResponse.json(
        page(
          db.tasks
            .flatMap((t) =>
              db.runsForTask(t.id).map((r) => ({
                ...r,
                task_code: t.code,
                task_title: t.title,
                requested_by_email: null,
              })),
            )
            .filter((r) => {
              const status = new URL(request.url).searchParams.get('status')
              return !status || r.status === status
            }),
          new URL(request.url),
        ),
      ),
    ),
    http.get(api('/eval/reports'), ({ request }) =>
      HttpResponse.json(page([], new URL(request.url))),
    ),
    // Companies (ADR 022): the mock admin is the operator's.
    http.get(api('/admin/companies'), () => HttpResponse.json(companies)),
    http.post(api('/admin/companies'), async ({ request }) => {
      const body = (await request.json()) as CompanyCreate
      if (companies.some((c) => c.id === body.id)) {
        return problem(
          409,
          'Company exists',
          'company_exists',
          `A company called ${body.id} exists`,
        )
      }
      const company: Company = {
        id: body.id,
        name: body.name,
        created_at: new Date().toISOString(),
        users: 1,
        employees: 0,
      }
      companies.push(company)
      return HttpResponse.json(
        { company, admin_email: body.admin_email.toLowerCase(), temporary_password: temporary() },
        { status: 201 },
      )
    }),
    // Decision API (ADR 021): projects and keys in memory; the key itself is shown once.
    http.get(api('/admin/api-projects'), () => HttpResponse.json(apiProjects)),
    http.post(api('/admin/api-projects'), async ({ request }) => {
      const body = (await request.json()) as ApiProjectCreate
      if (apiProjects.some((p) => p.name === body.name)) {
        return problem(422, 'Exists', 'project_exists', `A project called ${body.name} exists`)
      }
      const made: ApiProject = {
        id: `proj-${apiProjects.length + 1}`,
        name: body.name,
        monthly_budget_usd: body.monthly_budget_usd,
        spent_this_month_usd: 0,
        store_inputs: body.store_inputs,
        is_active: true,
        keys: [],
      }
      apiProjects.push(made)
      return HttpResponse.json(made, { status: 201 })
    }),
    http.post(api('/admin/api-projects/:id/keys'), ({ params }) => {
      const p = apiProjects.find((x) => x.id === params.id)
      if (!p) return problem(404, 'Not found', 'project_not_found', 'Project not found')
      const key = `jev_demo${Math.random().toString(36).slice(2, 14)}`
      const row = {
        id: `key-${p.keys.length + 1}-${p.id}`,
        prefix: key.slice(0, 12),
        created_at: new Date().toISOString(),
        last_used_at: null,
        revoked_at: null,
      }
      p.keys.unshift(row)
      return HttpResponse.json({ id: row.id, prefix: row.prefix, key }, { status: 201 })
    }),
    http.post(api('/admin/api-keys/:id/revoke'), ({ params }) => {
      for (const p of apiProjects) {
        for (const k of p.keys) if (k.id === params.id) k.revoked_at = new Date().toISOString()
      }
      return new HttpResponse(null, { status: 204 })
    }),
    http.get(api('/admin/api-projects/:id/requests'), () => HttpResponse.json([])),
    // People's feedback (ADR 023): stored in memory; a sample weekly report for the admin screen.
    http.post(api('/feedback'), async ({ request }) => {
      const body = (await request.json()) as { rating?: string; comment?: string }
      if (!body.rating && !body.comment?.trim()) {
        return problem(422, 'Validation error', 'validation_error', 'Give a rating or a comment')
      }
      feedbackGiven += 1
      return new HttpResponse(null, { status: 204 })
    }),
    http.get(api('/admin/feedback-reports'), () => HttpResponse.json(feedbackReports)),
    http.post(api('/admin/feedback-reports'), () => {
      if (feedbackGiven === 0) {
        return problem(
          422,
          'No feedback',
          'no_feedback',
          'No written feedback since the last report',
        )
      }
      return HttpResponse.json(feedbackReports[0], { status: 201 })
    }),
    http.patch(api('/admin/feedback-reports/:id/themes/:index'), async ({ params, request }) => {
      const body = (await request.json()) as { status: FeedbackReport['themes'][number]['status'] }
      const report = feedbackReports.find((r) => r.id === params.id)
      const theme = report?.themes[Number(params.index)]
      if (!report || !theme)
        return problem(404, 'Not found', 'theme_not_found', 'Suggestion not found')
      theme.status = body.status
      return HttpResponse.json(report)
    }),
    http.get(api('/admin/learning'), () =>
      HttpResponse.json({
        feedback_total: 3,
        accepted: 1,
        rejected_by_reason: { skill_gap: 1, availability: 1 },
        usable_examples: 2,
        thumb_examples: 0,
        training_examples: 2,
        holdout_examples: 0,
        skipped: { planning_reason: 1 },
        last_feedback_at: '2026-10-02T10:00:00Z',
      }),
    ),

    http.get(api('/skills'), ({ request }) =>
      HttpResponse.json(page(db.skills, new URL(request.url))),
    ),

    http.post(api('/tasks'), async ({ request }) => {
      try {
        const task = db.createTask((await request.json()) as TaskCreate)
        return HttpResponse.json(task, {
          status: 201,
          headers: { Location: `/api/v1/tasks/${task.id}` },
        })
      } catch (e) {
        return problem(
          422,
          'Validation Error',
          'invalid_task',
          e instanceof Error ? e.message : 'Invalid task',
        )
      }
    }),

    http.get(api('/tasks'), ({ request }) => {
      const url = new URL(request.url)
      const q = url.searchParams.get('q')?.toLowerCase()
      const priority = url.searchParams.get('priority')
      const domain = url.searchParams.get('domain')
      const statuses = url.searchParams.getAll('status')
      const tasks = db.tasks.filter(
        (t) =>
          (!statuses.length || statuses.includes(t.status)) &&
          (!q || `${t.code} ${t.title}`.toLowerCase().includes(q)) &&
          (!priority || t.priority === priority) &&
          (!domain || t.domain === domain),
      )
      return HttpResponse.json(page(tasks, url))
    }),

    http.post(api('/tasks/:taskId/status'), async ({ params, request }) => {
      const task = db.tasks.find((t) => t.id === params.taskId)
      if (!task) return problem(404, 'Not Found', 'task_not_found', 'Task not found')
      const { status } = (await request.json()) as { status: Task['status'] }
      task.status = status
      return HttpResponse.json(task)
    }),

    http.patch(api('/tasks/:taskId'), async ({ params, request }) => {
      const task = db.updateTask(String(params.taskId), (await request.json()) as TaskCreate)
      return task
        ? HttpResponse.json(task)
        : problem(404, 'Not Found', 'task_not_found', `Task ${String(params.taskId)} not found`)
    }),

    http.get(api('/tasks/:taskId'), ({ params }) => {
      const task = db.tasks.find((t) => t.id === params.taskId)
      return task
        ? HttpResponse.json(task)
        : problem(404, 'Not Found', 'task_not_found', `Task ${String(params.taskId)} not found`)
    }),

    http.get(api('/tasks/:taskId/match-runs'), ({ params, request }) =>
      HttpResponse.json(page(db.runsForTask(String(params.taskId)), new URL(request.url))),
    ),

    http.post(api('/tasks/:taskId/match-runs'), ({ params }) => {
      const taskId = String(params.taskId)
      if (!db.tasks.some((t) => t.id === taskId)) {
        return problem(404, 'Not Found', 'task_not_found', `Task ${taskId} not found`)
      }
      if (!db.canRun(taskId)) {
        return problem(
          503,
          'Not available in demo mode',
          'demo_matching_unavailable',
          'Matching new tasks needs the real backend (Phase 2). In demo mode, matching runs on the 15 sample tasks.',
        )
      }
      if (db.runsForTask(taskId).some((r) => r.status === 'queued' || r.status === 'running')) {
        return problem(
          409,
          'Conflict',
          'run_in_progress',
          'A match run for this task is already in progress',
        )
      }
      const run = db.startRun(taskId)
      return HttpResponse.json({ run_id: run.id, status: run.status }, { status: 202 })
    }),

    http.get(api('/match-runs/:runId'), ({ params }) => {
      const run = db.getRun(String(params.runId))
      return run
        ? HttpResponse.json(run)
        : problem(404, 'Not Found', 'run_not_found', `Run ${String(params.runId)} not found`)
    }),

    http.get(api('/match-runs/:runId/shortlist'), ({ params, request }) => {
      const url = new URL(request.url)
      const items = db.shortlist(String(params.runId))
      if (!items) return problem(404, 'Not Found', 'run_not_found', 'Run not found')
      const includeHidden = url.searchParams.get('include_hidden') === 'true'
      return HttpResponse.json(
        page(includeHidden ? items : items.filter((i) => i.band !== 'hidden'), url),
      )
    }),

    http.get(api('/match-runs/:runId/excluded'), ({ params, request }) => {
      const items = db.excluded(String(params.runId))
      return items
        ? HttpResponse.json(page(items, new URL(request.url)))
        : problem(404, 'Not Found', 'run_not_found', 'Run not found')
    }),

    http.put(api('/shortlist-items/:itemId/feedback'), async ({ params, request }) => {
      const id = String(params.itemId)
      const body = (await request.json()) as FeedbackInput
      if (body.action === 'reject' && !body.reject_reason) {
        return problem(
          422,
          'Validation Error',
          'reject_reason_required',
          'Choose a reason when rejecting',
        )
      }
      if (!db.findItem(id))
        return problem(404, 'Not Found', 'item_not_found', 'Shortlist item not found')
      db.saveFeedback(id, {
        action: body.action,
        reject_reason: body.reject_reason ?? null,
        comment: body.comment?.trim() || null,
        by: MOCK_USER_ID,
        at: new Date().toISOString(),
      })
      return HttpResponse.json(db.findItem(id))
    }),
  ]
}
