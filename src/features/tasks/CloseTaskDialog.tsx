import { AlertCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useChangeTaskStatus } from '@/features/tasks/api'
import { cn } from '@/lib/utils'

export type CloseAs = 'filled' | 'cancelled'

const COPY: Record<CloseAs, { title: string; body: string; label: string; action: string }> = {
  filled: {
    title: 'Mark this task as filled?',
    body: 'It leaves the open board. Nobody is assigned by the system; this records your decision.',
    label: 'Note (optional), e.g. who joined',
    action: 'Mark as filled',
  },
  cancelled: {
    title: 'Cancel this task?',
    body: 'It leaves the open board and can no longer be matched. You can reopen it later.',
    label: 'Why is it cancelled?',
    action: 'Cancel task',
  },
}

export function CloseTaskDialog({
  taskId,
  as,
  onOpenChange,
}: {
  taskId: string
  as: CloseAs | null
  onOpenChange: (open: boolean) => void
}) {
  const change = useChangeTaskStatus(taskId)
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const copy = as ? COPY[as] : null
  const needsReason = as === 'cancelled'
  const invalid = needsReason && note.trim().length < 3

  const close = (open: boolean) => {
    if (!open) {
      setNote('')
      setTouched(false)
      change.reset()
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={as !== null} onOpenChange={close}>
      <DialogContent>
        {copy && as && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              setTouched(true)
              if (invalid) return
              change.mutate(
                { status: as, note: note.trim() || null },
                { onSuccess: () => close(false) },
              )
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{copy.body}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="close-note">{copy.label}</Label>
              <textarea
                id="close-note"
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && invalid ? true : undefined}
                className={cn(
                  'bg-background w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-4',
                  touched && invalid
                    ? 'border-destructive focus:ring-destructive/15'
                    : 'focus:border-primary/60 focus:ring-primary/15',
                )}
              />
              {touched && invalid && (
                <p className="text-destructive flex items-center gap-1.5 text-xs" role="alert">
                  <AlertCircle className="size-3.5" aria-hidden /> Say why, in a few words
                </p>
              )}
            </div>
            {change.isError && <ErrorState error={change.error} />}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Keep it open
              </Button>
              <Button
                type="submit"
                variant={as === 'cancelled' ? 'destructive' : 'default'}
                disabled={change.isPending}
              >
                {change.isPending && <Loader2 className="animate-spin" />}
                {copy.action}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
