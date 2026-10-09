import { HttpResponse, http } from 'msw'

import type {
  CareerView,
  ClientRateIn,
  ClientRateLine,
  CostBand,
  DataQuality,
  SkillSuggestion,
} from '@/api/types'
import hrData from '@/mocks/data/hr.json'

const api = (path: string) => `*/api/v1${path}`

interface MockEmployee {
  id: string
  employee_code: string
  full_name: string
  designation: string
  level: string
  cost_band: CostBand
}
const employees = (hrData as unknown as { employees: MockEmployee[] }).employees
const BILL: Record<CostBand, [number, number]> = {
  A: [600, 1000],
  B: [900, 1500],
  C: [1300, 2100],
  D: [1800, 2900],
  E: [2500, 4000],
}

/** Fresh skills, career paths, data quality and client rates (ADR 027). */
export function createQualityHandlers() {
  const decided = new Set<string>()
  const clientRates: ClientRateIn[] = []

  const suggestionsFor = (employeeId: string): SkillSuggestion[] =>
    [
      {
        id: `${employeeId}-s1`,
        skill_id: 'skill-kubernetes',
        skill_name: 'Kubernetes',
        source: 'Project Route Optimisation',
        evidence_date: '2026-07-20',
      },
      {
        id: `${employeeId}-s2`,
        skill_id: 'skill-terraform',
        skill_name: 'Terraform',
        source: 'Placed on TSK-0007',
        evidence_date: '2026-09-01',
      },
    ].filter((s) => !decided.has(s.id))

  const line = (r: ClientRateIn): ClientRateLine => {
    const [cost, bill] = BILL[r.cost_band]
    const pct = Math.round((1000 * (r.weekly_bill_usd - cost)) / r.weekly_bill_usd) / 10
    return {
      ...r,
      default_bill_usd: bill,
      margin: {
        weekly_cost_usd: cost,
        weekly_bill_usd: r.weekly_bill_usd,
        margin_pct: pct,
        below_target: pct < 30,
      },
    }
  }

  return [
    http.get(api('/employees/:employeeId/skill-suggestions'), ({ params }) =>
      HttpResponse.json(suggestionsFor(String(params.employeeId))),
    ),
    http.post(api('/employees/:employeeId/skill-suggestions/:id/:decision'), ({ params }) => {
      decided.add(String(params.id))
      return new HttpResponse(null, { status: 204 })
    }),
    http.get(api('/planning/people/:employeeId/career'), ({ params }) => {
      const e = employees.find((x) => x.id === params.employeeId) ?? employees[0]
      if (!e) return HttpResponse.json({ code: 'employee_not_found' }, { status: 404 })
      const body: CareerView = {
        employee_id: e.id,
        full_name: e.full_name,
        designation: e.designation,
        level: e.level,
        fits_now: 4,
        fits_open_now: 1,
        looked_at: 18,
        paths: [
          {
            skills: [
              { skill_id: 'skill-kubernetes', name: 'Kubernetes', has_level: 2, needs_level: 3 },
            ],
            tasks: 6,
            open_now: 2,
            next_level: false,
            examples: ['Cloud Engineer for Finance ERP', 'DevOps Engineer for Claims Platform'],
          },
          {
            skills: [
              { skill_id: 'skill-spark', name: 'Spark', has_level: 0, needs_level: 3 },
              { skill_id: 'skill-airflow', name: 'Airflow', has_level: 1, needs_level: 3 },
            ],
            tasks: 5,
            open_now: 1,
            next_level: true,
            examples: ['Senior Data Engineer for Records Digitisation'],
          },
        ],
      }
      return HttpResponse.json(body)
    }),
    http.get(api('/data-quality'), () => {
      const body: DataQuality = {
        people: employees.length,
        trusted: Math.round(employees.length * 0.62),
        score: 0.62,
        headline: 'Matching is limited by profile not reviewed recently for 30% of people.',
        issues: [
          { issue: 'not_reviewed', label: 'profile not reviewed recently', people: 9, share: 0.3 },
          {
            issue: 'stale_skills',
            label: 'stale skills (none used in 18 months)',
            people: 4,
            share: 0.13,
          },
          { issue: 'few_skills', label: 'fewer than 3 skills', people: 2, share: 0.07 },
          { issue: 'no_projects', label: 'no project history', people: 1, share: 0.03 },
        ],
        fix_first: employees.slice(0, 3).map((e) => ({
          employee_id: e.id,
          employee_code: e.employee_code,
          full_name: e.full_name,
          designation: e.designation,
          level: e.level as DataQuality['fix_first'][number]['level'],
          cost_band: e.cost_band,
          business_unit: null,
          issues: ['profile not reviewed recently'],
          why_first: 'free now or soon',
        })),
      }
      return HttpResponse.json(body)
    }),
    http.post(api('/data-quality/refresh-skills'), () =>
      HttpResponse.json({ people: employees.length, dates_updated: 12, suggestions_added: 3 }),
    ),
    http.get(api('/admin/client-rates'), () => HttpResponse.json(clientRates.map(line))),
    http.put(api('/admin/client-rates'), async ({ request }) => {
      const body = (await request.json()) as ClientRateIn
      const i = clientRates.findIndex(
        (r) => r.client_code === body.client_code && r.cost_band === body.cost_band,
      )
      if (i >= 0) clientRates.splice(i, 1, body)
      else clientRates.push(body)
      return HttpResponse.json(clientRates.map(line))
    }),
    http.delete(api('/admin/client-rates/:client/:band'), ({ params }) => {
      const i = clientRates.findIndex(
        (r) => r.client_code === params.client && r.cost_band === params.band,
      )
      if (i < 0) return HttpResponse.json({ code: 'client_rate_not_found' }, { status: 404 })
      clientRates.splice(i, 1)
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}
