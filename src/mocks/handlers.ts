import { http, HttpResponse } from 'msw'

import type { FeedbackInput, Page, Problem } from '@/api/types'
import type { Db } from '@/mocks/db'

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

export function createHandlers(db: Db) {
  const api = (path: string) => `*/api/v1${path}`

  return [
    http.get(api('/decisions'), () => HttpResponse.json({ items: db.decisions })),

    http.get(api('/tasks'), ({ request }) => {
      const url = new URL(request.url)
      const q = url.searchParams.get('q')?.toLowerCase()
      const priority = url.searchParams.get('priority')
      const domain = url.searchParams.get('domain')
      const tasks = db.tasks.filter(
        (t) =>
          (!q || `${t.code} ${t.title}`.toLowerCase().includes(q)) &&
          (!priority || t.priority === priority) &&
          (!domain || t.domain === domain),
      )
      return HttpResponse.json(page(tasks, url))
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
