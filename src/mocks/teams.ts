import { HttpResponse, http } from 'msw'

import type { Level, ShortlistItem, Team, TeamCandidate, TeamPerson, TeamSave } from '@/api/types'
import type { Db } from '@/mocks/db'
import { unitFor } from '@/mocks/org'

const api = (path: string) => `*/api/v1${path}`

function problem(status: number, code: string, detail: string) {
  return HttpResponse.json(
    { type: 'about:blank', title: code, status, code, detail },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

const LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']

/** Teams for tasks (ADR 039), from each task's mock matching run: the most senior people lead,
 * the next ones are members, and the rest can shadow. */
export function createTeamHandlers(db: Db) {
  const teams = new Map<string, Team>()
  const items = (taskId: string): ShortlistItem[] | null => {
    const run = db.runsForTask(taskId).find((r) => r.status === 'completed')
    return run ? (db.shortlist(run.id) ?? []).filter((i) => i.band !== 'hidden') : null
  }
  const candidate = (i: ShortlistItem, reasons: string[], suggested = false): TeamCandidate => ({
    employee_id: i.employee.id,
    employee_code: i.employee.employee_code,
    full_name: i.employee.full_name,
    designation: i.employee.designation,
    level: i.employee.level,
    cost_band: 'C',
    business_unit: unitFor(i.employee.id),
    practice: 'data_engineering',
    coverage: 1,
    score: Math.round(i.rank_score * 1000) / 1000,
    free_from: new Date().toISOString().slice(0, 10),
    reasons,
    suggested,
  })
  const task = (taskId: string) => db.tasks.find((t) => t.id === taskId)
  const summary = (taskId: string) => {
    const t = task(taskId)
    if (!t) return null
    return {
      task_id: t.id,
      code: t.code,
      title: t.title,
      client_code: t.client_code,
      required_level: t.required_level,
      start_date: t.start_date,
      duration_weeks: t.duration_weeks,
      headcount: t.headcount,
      allocation_pct_required: t.allocation_pct_required,
    }
  }
  const bySeniority = (list: ShortlistItem[]) =>
    [...list].sort(
      (a, b) =>
        LEVELS.indexOf(b.employee.level) - LEVELS.indexOf(a.employee.level) ||
        b.rank_score - a.rank_score,
    )

  return [
    http.get(api('/tasks/:taskId/team/leads'), ({ params }) => {
      const s = summary(String(params.taskId))
      if (!s) return problem(404, 'task_not_found', 'Task not found')
      const list = items(s.task_id)
      const run = db.runsForTask(s.task_id).find((r) => r.status === 'completed')
      return HttpResponse.json({
        task: s,
        run_id: run?.id ?? null,
        leads: bySeniority(list ?? [])
          .slice(0, 3)
          .map((i, n) =>
            candidate(i, ['Every must-have skill', `Level ${i.employee.level}`], n === 0),
          ),
      })
    }),
    http.get(api('/tasks/:taskId/team/members'), ({ params, request }) => {
      const s = summary(String(params.taskId))
      if (!s) return problem(404, 'task_not_found', 'Task not found')
      const list = items(s.task_id)
      if (!list) return problem(409, 'run_needed', 'Run matching for this task first.')
      const lead = new URL(request.url).searchParams.get('lead_id')
      const needed = Math.max(s.headcount - 1, 0)
      const rest = list
        .filter((i) => i.employee.id !== lead)
        .map((i) => candidate(i, ['Every must-have skill', 'Below the lead']))
      return HttpResponse.json({
        needed,
        members: rest.slice(0, needed),
        alternates: rest.slice(needed, needed + 4),
      })
    }),
    http.get(api('/tasks/:taskId/team/shadows'), ({ params, request }) => {
      const taken = new URL(request.url).searchParams.getAll('team_ids')
      const list = items(String(params.taskId)) ?? []
      return HttpResponse.json(
        list
          .filter((i) => !taken.includes(i.employee.id))
          .slice(-3)
          .map((i) => candidate(i, ['Learning a must-have skill'])),
      )
    }),
    http.post(api('/teams'), async ({ request }) => {
      const body = (await request.json()) as TeamSave
      const s = summary(body.task_id)
      if (!s) return problem(404, 'task_not_found', 'Task not found')
      if (body.member_ids.length + 1 !== s.headcount)
        return problem(422, 'team_size', `This task needs ${s.headcount} people`)
      const people = new Map(
        (items(s.task_id) ?? []).map((i) => [i.employee.id, candidate(i, [])] as const),
      )
      const person = (id: string, role: TeamPerson['role']): TeamPerson => {
        const c = people.get(id)
        return {
          employee_id: id,
          employee_code: c?.employee_code ?? 'SPY-00000',
          full_name: c?.full_name ?? 'Someone',
          designation: c?.designation ?? 'Engineer',
          level: c?.level ?? 'L3',
          cost_band: 'C',
          business_unit: c?.business_unit ?? null,
          role,
          allocation_pct: role === 'shadow' ? 25 : s.allocation_pct_required,
        }
      }
      for (const [id, t] of teams) if (t.task.task_id === s.task_id) teams.delete(id)
      const team: Team = {
        id: crypto.randomUUID(),
        task: s,
        lead: person(body.lead_id, 'lead'),
        members: body.member_ids.map((id) => person(id, 'member')),
        shadow: body.shadow_id ? person(body.shadow_id, 'shadow') : null,
        created_at: new Date().toISOString(),
        created_by: 'Resource Manager 1',
      }
      teams.set(team.id, team)
      return HttpResponse.json(team, { status: 201 })
    }),
    http.get(api('/teams'), ({ request }) => {
      const taskId = new URL(request.url).searchParams.get('task_id')
      return HttpResponse.json(
        [...teams.values()].filter((t) => !taskId || t.task.task_id === taskId),
      )
    }),
    http.get(api('/teams/:teamId'), ({ params }) => {
      const team = teams.get(String(params.teamId))
      return team ? HttpResponse.json(team) : problem(404, 'team_not_found', 'Team not found')
    }),
    http.delete(api('/teams/:teamId'), ({ params }) => {
      if (!teams.delete(String(params.teamId)))
        return problem(404, 'team_not_found', 'Team not found')
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}
