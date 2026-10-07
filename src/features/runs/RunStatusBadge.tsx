import type { RunStatus } from '@/api/types'
import { StatusBadge, type Tone } from '@/components/StatusBadge'

const STATUS: Record<RunStatus, [Tone, string]> = {
  queued: ['neutral', 'Queued'],
  running: ['info', 'Running'],
  completed: ['ready', 'Completed'],
  failed: ['danger', 'Failed'],
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const [tone, label] = STATUS[status]
  return <StatusBadge tone={tone}>{label}</StatusBadge>
}
