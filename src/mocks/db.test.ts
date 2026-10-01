import { QUEUED_MS, RUNNING_MS, createDb } from '@/mocks/db'

test('a new run goes queued -> running -> completed over time', () => {
  let t = 1_000_000
  const db = createDb(() => t)
  const task = db.tasks[0]
  if (!task) throw new Error('demo data has no tasks')

  const started = db.startRun(task.id)
  expect(started.status).toBe('queued')
  t += QUEUED_MS
  expect(db.getRun(started.id)?.status).toBe('running')
  t += RUNNING_MS
  expect(db.getRun(started.id)?.status).toBe('completed')
  expect(db.runsForTask(task.id)[0]?.id).toBe(started.id)
})

test('feedback is stored per run item', () => {
  const db = createDb()
  const task = db.tasks[0]
  if (!task) throw new Error('demo data has no tasks')
  const run = db.runsForTask(task.id)[0]
  const item = run && db.shortlist(run.id)?.[0]
  if (!item) throw new Error('demo run has no shortlist')

  db.saveFeedback(item.id, {
    action: 'accept',
    reject_reason: null,
    comment: null,
    by: 'u',
    at: 'now',
  })
  expect(db.findItem(item.id)?.feedback?.action).toBe('accept')
})
