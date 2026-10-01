import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import type { RejectReason } from '@/api/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { REJECT_REASON_LABELS } from '@/lib/format'

const REASONS = Object.keys(REJECT_REASON_LABELS) as [RejectReason, ...RejectReason[]]

const schema = z.object({
  reject_reason: z.enum(REASONS, { error: 'Choose a reason' }),
  comment: z.string().max(500, 'Keep the comment under 500 characters'),
})

export type RejectValues = z.infer<typeof schema>

export function RejectDialog({
  open,
  onOpenChange,
  personName,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  personName: string
  onSubmit: (values: RejectValues) => void
}) {
  const form = useForm<RejectValues>({
    resolver: zodResolver(schema),
    defaultValues: { comment: '' },
  })
  const { errors } = form.formState

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) form.reset({ comment: '' })
        onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {personName}?</DialogTitle>
          <DialogDescription>
            Your reason is saved and used to improve future suggestions.
          </DialogDescription>
        </DialogHeader>
        <form
          id="reject-form"
          className="space-y-4"
          onSubmit={(e) =>
            void form.handleSubmit((values) => {
              onSubmit(values)
              form.reset({ comment: '' })
            })(e)
          }
        >
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Reason</Label>
            <Controller
              control={form.control}
              name="reject_reason"
              render={({ field }) => (
                // Typed as required, but undefined until the user picks; '' keeps Select controlled.
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="reject-reason"
                    className="w-full"
                    aria-invalid={!!errors.reject_reason}
                  >
                    <SelectValue placeholder="Choose a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {REJECT_REASON_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.reject_reason && (
              <p role="alert" className="text-destructive text-xs">
                {errors.reject_reason.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reject-comment">Comment (optional)</Label>
            <Textarea id="reject-comment" rows={3} {...form.register('comment')} />
            {errors.comment && (
              <p role="alert" className="text-destructive text-xs">
                {errors.comment.message}
              </p>
            )}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="reject-form" variant="destructive">
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
