import { HttpResponse, http } from 'msw'

import type {
  ClientProfile,
  CostBand,
  FairnessReport,
  Judgement,
  Level,
  OutcomeProof,
  OutcomeRead,
  OutcomeResult,
  PlanningActionCreate,
  PlanningActionRead,
  RollOffReport,
  WhatIfIn,
  WhatIfResult,
} from '@/api/types'
import type { Db } from '@/mocks/db'
import hrData from '@/mocks/data/hr.json'

const api = (path: string) => `*/api/v1${path}`
const TODAY = new Date().toISOString().slice(0, 10)
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

interface MockEmployee {
  id: string
  employee_code: string
  full_name: string
  designation: string
  level: Level
  cost_band: CostBand
  current_allocation_pct: number
  available_from: string
  location: string
  years_experience: number
  summary: string
  skills: {
    skill_id: string
    skill_name: string
    proficiency: number
    years: number
    last_used: string
  }[]
  projects: { domain: string; role_title: string; start_date: string; end_date: string }[]
}
const employees = (hrData as unknown as { employees: MockEmployee[] }).employees
const person = (e: MockEmployee) => ({
  employee_id: e.id,
  employee_code: e.employee_code,
  full_name: e.full_name,
  designation: e.designation,
  level: e.level,
  cost_band: e.cost_band,
})
const MARGIN = {
  weekly_cost_usd: 1300,
  weekly_bill_usd: 2100,
  margin_pct: 38.1,
  below_target: false,
}

function problem(status: number, code: string, detail: string) {
  return HttpResponse.json(
    { type: 'about:blank', title: code, status, code, detail },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

/** Outcomes, fairness, judgement, roll-offs, what-if and client profiles (ADR 025). */
export function createInsightHandlers(db: Db) {
  const answers = new Map<string, OutcomeResult>()
  const actions: PlanningActionRead[] = []
  // Rolling off: the first few mock people with work, ending within a month.
  const rolling = employees.slice(0, 3).map((e, i) => ({ ...e, ends: inDays(10 + i * 7) }))

  return [
    http.get(api('/tasks/:taskId/outcomes'), ({ params }) => {
      const task = db.tasks.find((t) => t.id === params.taskId)
      if (!task || task.status !== 'filled') return HttpResponse.json([])
      const run = db.runsForTask(task.id).find((r) => r.status === 'completed')
      const top = run ? (db.shortlist(run.id) ?? [])[0] : undefined
      if (!top) return HttpResponse.json([])
      const id = `outcome-${task.id}`
      const row: OutcomeRead = {
        id,
        task_id: task.id,
        task_code: task.code,
        employee_id: top.employee.id,
        employee_code: top.employee.employee_code,
        full_name: top.employee.full_name,
        rank: 1,
        band: top.band,
        score: top.rank_score,
        due_on: inDays(42),
        result: answers.get(id) ?? null,
        note: null,
        answered_at: answers.has(id) ? new Date().toISOString() : null,
      }
      return HttpResponse.json([row])
    }),
    http.put(api('/outcomes/:id'), async ({ params, request }) => {
      const { result } = (await request.json()) as { result: OutcomeResult }
      answers.set(String(params.id), result)
      return HttpResponse.json({ id: params.id, result })
    }),
    http.get(api('/admin/outcomes'), () => {
      const n = answers.size
      const good = [...answers.values()].filter((r) => r === 'working_well').length
      const group = (label: string) => ({ label, answered: n, working_well: good, rate: null })
      const body: OutcomeProof = {
        answered: n,
        waiting: 0,
        min_answers: 10,
        overall: group('All placements'),
        by_rank: [
          group('Ranked in the top 3'),
          { label: 'Ranked 4th or lower', answered: 0, working_well: 0, rate: null },
        ],
        by_band: [],
      }
      return HttpResponse.json(body)
    }),
    http.get(api('/admin/fairness'), ({ request }) => {
      const days = Number(new URL(request.url).searchParams.get('days') ?? 90)
      const body: FairnessReport = {
        days,
        runs: 15,
        min_group: 20,
        threshold: 0.8,
        attributes: [
          {
            attribute: 'location',
            groups: [
              {
                value: 'hyderabad',
                considered: 300,
                passed_rules: 210,
                recommended: 84,
                accepted: 9,
                recommend_rate: 0.4,
                ratio_to_best: 1,
                flagged: false,
                top_rule_reasons: { location: 40 },
              },
              {
                value: 'uk',
                considered: 120,
                passed_rules: 60,
                recommended: 15,
                accepted: 1,
                recommend_rate: 0.25,
                ratio_to_best: 0.625,
                flagged: true,
                top_rule_reasons: { timezone: 30 },
              },
            ],
          },
          { attribute: 'practice', groups: [] },
          { attribute: 'level', groups: [] },
        ],
      }
      return HttpResponse.json(body)
    }),
    http.get(api('/admin/judgement'), () => {
      const body: Judgement = {
        trained_on: 'demo',
        company_own: false,
        factors: [
          {
            feature: 'must_have_coverage',
            label: 'Has the must-have skills',
            weight: 1.36,
            share: 1,
            direction: 'raises',
          },
          {
            feature: 'p_overall_fit',
            label: "The model's overall-fit answer",
            weight: 1.26,
            share: 0.93,
            direction: 'raises',
          },
          {
            feature: 'stale_skills',
            label: 'Has not used the skills recently',
            weight: -0.53,
            share: 0.39,
            direction: 'lowers',
          },
        ],
        reject_reasons: { skill_gap: 3, availability: 1 },
      }
      return HttpResponse.json(body)
    }),
    http.get(api('/planning/roll-offs'), ({ request }) => {
      const days = Number(new URL(request.url).searchParams.get('days') ?? 45)
      const open = db.tasks.filter((t) => t.status === 'open')
      const items = rolling.map((e, i) => {
        const t = open[i]
        return {
          ...person(e),
          rolls_off_on: e.ends,
          current_project: 'Route Optimisation',
          current_client: 'CL-NOVA',
          current_allocation_pct: 100,
          weekly_cost_usd: 1300,
          next_tasks:
            i === 2 || !t
              ? []
              : [
                  {
                    task_id: t.id,
                    task_code: t.code,
                    title: t.title,
                    start_date: t.start_date,
                    must_have_coverage: 0.67,
                  },
                ],
          near_miss:
            i === 2 && open[0]
              ? {
                  task_id: open[0].id,
                  task_code: open[0].code,
                  skill_id: e.skills[0]?.skill_id ?? 'x',
                  skill_name: 'Kubernetes',
                  has_level: 2,
                  needs_level: 3,
                }
              : null,
          actions: actions.filter((a) => a.employee_id === e.id && a.status === 'open'),
        }
      })
      const body: RollOffReport = {
        days,
        people: items.length,
        weekly_cost_at_risk_usd: 1300,
        with_next_task: items.filter((x) => x.next_tasks.length > 0).length,
        items,
      }
      return HttpResponse.json(body)
    }),
    http.post(api('/planning/actions'), async ({ request }) => {
      const body = (await request.json()) as PlanningActionCreate
      if (body.kind === 'hold' && !body.task_id) {
        return problem(422, 'task_required', 'Choose the task to hold this person for')
      }
      const made: PlanningActionRead = {
        id: `act-${actions.length + 1}`,
        kind: body.kind,
        employee_id: body.employee_id,
        task_id: body.task_id ?? null,
        task_code: db.tasks.find((t) => t.id === body.task_id)?.code ?? null,
        skill_id: body.skill_id ?? null,
        skill_name: body.kind === 'upskill' ? 'Kubernetes' : null,
        target_level: body.target_level ?? null,
        due_on: body.due_on ?? null,
        note: body.note,
        status: 'open',
        created_at: new Date().toISOString(),
      }
      actions.push(made)
      return HttpResponse.json(made, { status: 201 })
    }),
    http.patch(api('/planning/actions/:id'), async ({ params, request }) => {
      const { status } = (await request.json()) as { status: PlanningActionRead['status'] }
      const a = actions.find((x) => x.id === params.id)
      if (!a) return problem(404, 'action_not_found', 'Planning action not found')
      a.status = status
      return HttpResponse.json(a)
    }),
    http.get(api('/planning/people/:employeeId/actions'), ({ params }) =>
      HttpResponse.json(actions.filter((a) => a.employee_id === params.employeeId)),
    ),
    http.post(api('/planning/what-if'), async ({ request }) => {
      const body = (await request.json()) as WhatIfIn
      const used = new Set<string>()
      const roles = body.roles.map((r) => {
        const fits = employees.filter(
          (e) =>
            !used.has(e.id) &&
            r.skills.some((s) =>
              e.skills.some((x) => x.skill_id === s.skill_id && x.proficiency >= s.min_proficiency),
            ),
        )
        const proposed = fits.slice(0, r.people).map((e) => {
          used.add(e.id)
          return { ...person(e), must_have_coverage: 1, free_from: TODAY, margin: MARGIN }
        })
        const wanted = r.people
        return {
          title: r.title,
          wanted,
          proposed,
          to_hire: wanted - proposed.length,
          missing_skills: [],
        }
      })
      const staffed = roles.reduce((s, r) => s + r.proposed.length, 0)
      const result: WhatIfResult = {
        roles,
        staffed,
        wanted: roles.reduce((s, r) => s + r.wanted, 0),
        weekly_revenue_usd: staffed * 2100,
        weekly_margin_usd: staffed * 800,
      }
      return HttpResponse.json(result)
    }),
    http.get(api('/planning/people/:employeeId/client-profile'), ({ params }) => {
      const e = employees.find((x) => x.id === params.employeeId)
      if (!e) return problem(404, 'employee_not_found', 'Employee not found')
      const body: ClientProfile = {
        full_name: e.full_name,
        designation: e.designation,
        level_title: 'Engineer',
        years_experience: e.years_experience,
        location: e.location,
        summary: e.summary,
        skills: e.skills
          .filter((s) => s.proficiency >= 3)
          .map((s) => ({ name: s.skill_name, years: s.years, last_used: s.last_used })),
        experience: e.projects.map((p) => ({
          role_title: p.role_title,
          domain: p.domain,
          months: Math.max(
            1,
            Math.round((Date.parse(p.end_date) - Date.parse(p.start_date)) / 2.63e9),
          ),
          skills: [],
        })),
      }
      return HttpResponse.json(body)
    }),
  ]
}
