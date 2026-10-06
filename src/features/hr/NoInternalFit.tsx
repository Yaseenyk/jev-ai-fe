import { Loader2, Send, UserSearch } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCanEdit, useManagesPeople } from '@/features/auth/AuthProvider'
import { useCreateRequest, useHiringRequests } from '@/features/hr/api'
import { MAX_SUBMISSIONS } from '@/features/hr/types'
import { RequestStatusBadge } from '@/features/hr/ui'

/** Shown on a run's results when nobody internal lands in Shortlist or Review (ADR 020). */
export function NoInternalFit({ taskId }: { taskId: string }) {
  const isHr = useManagesPeople()
  const canAsk = useCanEdit()
  const requests = useHiringRequests(undefined, isHr || canAsk)
  const [asking, setAsking] = useState(false)
  const open = requests.data?.find((r) => r.task_id === taskId && r.status !== 'closed')
  if (!isHr && !canAsk) return null

  return (
    <section
      className="bg-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed p-4"
      aria-label="No internal fit"
    >
      <div className="flex items-start gap-3">
        <UserSearch className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">No internal fit for this task</p>
          <p className="text-muted-foreground text-sm">
            {open
              ? 'HR has a request for this task.'
              : isHr
                ? 'External candidates may fit. Check the pool or upload resumes.'
                : 'Ask HR to find external candidates. You decide on each one they send.'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {open && (
          <>
            <RequestStatusBadge status={open.status} />
            <Button asChild variant="outline" size="sm">
              <Link to={`/hiring-requests/${open.id}`}>Open the request</Link>
            </Button>
          </>
        )}
        {isHr && (
          <Button asChild size="sm">
            <Link to={`/tasks/${taskId}/candidates`}>See external candidates</Link>
          </Button>
        )}
        {!open && canAsk && (
          <Button size="sm" onClick={() => setAsking(true)}>
            <Send aria-hidden /> Ask HR for candidates
          </Button>
        )}
      </div>
      {asking && <AskDialog taskId={taskId} onClose={() => setAsking(false)} />}
    </section>
  )
}

function AskDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const create = useCreateRequest(taskId)
  const [wanted, setWanted] = useState(5)
  const [note, setNote] = useState('')
  const valid = wanted >= 1 && wanted <= MAX_SUBMISSIONS
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask HR for candidates</DialogTitle>
          <DialogDescription>
            HR is notified, searches job sites and sends you their best few. You mark each one fit
            or not a fit; HR contacts the fit ones.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="wanted">How many candidates (1–{MAX_SUBMISSIONS})</Label>
            <Input
              id="wanted"
              type="number"
              min={1}
              max={MAX_SUBMISSIONS}
              value={wanted}
              onChange={(e) => setWanted(Number(e.target.value))}
            />
            {!valid && <p className="text-destructive text-sm">Between 1 and {MAX_SUBMISSIONS}.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ask-note">Anything HR should know</Label>
            <Textarea
              id="ask-note"
              rows={3}
              placeholder="e.g. client prefers someone who can start within a month"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        {create.isError && <ErrorState error={create.error} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || create.isPending}
            onClick={() => create.mutate({ wanted, note }, { onSuccess: onClose })}
          >
            {create.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Send to HR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
