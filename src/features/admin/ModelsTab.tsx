import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Check, History, Loader2, Pin, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ApiError } from '@/api/client'
import type { ModelInfo } from '@/api/types'
import { ErrorState } from '@/components/QueryStates'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useActivateModel, useModels, useRollbackModel } from '@/features/admin/api'
import { dateTime, percent } from '@/lib/format'

// One decimal: models are compared on differences of a point or two.
const percent1 = (p: number): string => `${(p * 100).toFixed(1)}%`

export function ModelsTab() {
  const models = useModels()
  const rollback = useRollbackModel()
  const [switching, setSwitching] = useState<ModelInfo | null>(null)

  if (models.isPending) return <Skeleton className="h-80 w-full rounded-2xl" />
  if (models.isError) return <ErrorState error={models.error} />
  const { models: list, history, pinned_dir: pinned } = models.data

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground max-w-3xl text-sm">
        Trained models and how each did on the 35 test tasks it never saw, next to the simple
        rule-based ranking. The active model scores every new run; after a switch the next run uses
        it.
      </p>
      {pinned && (
        <Alert>
          <Pin />
          <AlertTitle>The matching worker is pinned to one model folder</AlertTitle>
          <AlertDescription>
            It uses {pinned} (set by STUDENT_MODEL_DIR). A switch here is recorded, but that worker
            keeps its model until the pin is removed.
          </AlertDescription>
        </Alert>
      )}
      {list.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No models registered yet. Register one with <code>scripts/models.py register</code>.
        </p>
      ) : (
        <ul className="grid gap-3" aria-label="Models">
          {list.map((m) => (
            <ModelCard key={m.name} model={m} onSwitch={() => setSwitching(m)} />
          ))}
        </ul>
      )}

      <section className="bg-surface rounded-2xl border p-4" aria-label="Switch history">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <History className="text-muted-foreground size-4" aria-hidden /> Switch history
          </p>
          {history.length > 0 && history[0]?.from_model && (
            <Button
              variant="outline"
              size="sm"
              disabled={rollback.isPending}
              onClick={() => rollback.mutate()}
            >
              <RotateCcw aria-hidden /> Back to {history[0].from_model}
            </Button>
          )}
        </div>
        {rollback.isError && <ErrorState error={rollback.error} />}
        {history.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">No switches yet.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {history.map((h) => (
              <li key={h.at} className="border-l-2 pl-3 text-sm">
                <p className="font-medium">
                  {h.from_model ?? 'none'} → {h.to_model}
                  {h.forced && (
                    <span className="bg-band-review text-band-review-foreground ml-2 rounded-full px-2 py-0.5 text-xs">
                      forced
                    </span>
                  )}
                </p>
                {h.reason && <p className="text-muted-foreground">{h.reason}</p>}
                <p className="text-muted-foreground text-xs">{dateTime(h.at)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {switching && <SwitchDialog model={switching} onClose={() => setSwitching(null)} />}
    </div>
  )
}

function ModelCard({ model: m, onSwitch }: { model: ModelInfo; onSwitch: () => void }) {
  const s = m.scores
  return (
    <li className="bg-surface rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {m.name}
            {m.active && (
              <span className="bg-band-shortlist text-band-shortlist-foreground ml-2 rounded-full px-2 py-0.5 text-xs">
                active
              </span>
            )}
          </p>
          {m.note && <p className="text-muted-foreground text-sm">{m.note}</p>}
          <p className="text-muted-foreground mt-1 text-xs">
            Weights {m.fingerprint} · registered {dateTime(m.registered_at)}
          </p>
        </div>
        {!m.active && (
          <Button size="sm" onClick={onSwitch}>
            Make active
          </Button>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <Stat
          label="Better above worse"
          value={s?.pairwise_order != null ? percent1(s.pairwise_order) : '—'}
          hint={
            s?.baseline_pairwise_order != null
              ? `simple ranking ${percent1(s.baseline_pairwise_order)}`
              : undefined
          }
        />
        <Stat label="Best in top 5" value={s ? percent(s.hit_at_5) : '—'} />
        <Stat label="Right person first" value={s ? percent(s.hit_at_1) : '—'} />
        <Stat label="Confidence fitted" value={m.calibrated ? 'Yes' : 'No'} />
        <Stat label="Final scorer" value={m.combiner ? 'Yes' : 'No'} />
      </dl>
      {!s && (
        <p className="text-muted-foreground mt-2 text-xs">
          Not tested yet: run <code>scripts/models.py evaluate {m.name}</code> before switching.
        </p>
      )}
    </li>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
      {hint && <dd className="text-muted-foreground text-xs">{hint}</dd>}
    </div>
  )
}

const schema = z.object({
  reason: z.string().trim().min(3, 'Say why, in a few words (at least 3 characters)').max(500),
})
type Values = z.infer<typeof schema>

function SwitchDialog({ model, onClose }: { model: ModelInfo; onClose: () => void }) {
  const activate = useActivateModel()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: '' } })
  const refusal =
    activate.error instanceof ApiError && activate.error.status === 409
      ? activate.error.message
      : null

  const submit = (force: boolean) =>
    form.handleSubmit((v) =>
      activate.mutate({ name: model.name, reason: v.reason, force }, { onSuccess: onClose }),
    )()

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make {model.name} the active model?</DialogTitle>
          <DialogDescription>
            New matching runs will use it. Past runs keep the model they were scored with.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="switch-reason">Reason</Label>
          <Textarea id="switch-reason" rows={3} {...form.register('reason')} />
          {form.formState.errors.reason && (
            <p className="text-destructive text-sm">{form.formState.errors.reason.message}</p>
          )}
        </div>
        {refusal && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Not switched</AlertTitle>
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        )}
        {activate.isError && !refusal && <ErrorState error={activate.error} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {refusal ? (
            <Button
              variant="destructive"
              disabled={activate.isPending}
              onClick={() => void submit(true)}
            >
              Switch anyway
            </Button>
          ) : (
            <Button disabled={activate.isPending} onClick={() => void submit(false)}>
              {activate.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Check aria-hidden />
              )}
              Make active
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
