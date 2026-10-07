import type { TaskPriority, TaskStatus } from '@/api/types'
import { StatusBadge, type Tone } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'

const DOT: Record<TaskPriority, string> = {
  critical: 'bg-priority-critical',
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
}

const LABEL: Record<TaskPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const PRIORITY_ORDER: TaskPriority[] = ['critical', 'high', 'medium', 'low']

export function PriorityDot({
  priority,
  className,
}: {
  priority: TaskPriority
  className?: string
}) {
  return (
    <span
      className={cn('inline-block size-2 shrink-0 rounded-full', DOT[priority], className)}
      aria-hidden
    />
  )
}

/** Priority as a coloured dot plus the word, so colour is never the only signal. */
export function PriorityBadge({ priority, short }: { priority: TaskPriority; short?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        priority === 'critical' ? 'text-priority-critical' : 'text-muted-foreground',
      )}
    >
      <PriorityDot priority={priority} />
      {LABEL[priority]}
      {!short && ' priority'}
    </span>
  )
}

export const priorityLabel = (p: TaskPriority) => LABEL[p]

const STATUS: Record<TaskStatus, [Tone, string]> = {
  open: ['info', 'Open'],
  matching: ['info', 'Matching'],
  shortlisted: ['attention', 'Shortlisted'],
  filled: ['ready', 'Filled'],
  cancelled: ['neutral', 'Cancelled'],
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const [tone, label] = STATUS[status]
  return <StatusBadge tone={tone}>{label}</StatusBadge>
}
