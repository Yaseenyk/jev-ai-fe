import { useMutation } from '@tanstack/react-query'
import { Check, MessageSquarePlus, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState } from 'react'

import { apiFetch } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export type FeedbackArea =
  | 'match_results'
  | 'shortlist_decision'
  | 'task_intake'
  | 'resume_reading'
  | 'candidate_fit'
  | 'suggestion'
  | 'other'

export interface FeedbackInput {
  area: FeedbackArea
  target_id?: string
  rating?: 'up' | 'down'
  comment?: string
}

export const useGiveFeedback = () =>
  useMutation({
    mutationFn: (input: FeedbackInput) =>
      apiFetch<undefined>('/feedback', { method: 'POST', body: JSON.stringify(input) }),
  })

/**
 * Optional feedback on an action (ADR 023): a thumb, then an optional comment. Never blocks the
 * user; comments are read once a week, decisions keep training the model every night.
 */
export function FeedbackPrompt({
  area,
  targetId,
  question,
  className,
}: {
  area: FeedbackArea
  targetId?: string
  question: string
  className?: string
}) {
  const give = useGiveFeedback()
  const [rating, setRating] = useState<'up' | 'down' | null>(null)
  const [comment, setComment] = useState('')
  const [done, setDone] = useState(false)
  const send = (input: Omit<FeedbackInput, 'area' | 'target_id'>, onSuccess?: () => void) =>
    give.mutate({ area, target_id: targetId, ...input }, { onSuccess })

  if (done) {
    return (
      <p
        role="status"
        className={cn('text-muted-foreground flex items-center gap-1.5 text-xs', className)}
      >
        <Check className="text-primary size-3.5" aria-hidden /> Thanks. The team reads this every
        week.
      </p>
    )
  }
  return (
    <div
      role="group"
      aria-label={question}
      className={cn('bg-muted/40 space-y-2 rounded-lg px-3 py-2 text-sm', className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{question}</span>
        {(['up', 'down'] as const).map((r) => (
          <Button
            key={r}
            size="sm"
            variant="ghost"
            aria-pressed={rating === r}
            aria-label={r === 'up' ? 'Yes, this was right' : 'No, something was wrong'}
            className={cn('h-7 px-2', rating === r && 'bg-background shadow-sm')}
            onClick={() => {
              setRating(r)
              send({ rating: r })
            }}
          >
            {r === 'up' ? <ThumbsUp aria-hidden /> : <ThumbsDown aria-hidden />}
          </Button>
        ))}
        {rating && (
          <span className="text-muted-foreground text-xs">
            Saved.{' '}
            {rating === 'down' ? 'What was wrong? (optional)' : 'Anything to add? (optional)'}
          </span>
        )}
      </div>
      {rating && (
        <div className="flex flex-wrap items-end gap-2">
          <Textarea
            aria-label="Your comment (optional)"
            className="bg-background min-h-14 flex-1"
            placeholder={
              rating === 'down'
                ? 'e.g. Ranked someone who left the project early as the best fit'
                : 'e.g. The top three were exactly who I had in mind'
            }
            value={comment}
            maxLength={1000}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!comment.trim() || give.isPending}
            onClick={() => send({ comment: comment.trim() }, () => setDone(true))}
          >
            <MessageSquarePlus aria-hidden /> Send comment
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDone(true)}>
            Done
          </Button>
        </div>
      )}
    </div>
  )
}

/** Top-bar "Give feedback": a comment about anything, tagged with the page it was sent from. */
export function GiveFeedbackButton({ page }: { page: string }) {
  const give = useGiveFeedback()
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const close = () => {
    setOpen(false)
    setComment('')
    give.reset()
  }
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground mr-1 hidden sm:inline-flex"
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlus aria-hidden /> Give feedback
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give feedback</DialogTitle>
            <DialogDescription>
              Anything that was wrong, confusing or missing. The team reads every comment once a
              week; names and contact details are removed first.
            </DialogDescription>
          </DialogHeader>
          {give.isSuccess ? (
            <p role="status" className="flex items-center gap-2 text-sm">
              <Check className="text-primary size-4" aria-hidden /> Thanks, your feedback was sent.
            </p>
          ) : (
            <Textarea
              aria-label="Your feedback"
              placeholder="e.g. I could not find where to see the candidates HR sent me"
              value={comment}
              maxLength={1000}
              onChange={(e) => setComment(e.target.value)}
            />
          )}
          <DialogFooter>
            {give.isSuccess ? (
              <Button onClick={close}>Close</Button>
            ) : (
              <>
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button
                  disabled={!comment.trim() || give.isPending}
                  onClick={() =>
                    give.mutate({
                      area: 'other',
                      target_id: page.slice(0, 64),
                      comment: comment.trim(),
                    })
                  }
                >
                  Send feedback
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
