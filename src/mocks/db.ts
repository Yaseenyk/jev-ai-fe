import type {
  DecisionDefinition,
  ExcludedCandidate,
  Feedback,
  MatchRun,
  ShortlistItem,
  Task,
} from '@/api/types'
import demo from '@/mocks/data/demo.json'

interface RecordedRun {
  run: MatchRun
  shortlist: ShortlistItem[]
  excluded: ExcludedCandidate[]
}

interface DemoData {
  source: string
  decisions: DecisionDefinition[]
  tasks: Task[]
  runs: Record<string, RecordedRun>
}

interface RunState {
  run: MatchRun
  recorded: RecordedRun
  createdAt: number
}

export const QUEUED_MS = 800
export const RUNNING_MS = 3000

const data = demo as unknown as DemoData

export function createDb(now: () => number = Date.now) {
  const runs = new Map<string, RunState>()
  const feedback = new Map<string, Feedback>()

  // Each task starts with its recorded run as history, so results are viewable without re-running.
  for (const recorded of Object.values(data.runs)) {
    runs.set(recorded.run.id, { run: recorded.run, recorded, createdAt: 0 })
  }

  const itemId = (runId: string, employeeId: string) => `${runId}:${employeeId}`

  function currentRun(state: RunState): MatchRun {
    if (state.createdAt === 0) return state.run
    const elapsed = now() - state.createdAt
    if (elapsed < QUEUED_MS) return { ...state.run, status: 'queued', started_at: null }
    if (elapsed < RUNNING_MS) return { ...state.run, status: 'running', finished_at: null }
    return state.run
  }

  function shortlist(runId: string): ShortlistItem[] | undefined {
    const state = runs.get(runId)
    if (!state) return undefined
    return state.recorded.shortlist.map((item) => {
      const id = itemId(runId, item.employee.id)
      return { ...item, id, feedback: feedback.get(id) ?? null }
    })
  }

  return {
    source: data.source,
    decisions: data.decisions,
    tasks: data.tasks,

    runsForTask(taskId: string): MatchRun[] {
      return [...runs.values()]
        .filter((s) => s.run.task_id === taskId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(currentRun)
    },

    getRun(runId: string): MatchRun | undefined {
      const state = runs.get(runId)
      return state && currentRun(state)
    },

    startRun(taskId: string): MatchRun {
      const recorded = data.runs[taskId]
      if (!recorded) throw new Error(`no recorded run for task ${taskId}`)
      const id = crypto.randomUUID()
      const createdAt = now()
      const run: MatchRun = {
        ...recorded.run,
        id,
        started_at: new Date(createdAt).toISOString(),
        finished_at: new Date(createdAt + RUNNING_MS).toISOString(),
      }
      runs.set(id, { run, recorded, createdAt })
      return currentRun({ run, recorded, createdAt })
    },

    shortlist,

    excluded(runId: string): ExcludedCandidate[] | undefined {
      return runs.get(runId)?.recorded.excluded
    },

    findItem(id: string): ShortlistItem | undefined {
      const runId = id.slice(0, id.lastIndexOf(':'))
      return shortlist(runId)?.find((i) => i.id === id)
    },

    saveFeedback(id: string, value: Feedback): void {
      feedback.set(id, value)
    },
  }
}

export type Db = ReturnType<typeof createDb>
