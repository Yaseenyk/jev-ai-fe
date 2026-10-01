import type { TaskPriority } from '@/api/types'
import { Badge } from '@/components/ui/badge'

const VARIANT: Record<TaskPriority, 'destructive' | 'default' | 'secondary' | 'outline'> = {
  critical: 'destructive',
  high: 'default',
  medium: 'secondary',
  low: 'outline',
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant={VARIANT[priority]} className="capitalize">
      {priority} priority
    </Badge>
  )
}
