import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Check, History, Loader2, Pin, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ApiError } from '@/api/client'
import type { ModelInfo } from '@/api/types'
import { type Column, DataTable } from '@/components/DataTable'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
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
import { date, dateTime, percent } from '@/lib/format'

// One decimal: models are compared on differences of a point or two.
const percent1 = (p: number): string => `${(p * 100).toFixed(1)}%`

const GLOSSARY: [string, string][] = [
  [
    'Better above worse',
    'Of two people, how often the model puts the better fit higher. The simple ranking (skills and level only) is shown underneath for comparison.',
  ],
  ['Best in top 5', 'How often the best person was among the first five suggestions.'],
  ['Right person first', 'How often the best person was the very first suggestion.'],
  [
    'Confidence fitted',
    'Its percentages have been adjusted so that “70%” really means right about 7 times in 10.',
  ],
  [
    'Final scorer',
    'A last step, learned from managers’ decisions, that combines the facts and the model’s answers.',
  ],
]

function yesNo(v: boolean) {
  return v ? (
    <StatusBadge tone="ready">Yes</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">No</StatusBadge>
  )
}

export function ModelsTab() {
  const models = useModels()
  const rollback = useRollbackModel()
  const [switching, setSwitching] = useState<ModelInfo | null>(null)

  if (models.isPending) return <Skeleton className="h-80 w-full rounded-xl" />
  if (models.isError) return <ErrorState error={models.error} />
  const { models: list, history, pinned_dir: pinned } = models.data

  const columns: Column<ModelInfo>[] = [
    {
      key: 'name',
      header: 'Model',
      cell: (m) => (
        <div className="min-w-0 space-y-0.5">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {m.name}
            {m.active && <StatusBadge tone="ready">Active</StatusBadge>}
          </p>
          {m.note && <p className="text-muted-foreground text-xs">{m.note}</p>}
          <p className="text-muted-foreground text-xs">
            Registered {date(m.registered_at)} · weights {m.fingerprint}
          </p>
          {!m.scores && (
            <p className="text-band-review-foreground text-xs">
              Not tested yet: run <code>scripts/models.py evaluate {m.name}</code> before switching.
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'order',
      header: 'Better above worse',
      align: 'right',
      cell: (m) => (
        <div>
          <p className="font-semibold">
            {m.scores?.pairwise_order != null ? percent1(m.scores.pairwise_order) : '—'}
          </p>
          {m.scores?.baseline_pairwise_order != null && (
            <p className="text-muted-foreground text-xs">
              simple ranking {percent1(m.scores.baseline_pairwise_order)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'top5',
      header: 'Best in top 5',
      align: 'right',
      cell: (m) => (m.scores ? percent(m.scores.hit_at_5) : '—'),
    },
    {
      key: 'first',
      header: 'Right person first',
      align: 'right',
      cell: (m) => (m.scores ? percent(m.scores.hit_at_1) : '—'),
    },
    { key: 'calibrated', header: 'Confidence fitted', cell: (m) => yesNo(m.calibrated) },
    { key: 'combiner', header: 'Final scorer', cell: (m) => yesNo(m.combiner) },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      cell: (m) =>
        m.active ? (
          <span className="text-muted-foreground text-xs">In use</span>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setSwitching(m)}>
            Make active
          </Button>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground max-w-3xl text-sm">
        Trained models and how each did on the 35 test tasks it never saw. The active model scores
        every new run; after a switch the next run uses it, and past runs keep the model they used.
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

      <DataTable
        label="Models"
        rows={list}
        columns={columns}
        rowKey={(m) => m.name}
        empty={{
          title: 'No models registered yet',
          body: (
            <>
              Register one with <code>scripts/models.py register</code>.
            </>
          ),
        }}
      />

      <dl className="bg-surface grid gap-x-6 gap-y-2 rounded-xl border p-4 text-sm sm:grid-cols-2">
        {GLOSSARY.map(([term, meaning]) => (
          <div key={term}>
            <dt className="font-medium">{term}</dt>
            <dd className="text-muted-foreground text-xs">{meaning}</dd>
          </div>
        ))}
      </dl>

      <section className="bg-surface rounded-xl border p-4" aria-label="Switch history">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <History className="text-muted-foreground size-4" aria-hidden /> Switch history
          </h2>
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
          <p className="text-muted-foreground mt-3 text-sm">
            No switches yet. Every switch is recorded here with who made it and why.
          </p>
        ) : (
          <ol className="mt-3 space-y-3">
            {history.map((h) => (
              <li key={h.at} className="border-l-2 pl-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {h.from_model ?? 'none'} → {h.to_model}
                  {h.forced && <StatusBadge tone="attention">forced</StatusBadge>}
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
