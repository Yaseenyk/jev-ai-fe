import { HttpResponse, http } from 'msw'

import type {
  AssignmentRead,
  CapacityReport,
  CourseIn,
  CourseRead,
  DealIn,
  DealRead,
  DemandForecast,
  Digest,
  InterpretedSearch,
  InterviewPlan,
  KeyPersonReport,
  LearningStatus,
  MyProfile,
  OpportunityReport,
  PeopleFilters,
  PeopleSearchResult,
  PersonRef,
  PreferencesIn,
  PreferencesRead,
  RfpDrafts,
  SavingsReport,
  SetupStatus,
  TeamIn,
  TeamPlan,
  WorkingOn,
} from '@/api/types'
import type { Db } from '@/mocks/db'
import hrData from '@/mocks/data/hr.json'

const api = (path: string) => `*/api/v1${path}`

interface MockEmployee {
  id: string
  employee_code: string
  full_name: string
  designation: string
  level: PersonRef['level']
  cost_band: PersonRef['cost_band']
}
const employees = (hrData as unknown as { employees: MockEmployee[] }).employees
const ref = (e: MockEmployee): PersonRef => ({
  employee_id: e.id,
  employee_code: e.employee_code,
  full_name: e.full_name,
  designation: e.designation,
  level: e.level,
  cost_band: e.cost_band,
  business_unit: null,
})
const person = (i: number) => ref(employees[i % employees.length] as MockEmployee)

/** Mock workforce pack (ADR 031): fixed sample answers; state kept per handler set. */
export function createWorkforceHandlers(db: Db) {
  const prefs = new Map<string, PreferencesRead>()
  const courses: CourseRead[] = []
  const plans: AssignmentRead[] = []
  const deals: DealRead[] = []
  const myRequests: string[] = []
  let myPrefs: PreferencesRead | null = null
  const skillName = (id: string) => db.skills.find((s) => s.id === id)?.name ?? id
  const firstSkill = db.skills[0]

  return [
    http.get(api('/planning/key-person-risk'), () =>
      HttpResponse.json<KeyPersonReport>({
        scarce_skills: [
          {
            skill_id: firstSkill?.id ?? 's1',
            name: firstSkill?.name ?? 'Informatica',
            experts: [person(0)],
            open_tasks: 3,
            backups: [{ ...person(1), proficiency: 3, free_pct_now: 100 }],
            courses: 0,
          },
        ],
        projects: [],
      }),
    ),
    http.post(api('/planning/team'), async ({ request }) => {
      const body = (await request.json()) as TeamIn
      const members = body.roles.flatMap((r, ri) =>
        Array.from({ length: Math.min(r.count, 2) }, (_, k) => ({
          ...person(ri * 2 + k),
          role: r.title,
          fit: 0.9,
          worked_with: k === 1 ? [person(ri * 2).full_name] : [],
          weekly_cost_usd: 1300,
          weekly_bill_usd: 2100,
        })),
      )
      const cost = members.reduce((n, m) => n + m.weekly_cost_usd, 0)
      const bill = members.reduce((n, m) => n + m.weekly_bill_usd, 0)
      return HttpResponse.json<TeamPlan>({
        members,
        gaps: body.roles
          .filter((r) => r.count > 2)
          .map((r) => ({
            role: r.title,
            missing: r.count - 2,
            reason: 'not enough free people with the skills at this level',
          })),
        alternates: {},
        weekly_cost_usd: cost,
        weekly_bill_usd: bill,
        margin_pct: bill ? Math.round((1000 * (bill - cost)) / bill) / 10 : 0,
        within_budget: body.weekly_budget_usd == null ? null : cost <= body.weekly_budget_usd,
      })
    }),
    http.get(api('/planning/opportunity'), () =>
      HttpResponse.json<OpportunityReport>({
        long_bench: [{ ...person(2), reason: 'On the bench', days: 64 }],
        same_client: [],
        passed_over: [
          { ...person(3), reason: 'Recommended 4 times in 90 days, never accepted', days: null },
        ],
      }),
    ),
    http.get(api('/planning/capacity'), ({ request }) => {
      const months = Number(new URL(request.url).searchParams.get('months') ?? 6)
      const start = new Date()
      const list = Array.from({ length: months }, (_, i) =>
        new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1))
          .toISOString()
          .slice(0, 10),
      )
      const row = (practice: string, people: number) => ({
        practice,
        cells: list.map((m, i) => ({
          month: m,
          people,
          booked_fte: Math.max(0, people - 4 - i),
          leave_fte: 0.5,
          free_fte: Math.min(people, 3.5 + i),
          idle_cost_usd: Math.round((3.5 + i) * 1300 * 4.3),
        })),
      })
      return HttpResponse.json({
        months: list,
        rows: [row('data_analytics', 40), row('app_dev', 55)],
        open_task_fte: list.map((_, i) => Math.max(0, 6 - i)),
      } as CapacityReport)
    }),
    http.post(api('/people-search/interpret'), async ({ request }) => {
      const { q } = (await request.json()) as { q: string }
      const hit = db.skills.find((s) => q.toLowerCase().includes(s.name.toLowerCase()))
      const filters: PeopleFilters = {
        skill_ids: hit ? [hit.id] : [],
        min_proficiency: /senior|expert|strong/i.test(q) ? 4 : 1,
        levels: /senior/i.test(q) ? ['L4'] : [],
        locations: /hyderabad/i.test(q) ? ['hyderabad'] : [],
        practices: [],
        available_within_days: /now/i.test(q) ? 0 : null,
        min_free_pct: 0,
      }
      return HttpResponse.json<InterpretedSearch>({
        filters,
        skill_names: hit ? { [hit.id]: hit.name } : {},
        unmatched_skills: /cobol/i.test(q) ? ['COBOL'] : [],
        model: 'mock',
      })
    }),
    http.post(api('/people-search'), async ({ request }) => {
      const body = (await request.json()) as PeopleFilters
      const f = {
        levels: body.levels ?? [],
        skill_ids: body.skill_ids ?? [],
        min_proficiency: body.min_proficiency,
      }
      const items = employees
        .filter((e) => f.levels.length === 0 || f.levels.includes(e.level))
        .slice(0, f.skill_ids.length ? 3 : 8)
        .map((e) => ({
          ...ref(e),
          location: 'hyderabad' as const,
          practice: 'data_analytics' as const,
          matched_skills: f.skill_ids.map(
            (id) => `${skillName(id)} ${Math.max(3, f.min_proficiency)}/5`,
          ),
          free_pct_now: 100,
          available_from: '2026-10-01',
        }))
      return HttpResponse.json<PeopleSearchResult>({ items, total: items.length })
    }),
    http.post(api('/tasks/from-request'), () => {
      const s = db.skills.slice(0, 2)
      return HttpResponse.json<RfpDrafts>({
        drafts: [
          {
            title: 'Senior Data Engineer',
            required_level: 'L4',
            count: 2,
            duration_weeks: 24,
            start_in_weeks: 4,
            domain: 'healthcare',
            skills: s.map((x, i) => ({ skill_id: x.id, name: x.name, must_have: i === 0 })),
            unmatched_skills: ['Mainframe'],
          },
        ],
        notes: [],
        model: 'mock',
      })
    }),
    http.post(api('/candidates/:id/interview-questions'), () =>
      HttpResponse.json<InterviewPlan>({
        gaps: [`${firstSkill?.name ?? 'Python'} (must-have): needs 3/5, resume shows 1/5`],
        questions: [
          {
            skill: firstSkill?.name ?? 'Python',
            question: 'Walk me through the hardest thing you built with it.',
            listen_for: 'Concrete design choices and how they handled failures.',
          },
        ],
        source: 'ai',
      }),
    ),
    http.get(api('/employees/:id/preferences'), ({ params }) =>
      HttpResponse.json(prefs.get(String(params.id)) ?? null),
    ),
    http.put(api('/employees/:id/preferences'), async ({ params, request }) => {
      const body = (await request.json()) as PreferencesIn
      if (!body.consent) {
        return HttpResponse.json(
          {
            title: 'Validation',
            status: 422,
            code: 'consent_required',
            detail: "Record preferences only with the person's consent",
          },
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        )
      }
      const read: PreferencesRead = {
        domains: body.domains ?? [],
        skill_ids: body.skill_ids ?? [],
        skill_names: (body.skill_ids ?? []).map(skillName),
        locations: body.locations ?? [],
        consent_at: new Date().toISOString(),
        recorded_by: 'hr',
      }
      prefs.set(String(params.id), read)
      return HttpResponse.json(read)
    }),
    http.delete(api('/employees/:id/preferences'), ({ params }) => {
      prefs.delete(String(params.id))
      return new HttpResponse(null, { status: 204 })
    }),
    http.get(api('/courses'), () => HttpResponse.json(courses)),
    http.post(api('/courses'), async ({ request }) => {
      const body = (await request.json()) as CourseIn
      const c: CourseRead = {
        ...body,
        id: crypto.randomUUID(),
        skill_name: skillName(body.skill_id),
        learners: 0,
        url: body.url ?? null,
      }
      courses.push(c)
      return HttpResponse.json(c, { status: 201 })
    }),
    http.get(api('/learning'), () =>
      HttpResponse.json({
        courses: courses.length,
        in_progress: plans.filter((p) => p.status === 'in_progress').length,
        done_last_90_days: plans.filter((p) => p.status === 'done').length,
        overdue: plans.filter((p) => p.overdue).length,
        spend_usd: plans
          .filter((p) => p.status !== 'dropped')
          .reduce((n, p) => n + p.course.cost_usd, 0),
        assignments: plans,
      }),
    ),
    http.get(api('/employees/:id/learning'), ({ params }) =>
      HttpResponse.json(plans.filter((p) => p.employee_id === params.id)),
    ),
    http.post(api('/employees/:id/learning'), async ({ params, request }) => {
      const body = (await request.json()) as { course_id: string; due_date: string | null }
      const course = courses.find((c) => c.id === body.course_id)
      if (!course) return HttpResponse.json({ code: 'course_not_found' }, { status: 404 })
      const e = employees.find((x) => x.id === params.id)
      const a: AssignmentRead = {
        id: crypto.randomUUID(),
        employee_id: String(params.id),
        full_name: e?.full_name ?? 'Employee',
        course,
        status: 'planned',
        due_date: body.due_date,
        overdue: false,
        completed_at: null,
      }
      plans.push(a)
      return HttpResponse.json(a, { status: 201 })
    }),
    http.patch(api('/learning/:id'), async ({ params, request }) => {
      const { status } = (await request.json()) as { status: LearningStatus }
      const a = plans.find((p) => p.id === params.id)
      if (!a) return HttpResponse.json({ code: 'assignment_not_found' }, { status: 404 })
      a.status = status
      a.completed_at = status === 'done' ? new Date().toISOString() : null
      return HttpResponse.json(a)
    }),

    // --- ADR 032 -----------------------------------------------------------------------------
    http.delete(api('/courses/:id'), ({ params }) => {
      const i = courses.findIndex((c) => c.id === params.id)
      if (i >= 0) courses.splice(i, 1)
      return new HttpResponse(null, { status: 204 })
    }),
    http.get(api('/planning/deals'), () => HttpResponse.json(deals)),
    http.post(api('/planning/deals'), async ({ request }) => {
      const body = (await request.json()) as DealIn
      const people = body.roles.reduce((n, r) => n + r.count, 0)
      const d: DealRead = {
        ...body,
        client_code: body.client_code ?? null,
        id: crypto.randomUUID(),
        status: 'open',
        people,
        expected_people: Math.round(people * body.win_pct) / 100,
      }
      deals.push(d)
      return HttpResponse.json(d, { status: 201 })
    }),
    http.patch(api('/planning/deals/:id'), async ({ params, request }) => {
      const d = deals.find((x) => x.id === params.id)
      if (!d) return HttpResponse.json({ code: 'deal_not_found' }, { status: 404 })
      Object.assign(d, (await request.json()) as Partial<DealRead>)
      return HttpResponse.json(d)
    }),
    http.delete(api('/planning/deals/:id'), ({ params }) => {
      const i = deals.findIndex((x) => x.id === params.id)
      if (i >= 0) deals.splice(i, 1)
      return new HttpResponse(null, { status: 204 })
    }),
    http.get(api('/planning/demand'), () => {
      const live = deals.filter((d) => d.status !== 'lost')
      const expected = new Map<string, number>()
      for (const d of live)
        for (const r of d.roles)
          for (const s of r.skill_ids)
            expected.set(
              s,
              (expected.get(s) ?? 0) + (r.count * (d.status === 'won' ? 100 : d.win_pct)) / 100,
            )
      const skills = [...expected].map(([id, n]) => ({
        skill_id: id,
        name: skillName(id),
        open_tasks: 1,
        expected_from_deals: n,
        free_people: 1,
        shortage: n,
      }))
      return HttpResponse.json<DemandForecast>({
        deals_open: deals.filter((d) => d.status === 'open').length,
        expected_people: live.reduce((n, d) => n + d.expected_people, 0),
        windows: [30, 60, 90].map((days) => ({ days, skills })),
      })
    }),
    http.get(api('/employees/:id/working-on'), () =>
      HttpResponse.json<WorkingOn>({
        hours_last_14_days: 72,
        days_logged: 9,
        skills_mentioned: ['Databricks', 'Python'],
        latest: [
          {
            work_date: '2026-10-08',
            hours: 8,
            description: 'Claims pipeline on Databricks; Python data checks.',
          },
        ],
        last_logged: '2026-10-08',
      }),
    ),
    http.get(api('/reports/savings'), () => {
      const month = (m: string, n: number) => ({
        month: m,
        tasks_filled: n,
        filled_inside: n - 1,
        hires: 1,
        avg_days_to_fill: 6.5,
        weekly_bill_placed_usd: 2100 * (n - 1),
        weekly_margin_placed_usd: 800 * (n - 1),
      })
      return HttpResponse.json<SavingsReport>({
        this_month: month('2026-10-01', 4),
        last_month: month('2026-09-01', 2),
        bench_people_now: 41,
        weekly_idle_cost_now_usd: 38500,
        hire_cost_avoided_usd: 12000,
        hire_cost_assumed_usd: 4000,
        notes: ['Bench and idle cost are the figures for today.'],
      })
    }),
    http.get(api('/setup'), () =>
      HttpResponse.json<SetupStatus>({
        done: 2,
        total: 3,
        steps: [
          {
            key: 'employees',
            title: 'Import your employees',
            done: true,
            detail: '720 employees',
            link: '/import',
          },
          {
            key: 'units',
            title: 'Set up business units',
            done: true,
            detail: 'Units and heads',
            link: '/company?tab=units',
          },
          {
            key: 'rates',
            title: 'Enter your rate card',
            done: false,
            detail: 'Real rates make margins real.',
            link: '/admin?tab=rate-card',
          },
        ],
      }),
    ),
    http.get(api('/me/digest'), () =>
      HttpResponse.json<Digest>({
        title: 'Your week',
        lines: [{ text: '3 open tasks; 1 not matched yet', link: '/tasks' }],
      }),
    ),
    http.get(api('/me/profile'), () => {
      const e = employees[0] as MockEmployee
      return HttpResponse.json<MyProfile>({
        employee_id: e.id,
        full_name: e.full_name,
        designation: e.designation,
        level: e.level,
        skills: db.skills.slice(0, 3).map((s, i) => ({
          skill_id: s.id,
          name: s.name,
          proficiency: 4 - i,
          years: 3,
          last_used: '2026-09-01',
        })),
        pending_skills: myRequests.map((r) => ({
          id: r,
          skill_id: r,
          skill_name: skillName(r),
          source: 'Self-reported',
          evidence_date: '2026-10-09',
        })),
        learning: [],
        preferences: myPrefs,
        working_on: {
          hours_last_14_days: 0,
          days_logged: 0,
          skills_mentioned: [],
          latest: [],
          last_logged: null,
        },
        career: null,
      })
    }),
    http.post(api('/me/skill-requests'), async ({ request }) => {
      const { skill_id } = (await request.json()) as { skill_id: string }
      myRequests.push(skill_id)
      return new HttpResponse(null, { status: 204 })
    }),
    http.put(api('/me/preferences'), async ({ request }) => {
      const body = (await request.json()) as PreferencesIn
      myPrefs = {
        domains: body.domains ?? [],
        skill_ids: body.skill_ids ?? [],
        skill_names: (body.skill_ids ?? []).map(skillName),
        locations: body.locations ?? [],
        consent_at: new Date().toISOString(),
        recorded_by: 'me',
      }
      return HttpResponse.json(myPrefs)
    }),
  ]
}
