import { Copy, KeyRound, Plus } from 'lucide-react'
import { useState } from 'react'

import type { ApiProject, NewApiKey } from '@/api/types'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  useApiProjects,
  useApiRequests,
  useCreateApiKey,
  useCreateApiProject,
  useRevokeApiKey,
} from '@/features/admin/api'
import { dateTime } from '@/lib/format'

/** Admin → Decision API: which services may ask Jev typed questions, their keys and calls. */
export function DecisionApiTab() {
  const projects = useApiProjects()
  const [adding, setAdding] = useState(false)
  const [shownKey, setShownKey] = useState<NewApiKey | null>(null)
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-muted-foreground max-w-3xl text-sm">
          Other Sparity services and AI agents ask Jev typed questions here (first: the agent checks
          — cheap or strong model, approve a tool action, check a result). Each service is a project
          with its own key and monthly budget. Answers are advice; when Jev is unsure it says so
          instead of guessing.
        </p>
        <Button onClick={() => setAdding(true)}>
          <Plus aria-hidden /> Add a project
        </Button>
      </div>
      {projects.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : projects.isError ? (
        <ErrorState error={projects.error} />
      ) : projects.data.length === 0 ? (
        <p className="bg-surface text-muted-foreground rounded-xl border px-5 py-6 text-sm">
          No projects yet. Add one for the first service that will call Jev, then give its team the
          key.
        </p>
      ) : (
        projects.data.map((p) => <ProjectCard key={p.id} project={p} onKey={setShownKey} />)
      )}
      {adding && <AddProjectDialog onClose={() => setAdding(false)} />}
      {shownKey && <KeyDialog k={shownKey} onClose={() => setShownKey(null)} />}
    </div>
  )
}

function ProjectCard({
  project: p,
  onKey,
}: {
  project: ApiProject
  onKey: (k: NewApiKey) => void
}) {
  const newKey = useCreateApiKey(p.id)
  const revoke = useRevokeApiKey()
  const calls = useApiRequests(p.id)
  const active = p.keys.filter((k) => !k.revoked_at)
  return (
    <section aria-label={`Project ${p.name}`} className="bg-surface rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">{p.name}</h2>
          <StatusBadge tone={p.is_active ? 'ready' : 'neutral'}>
            {p.is_active ? 'Active' : 'Off'}
          </StatusBadge>
          <StatusBadge tone="info">
            ${p.spent_this_month_usd.toFixed(2)} of ${p.monthly_budget_usd.toFixed(2)} this month
          </StatusBadge>
          <StatusBadge tone="neutral">
            {p.store_inputs ? 'Keeps inputs 1 year for training' : 'Keeps no inputs'}
          </StatusBadge>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={newKey.isPending}
          onClick={() => newKey.mutate(undefined, { onSuccess: onKey })}
        >
          <KeyRound aria-hidden /> New key
        </Button>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-semibold">Keys</h3>
          {active.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active key.</p>
          ) : (
            <ul className="divide-y text-sm">
              {active.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span>
                    <code className="text-xs">{k.prefix}…</code>{' '}
                    <span className="text-muted-foreground text-xs">
                      {k.last_used_at ? `used ${dateTime(k.last_used_at)}` : 'never used'}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(k.id)}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-semibold">Recent questions</h3>
          {calls.data?.length ? (
            <ul className="divide-y text-sm" aria-label={`Recent questions for ${p.name}`}>
              {calls.data.slice(0, 8).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span className="font-medium">{c.decision}</span>
                  <span className="flex items-center gap-2 text-xs">
                    {c.abstained ? (
                      <StatusBadge tone="attention">Unsure</StatusBadge>
                    ) : (
                      <StatusBadge tone="info">{c.answer}</StatusBadge>
                    )}
                    {Math.round(c.confidence * 100)}%
                    {c.outcome && (
                      <StatusBadge tone={c.outcome === c.answer ? 'ready' : 'danger'}>
                        right: {c.outcome}
                      </StatusBadge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No questions asked yet.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function AddProjectDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateApiProject()
  const [name, setName] = useState('')
  const [budget, setBudget] = useState('5')
  const [store, setStore] = useState(true)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a project</DialogTitle>
          <DialogDescription>
            One project per service that calls Jev. You give its team a key next.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              placeholder="e.g. pr-review-bot"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase())}
            />
            <p className="text-muted-foreground text-xs">Lowercase letters, numbers and dashes.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-budget">Monthly budget (USD)</Label>
            <Input
              id="p-budget"
              type="number"
              min={0}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={store}
              onChange={(e) => setStore(e.target.checked)}
            />
            Keep its questions for 1 year to train Jev (contact details removed first)
          </label>
        </div>
        {create.isError && <ErrorState error={create.error} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={name.trim().length < 2 || create.isPending}
            onClick={() =>
              create.mutate(
                { name: name.trim(), monthly_budget_usd: Number(budget), store_inputs: store },
                { onSuccess: onClose },
              )
            }
          >
            Add project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function KeyDialog({ k, onClose }: { k: NewApiKey; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy the key now</DialogTitle>
          <DialogDescription>
            This is the only time it is shown. Give it to the service&rsquo;s team through a secret
            store, never by chat or email.
          </DialogDescription>
        </DialogHeader>
        <code className="bg-muted block rounded-lg px-3 py-2 text-xs break-all">{k.key}</code>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(k.key)
              setCopied(true)
            }}
          >
            <Copy aria-hidden /> {copied ? 'Copied' : 'Copy key'}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
