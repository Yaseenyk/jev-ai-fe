import { AlertCircle, Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

import { ApiError } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const problem = error instanceof ApiError ? error.problem : null
  const message = error instanceof Error ? error.message : 'Something went wrong'
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{problem?.title ?? 'Could not load data'}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {problem?.request_id && <p className="text-xs">Request ID: {problem.request_id}</p>}
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
      <Inbox className="text-muted-foreground size-8" aria-hidden />
      <p className="font-medium">{title}</p>
      {children && <div className="text-muted-foreground max-w-md text-sm">{children}</div>}
    </div>
  )
}
