import type { RunStatus } from '@/api/types'
import { Badge } from '@/components/ui/badge'

const LABEL: Record<RunStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return (
    <Badge
      variant={
        status === 'failed' ? 'destructive' : status === 'completed' ? 'secondary' : 'outline'
      }
    >
      {LABEL[status]}
    </Badge>
  )
}
