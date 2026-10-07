import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Check, History, Loader2 } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useThresholds, useUpdateThresholds } from '@/features/admin/api'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const schema = z
  .object({
    shortlist: z.number({ error: 'Enter a number' }).int().min(1).max(100),
    review: z.number({ error: 'Enter a number' }).int().min(1).max(100),
    reason: z.string().trim().min(3, 'Say why, in a few words (at least 3 characters)').max(500),
  })
  .refine((v) => v.review < v.shortlist, {
    path: ['review'],
    message: 'Review must start below the shortlist cut-off',
  })
type Values = z.infer<typeof schema>

export function ThresholdsTab() {
  const thresholds = useThresholds()
  if (thresholds.isPending) return <Skeleton className="h-80 w-full rounded-xl" />
  if (thresholds.isError) return <ErrorState error={thresholds.error} />
  const active = thresholds.data.active
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <ThresholdsForm
        key={active.version}
        shortlist={Math.round(active.shortlist_min * 100)}
        review={Math.round(active.review_min * 100)}
        label={active.label}
      />
      <section className="bg-surface rounded-xl border p-4" aria-label="Change history">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <History className="text-muted-foreground size-4" aria-hidden /> Change history
        </h2>
        <ol className="mt-3 space-y-3">
          {thresholds.data.history.map((v) => (
            <li key={v.version} className="border-l-2 pl-3 text-sm">
              <p className="font-medium">
                Version {v.version}
                {v.active && (
                  <StatusBadge tone="ready" className="ml-2">
                    In use
                  </StatusBadge>
                )}
              </p>
              <p className="tabular-nums">
                Shortlist ≥ {Math.round(v.shortlist_min * 100)}% · Review ≥{' '}
                {Math.round(v.review_min * 100)}%
              </p>
              <p className="text-muted-foreground">{v.reason}</p>
              <p className="text-muted-foreground text-xs">
                {v.created_by ?? 'System'} · {dateTime(v.created_at)}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function ThresholdsForm({
  shortlist,
  review,
  label,
}: {
  shortlist: number
  review: number
  label: string
}) {
  const update = useUpdateThresholds()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { shortlist, review, reason: '' },
  })
  const { errors, isDirty } = form.formState
  const s = useWatch({ control: form.control, name: 'shortlist' })
  const r = useWatch({ control: form.control, name: 'review' })
  const valid = Number.isFinite(s) && Number.isFinite(r) && r < s

  return (
    <form
      noValidate
      className="bg-surface space-y-5 rounded-xl border p-5"
      onSubmit={(e) =>
        void form.handleSubmit((v) =>
          update.mutate({
            shortlist_min: v.shortlist / 100,
            review_min: v.review / 100,
            reason: v.reason,
          }),
        )(e)
      }
    >
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Band cut-offs for overall fit</h2>
        <p className="text-muted-foreground text-sm">
          The model gives each person a chance of being a good fit. These cut-offs decide where they
          appear for the manager: <strong className="font-medium">Shortlist</strong> (shown first),{' '}
          <strong className="font-medium">Review</strong> (worth a look) or{' '}
          <strong className="font-medium">Hidden</strong>. Raising them shows fewer, surer people.
        </p>
        <p className="text-muted-foreground text-sm">
          In use now: {label}. A change becomes a new version and applies to the next run; past runs
          keep the cut-offs they used.
        </p>
      </div>

      <Scale shortlist={valid ? s : shortlist} review={valid ? r : review} />

      <div className="grid gap-4 sm:grid-cols-2">
        <PercentField
          id="shortlist"
          label="Shortlist from"
          error={errors.shortlist?.message}
          {...form.register('shortlist', { valueAsNumber: true })}
        />
        <PercentField
          id="review"
          label="Review from"
          error={errors.review?.message}
          {...form.register('review', { valueAsNumber: true })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reason">Reason for the change</Label>
        <textarea
          id="reason"
          rows={2}
          placeholder="e.g. Pilot: managers want to see more people in Review"
          aria-invalid={errors.reason ? true : undefined}
          className={cn(
            'bg-background w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-4',
            errors.reason
              ? 'border-destructive focus:ring-destructive/15'
              : 'focus:border-primary/60 focus:ring-primary/15',
          )}
          {...form.register('reason')}
        />
        {errors.reason && <FieldError message={errors.reason.message} />}
      </div>

      {update.isError && <ErrorState error={update.error} />}
      {update.isSuccess && !isDirty && (
        <p
          className="text-band-shortlist-foreground flex items-center gap-1.5 text-sm"
          role="status"
        >
          <Check className="size-4" aria-hidden /> Saved as a new version. The next run uses it.
        </p>
      )}
      <Button type="submit" disabled={update.isPending || !isDirty} className="rounded-lg">
        {update.isPending && <Loader2 className="animate-spin" />} Save new version
      </Button>
    </form>
  )
}

function Scale({ shortlist, review }: { shortlist: number; review: number }) {
  return (
    <div aria-hidden>
      <div className="flex h-9 overflow-hidden rounded-xl text-xs font-medium">
        <div
          className="bg-muted text-muted-foreground grid place-items-center"
          style={{ width: `${review}%` }}
        >
          Hidden
        </div>
        <div
          className="bg-band-review text-band-review-foreground grid place-items-center"
          style={{ width: `${shortlist - review}%` }}
        >
          Review
        </div>
        <div
          className="bg-band-shortlist text-band-shortlist-foreground grid place-items-center"
          style={{ width: `${100 - shortlist}%` }}
        >
          Shortlist
        </div>
      </div>
      <div className="text-muted-foreground relative mt-1 h-4 text-xs tabular-nums">
        <span className="absolute left-0">0%</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${review}%` }}>
          {review}%
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: `${shortlist}%` }}>
          {shortlist}%
        </span>
        <span className="absolute right-0">100%</span>
      </div>
    </div>
  )
}

function PercentField({
  id,
  label,
  error,
  ...input
}: { id: string; label: string; error?: string } & React.ComponentProps<'input'>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={1}
          max={100}
          inputMode="numeric"
          aria-invalid={error ? true : undefined}
          className={cn(
            'bg-background h-11 w-full rounded-xl border px-3 pr-9 text-sm tabular-nums outline-none focus:ring-4',
            error
              ? 'border-destructive focus:ring-destructive/15'
              : 'focus:border-primary/60 focus:ring-primary/15',
          )}
          {...input}
        />
        <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
          %
        </span>
      </div>
      {error && <FieldError message={error} />}
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  return (
    <p className="text-destructive flex items-center gap-1.5 text-xs">
      <AlertCircle className="size-3.5" aria-hidden /> {message}
    </p>
  )
}
