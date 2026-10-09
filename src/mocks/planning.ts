import { HttpResponse, http } from 'msw'

import type {
  BenchPerson,
  BenchReport,
  Dashboard,
  EmployeeValue,
  CostBand,
  HireOrMove,
  Margin,
  ProposedPerson,
  RateCard,
  RateCardLine,
  ShortlistItem,
  SkillGap,
  StaffedTask,
} from '@/api/types'
import type { Db } from '@/mocks/db'
import hrData from '@/mocks/data/hr.json'
import { unitFor } from '@/mocks/org'

const api = (path: string) => `*/api/v1${path}`

interface MockEmployee {
  id: string
  employee_code: string
  full_name: string
  designation: string
  level: BenchPerson['level']
  practice: BenchPerson['practice']
  cost_band: CostBand
  current_allocation_pct: number
  available_from: string
  skills: {
    skill_id: string
    skill_name: string
    proficiency: number
    years: number
    last_used: string
    certified: boolean
  }[]
  projects: {
    project_name: string
    domain: string
    role_title: string
    start_date: string
    end_date: string
    outcome: string
  }[]
  location: string
  years_experience: number
}

const employees = (hrData as unknown as { employees: MockEmployee[] }).employees
const byId = new Map(employees.map((e) => [e.id, e]))
const TODAY = new Date().toISOString().slice(0, 10)
const TARGET = 30

const DEFAULT_RATES: RateCardLine[] = [
  { cost_band: 'A', weekly_cost_usd: 600, weekly_bill_usd: 1000 },
  { cost_band: 'B', weekly_cost_usd: 900, weekly_bill_usd: 1500 },
  { cost_band: 'C', weekly_cost_usd: 1300, weekly_bill_usd: 2100 },
  { cost_band: 'D', weekly_cost_usd: 1800, weekly_bill_usd: 2900 },
  { cost_band: 'E', weekly_cost_usd: 2500, weekly_bill_usd: 4000 },
]

function problem(status: number, code: string, detail: string) {
  return HttpResponse.json(
    { type: 'about:blank', title: code, status, code, detail },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

export function createPlanningHandlers(db: Db) {
  let rates = DEFAULT_RATES
  let synthetic = true
  let target = TARGET

  const margin = (band: CostBand): Margin => {
    const r = rates.find((x) => x.cost_band === band) ?? {
      weekly_cost_usd: 1300,
      weekly_bill_usd: 2100,
    }
    const pct =
      Math.round((1000 * (r.weekly_bill_usd - r.weekly_cost_usd)) / r.weekly_bill_usd) / 10
    return {
      weekly_cost_usd: r.weekly_cost_usd,
      weekly_bill_usd: r.weekly_bill_usd,
      margin_pct: pct,
      below_target: pct < TARGET,
    }
  }

  const person = (item: ShortlistItem): ProposedPerson => {
    const band = byId.get(item.employee.id)?.cost_band ?? 'C'
    return {
      employee_id: item.employee.id,
      employee_code: item.employee.employee_code,
      full_name: item.employee.full_name,
      designation: item.employee.designation,
      level: item.employee.level,
      cost_band: band,
      score: Math.round(item.rank_score * 1000) / 1000,
      band: item.band,
      margin: margin(band),
    }
  }

  const recommended = (taskId: string): { runId: string; items: ShortlistItem[] } | null => {
    const run = db.runsForTask(taskId).find((r) => r.status === 'completed')
    if (!run) return null
    const items = (db.shortlist(run.id) ?? []).filter((i) => i.band !== 'hidden')
    return { runId: run.id, items }
  }

  const bench = (horizon: number): BenchPerson[] => {
    const end = new Date(Date.now() + horizon * 86_400_000).toISOString().slice(0, 10)
    const openTasks = db.tasks.filter((t) => t.status === 'open')
    return employees
      .map((e): BenchPerson | null => {
        const free = e.available_from <= TODAY ? 100 : 100 - e.current_allocation_pct
        if (free === 0 && e.available_from > end) return null
        const have = new Map(e.skills.map((s) => [s.skill_id, s.proficiency]))
        const best = openTasks
          .map((t) => {
            const must = t.requirements.filter((r) => r.must_have)
            const met = must.filter((r) => (have.get(r.skill.id) ?? 0) >= r.min_proficiency)
            return { t, cov: must.length ? met.length / must.length : 0 }
          })
          .filter((x) => x.cov >= 0.5)
          .sort((a, b) => b.cov - a.cov)
          .slice(0, 3)
          .map(({ t, cov }) => ({
            task_id: t.id,
            task_code: t.code,
            title: t.title,
            start_date: t.start_date,
            must_have_coverage: Math.round(cov * 100) / 100,
          }))
        const cost = rates.find((r) => r.cost_band === e.cost_band)?.weekly_cost_usd ?? 0
        return {
          employee_id: e.id,
          employee_code: e.employee_code,
          full_name: e.full_name,
          designation: e.designation,
          level: e.level,
          cost_band: e.cost_band,
          business_unit: unitFor(e.id),
          practice: e.practice,
          current_allocation_pct: e.current_allocation_pct,
          free_now_pct: free,
          fully_free_from: e.available_from > TODAY ? e.available_from : TODAY,
          on_leave_today: false,
          weekly_idle_cost_usd: Math.round((cost * free) / 100),
          best_tasks: best,
        }
      })
      .filter((p): p is BenchPerson => p !== null)
      .sort(
        (a, b) => b.free_now_pct - a.free_now_pct || a.employee_code.localeCompare(b.employee_code),
      )
  }

  /** Home dashboard (ADR 028), from the same mock people and tasks as the bench. */
  const dashboard = (): Dashboard => {
    const month = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const addMonths = (d: Date, n: number) =>
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
    const now = month(new Date())
    const open = db.tasks
      .filter((t) => t.status !== 'filled' && t.status !== 'cancelled')
      .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.code.localeCompare(b.code))
    const counts = new Map(open.map((t) => [t.id, recommended(t.id)?.items.length ?? null]))
    const withShortlist = open.filter((t) => (counts.get(t.id) ?? 0) > 0).length
    const ready = employees.filter((e) => e.skills.length >= 3 && e.projects.length > 0).length
    const fits = new Set(
      bench(365)
        .filter((p) => p.best_tasks.length > 0)
        .map((p) => p.employee_id),
    )
    const idle = Array.from({ length: 12 }, (_, i) => {
      const start = addMonths(now, i)
      const end = addMonths(now, i + 1)
      let total = 0
      let recoverable = 0
      for (
        let day = new Date(Math.max(start.getTime(), Date.now()));
        day < end;
        day = new Date(day.getTime() + 86_400_000)
      ) {
        const today = iso(day)
        for (const e of employees) {
          const free = e.available_from <= today ? 100 : 100 - e.current_allocation_pct
          const cost =
            ((rates.find((r) => r.cost_band === e.cost_band)?.weekly_cost_usd ?? 0) / 7) *
            (free / 100)
          total += cost
          if (fits.has(e.id)) recoverable += cost
        }
      }
      return {
        month: iso(start),
        idle_cost_usd: Math.round(total),
        recoverable_usd: Math.round(recoverable),
      }
    })
    return {
      rings: [
        {
          key: 'agreement',
          label: 'Managers agree with the model',
          value: null,
          numerator: 0,
          denominator: 0,
          note: 'Shown from 10 decisions (0 so far)',
        },
        {
          key: 'profiles',
          label: 'Profiles ready for matching',
          value: employees.length ? ready / employees.length : null,
          numerator: ready,
          denominator: employees.length,
          note: `${ready} of ${employees.length} people`,
        },
        {
          key: 'shortlisted',
          label: 'Open tasks with a shortlist',
          value: open.length ? withShortlist / open.length : null,
          numerator: withShortlist,
          denominator: open.length,
          note: `${withShortlist} of ${open.length} open tasks`,
        },
      ],
      // The mock has no creation dates, so tasks count in the month they start.
      tasks_by_month: Array.from({ length: 6 }, (_, i) => {
        const m = iso(addMonths(now, i - 5)).slice(0, 7)
        return {
          month: `${m}-01`,
          opened: db.tasks.filter((t) => t.start_date.startsWith(m)).length,
          filled: db.tasks.filter((t) => t.status === 'filled' && t.start_date.startsWith(m))
            .length,
        }
      }),
      open_tasks: open.slice(0, 5).map((t) => ({
        task_id: t.id,
        code: t.code,
        title: t.title,
        client_code: t.client_code,
        start_date: t.start_date,
        status: t.status,
        recommended: counts.get(t.id) ?? null,
      })),
      open_tasks_total: open.length,
      idle_cost_by_month: idle,
    }
  }

  return [
    http.get(api('/dashboard'), () => HttpResponse.json(dashboard())),
    http.get(api('/planning/bench'), ({ request }) => {
      const url = new URL(request.url)
      const horizon = Number(url.searchParams.get('horizon_days') ?? 90)
      const limit = Number(url.searchParams.get('limit') ?? 25)
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const rows = bench(horizon)
      const free = rows.filter((r) => r.free_now_pct > 0)
      const freeing = (days: number) => {
        const cut = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
        return rows.filter((r) => r.free_now_pct < 100 && r.fully_free_from <= cut).length
      }
      const body: BenchReport = {
        summary: {
          free_now: free.length,
          free_now_fte: Math.round(free.reduce((s, r) => s + r.free_now_pct, 0) / 10) / 10,
          weekly_idle_cost_usd: free.reduce((s, r) => s + r.weekly_idle_cost_usd, 0),
          freeing_30: freeing(30),
          freeing_60: freeing(60),
          freeing_90: freeing(90),
        },
        items: rows.slice(offset, offset + limit),
        total: rows.length,
        limit,
        offset,
      }
      return HttpResponse.json(body)
    }),

    http.get(api('/planning/people/:employeeId'), ({ params }) => {
      const e = byId.get(String(params.employeeId))
      if (!e) return problem(404, 'employee_not_found', 'Employee not found')
      const m = margin(e.cost_band)
      const lines = e.projects.map((p) => {
        const end = p.end_date < TODAY ? p.end_date : TODAY
        const weeks = Math.max(
          0,
          Math.round(((Date.parse(end) - Date.parse(p.start_date)) / 6.048e8) * 10) / 10,
        )
        const client = `CL-${p.domain.toUpperCase().slice(0, 6)}`
        return {
          project_code: p.project_name,
          project_name: p.project_name,
          client_code: client,
          client_name: client,
          domain: p.domain,
          role_title: p.role_title,
          start_date: p.start_date,
          end_date: p.end_date,
          weeks,
          manager_rating: null,
          outcome: p.outcome,
          current: p.start_date <= TODAY && TODAY <= p.end_date,
          estimated_revenue_usd: Math.round(weeks * m.weekly_bill_usd),
        }
      })
      const clients = new Map<string, { n: number; weeks: number; usd: number }>()
      for (const l of lines) {
        const c = clients.get(l.client_code) ?? { n: 0, weeks: 0, usd: 0 }
        clients.set(l.client_code, {
          n: c.n + 1,
          weeks: c.weeks + l.weeks,
          usd: c.usd + l.estimated_revenue_usd,
        })
      }
      const free = e.available_from <= TODAY ? 100 : 100 - e.current_allocation_pct
      const onBench = bench(365).find((b) => b.employee_id === e.id)
      const outcomes: Record<string, number> = {}
      for (const l of lines) outcomes[l.outcome] = (outcomes[l.outcome] ?? 0) + 1
      const body: EmployeeValue = {
        employee_id: e.id,
        employee_code: e.employee_code,
        full_name: e.full_name,
        designation: e.designation,
        level: e.level,
        cost_band: e.cost_band,
        business_unit: unitFor(e.id),
        practice: e.practice,
        location: e.location,
        years_experience: e.years_experience,
        current_allocation_pct: e.current_allocation_pct,
        free_now_pct: free,
        fully_free_from: e.available_from > TODAY ? e.available_from : TODAY,
        margin: m,
        estimated_revenue_usd: lines.reduce((s, l) => s + l.estimated_revenue_usd, 0),
        billed_weeks: Math.round(lines.reduce((s, l) => s + l.weeks, 0) * 10) / 10,
        average_rating: null,
        outcomes,
        clients: [...clients.entries()]
          .map(([code, c]) => ({
            client_code: code,
            client_name: code,
            projects: c.n,
            weeks: Math.round(c.weeks * 10) / 10,
            estimated_revenue_usd: c.usd,
          }))
          .sort((a, b) => b.estimated_revenue_usd - a.estimated_revenue_usd),
        current: lines.filter((l) => l.current),
        history: lines.filter((l) => !l.current),
        upcoming_leave: [],
        skills: [...e.skills]
          .sort((a, b) => b.proficiency - a.proficiency || b.years - a.years)
          .map((s) => ({
            skill_id: s.skill_id,
            name: s.skill_name,
            proficiency: s.proficiency,
            years: s.years,
            last_used: s.last_used,
            certified: s.certified,
          })),
        next_tasks: (onBench?.best_tasks ?? []).map((t) => ({ ...t, missing_must_haves: [] })),
      }
      return HttpResponse.json(body)
    }),

    http.get(api('/planning/skill-gaps'), ({ request }) => {
      const horizon = Number(new URL(request.url).searchParams.get('horizon_days') ?? 90)
      const open = db.tasks.filter((t) => t.status === 'open')
      const needing = new Map<string, { name: string; codes: string[]; min: number }>()
      for (const t of open) {
        for (const r of t.requirements.filter((x) => x.must_have)) {
          const n = needing.get(r.skill.id) ?? { name: r.skill.name, codes: [], min: 0 }
          n.codes.push(t.code)
          n.min = Math.max(n.min, r.min_proficiency)
          needing.set(r.skill.id, n)
        }
      }
      const order = { shortage: 0, tight: 1, covered: 2 }
      const gaps: SkillGap[] = [...needing.entries()]
        .map(([id, n]) => {
          const have = employees.filter((e) =>
            e.skills.some((s) => s.skill_id === id && s.proficiency >= n.min),
          )
          const tasks = n.codes.length
          const status: SkillGap['status'] =
            have.length < tasks ? 'shortage' : have.length < 2 * tasks ? 'tight' : 'covered'
          const close =
            status === 'covered'
              ? []
              : employees
                  .filter((e) =>
                    e.skills.some((s) => s.skill_id === id && s.proficiency === n.min - 1),
                  )
                  .slice(0, 3)
                  .map((e) => ({
                    employee_id: e.id,
                    employee_code: e.employee_code,
                    full_name: e.full_name,
                    designation: e.designation,
                    level: e.level,
                    cost_band: e.cost_band,
                    why: `has it at level ${n.min - 1} of ${n.min} needed`,
                  }))
          return {
            skill_id: id,
            skill_name: n.name,
            tasks_needing: tasks,
            task_codes: n.codes.slice(0, 10),
            available_now: have.length,
            gap: Math.max(tasks - have.length, 0),
            status,
            closest: close,
          }
        })
        .sort((a, b) => order[a.status] - order[b.status] || b.gap - a.gap)
      return HttpResponse.json({ horizon_days: horizon, open_tasks: open.length, gaps })
    }),

    http.post(api('/planning/staffing'), async ({ request }) => {
      const { task_ids } = (await request.json()) as { task_ids: string[] }
      const used = new Set<string>()
      const tasks: StaffedTask[] = []
      for (const id of task_ids) {
        const task = db.tasks.find((t) => t.id === id)
        if (!task) return problem(404, 'task_not_found', `Task ${id} not found`)
        const found = recommended(id)
        const pick = found?.items.find((i) => !used.has(i.employee.id))
        if (pick) used.add(pick.employee.id)
        tasks.push({
          task_id: task.id,
          task_code: task.code,
          title: task.title,
          proposed: pick ? person(pick) : null,
          alternates: (found?.items ?? [])
            .filter((i) => i !== pick)
            .slice(0, 2)
            .map(person),
          unfilled_reason: pick
            ? null
            : !found
              ? 'Run matching for this task first.'
              : found.items.length === 0
                ? 'Nobody was recommended in the latest matching run.'
                : 'Everyone recommended is already proposed for another task in this plan.',
        })
      }
      const filled = tasks.flatMap((t) => (t.proposed ? [t.proposed] : []))
      return HttpResponse.json({
        tasks,
        filled: filled.length,
        total_weekly_margin_usd: filled.reduce(
          (s, p) => s + p.margin.weekly_bill_usd - p.margin.weekly_cost_usd,
          0,
        ),
      })
    }),

    http.get(api('/tasks/:taskId/hire-or-move'), ({ params }) => {
      const task = db.tasks.find((t) => t.id === params.taskId)
      if (!task) return problem(404, 'task_not_found', 'Task not found')
      const found = recommended(task.id)
      const top = found?.items[0]
      const internal =
        found && top
          ? {
              ...person(top),
              available_from: byId.get(top.employee.id)?.available_from ?? TODAY,
              run_id: found.runId,
            }
          : null
      const body: HireOrMove = internal
        ? {
            recommendation: 'move_internal',
            reasons: ['Someone inside fits; no outside candidate is needed.'],
            internal,
            external: null,
          }
        : {
            recommendation: 'neither',
            reasons: [
              'Neither inside nor outside fits yet: ask HR for candidates or relax the task.',
              'No completed matching run with a recommended person yet.',
            ],
            internal: null,
            external: null,
          }
      return HttpResponse.json(body)
    }),

    http.get(api('/admin/rate-card'), () =>
      HttpResponse.json<RateCard>({ rows: rates, margin_target_pct: target, synthetic }),
    ),
    http.put(api('/admin/rate-card'), async ({ request }) => {
      const { rows, margin_target_pct } = (await request.json()) as {
        rows: RateCardLine[]
        margin_target_pct?: number | null
      }
      if (new Set(rows.map((r) => r.cost_band)).size !== 5) {
        return problem(422, 'rate_card_incomplete', 'Give one row for every cost band A-E')
      }
      rates = rows
      synthetic = false
      if (margin_target_pct != null) target = margin_target_pct
      return HttpResponse.json<RateCard>({ rows: rates, margin_target_pct: target, synthetic })
    }),

    http.get(api('/admin/audit/decisions.csv'), () =>
      HttpResponse.text('run_id,task_code,employee_code,band,manager_action\n', {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="decisions.csv"',
        },
      }),
    ),
  ]
}
