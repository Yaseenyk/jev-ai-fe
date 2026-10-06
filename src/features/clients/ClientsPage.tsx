import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Loader2, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Navigate } from 'react-router'
import { z } from 'zod'

import type { Client, Domain } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/QueryStates'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import { useClients, useCreateClient, useUpdateClient } from '@/features/clients/api'
import { domainLabel } from '@/lib/format'

const DOMAINS: Domain[] = [
  'bfsi',
  'healthcare',
  'retail',
  'manufacturing',
  'public_sector',
  'education',
  'telecom',
  'logistics',
]
const NO_DOMAIN = 'none'
const TIMEZONES = [
  'Asia/Kolkata',
  'America/New_York',
  'Europe/London',
  'Asia/Dubai',
  'Asia/Singapore',
]

export default function ClientsPage() {
  const allowed = useManagesPeople()
  const clients = useClients()
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  if (!allowed) return <Navigate to="/tasks" replace />

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">Clients</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            The clients tasks are staffed for. An inactive client is kept for history but no longer
            offered for new tasks.
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus aria-hidden /> Add client
        </Button>
      </header>

      {clients.isPending ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : clients.isError ? (
        <ErrorState error={clients.error} />
      ) : clients.data.length === 0 ? (
        <EmptyState title="No clients yet">Add the first client to staff tasks for it.</EmptyState>
      ) : (
        <ul className="divide-y rounded-2xl border" aria-label="Clients">
          {clients.data.map((c) => (
            <li key={c.code} className="flex flex-wrap items-center gap-3 p-3">
              <Building2 className="text-muted-foreground size-5 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {c.name} <span className="text-muted-foreground font-normal">· {c.code}</span>
                  {!c.is_active && (
                    <span className="bg-muted text-muted-foreground ml-2 rounded-full px-2 py-0.5 text-xs">
                      inactive
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground truncate text-sm">
                  {[c.domain ? domainLabel(c.domain) : null, c.timezone, c.notes || null]
                    .filter(Boolean)
                    .join(' · ') || 'No details yet'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(c)}>
                <Pencil aria-hidden /> Edit
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ClientDialog
          client={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

const schema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{1,31}$/, 'Use 2–32 letters, digits or dashes, e.g. CL-ACME'),
  name: z.string().trim().min(1, 'Enter the client name').max(200),
  domain: z.string(),
  timezone: z.string().trim(),
  notes: z.string().max(2000),
  is_active: z.boolean(),
})
type Values = z.infer<typeof schema>

function ClientDialog({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const create = useCreateClient()
  const update = useUpdateClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: client?.code ?? '',
      name: client?.name ?? '',
      domain: client?.domain ?? NO_DOMAIN,
      timezone: client?.timezone ?? '',
      notes: client?.notes ?? '',
      is_active: client?.is_active ?? true,
    },
  })
  const errors = form.formState.errors
  const saving = create.isPending || update.isPending
  const failed = create.error ?? update.error

  const submit = form.handleSubmit((v) => {
    const details = {
      name: v.name,
      domain: v.domain === NO_DOMAIN ? null : (v.domain as Domain),
      timezone: v.timezone || null,
      notes: v.notes,
    }
    if (client) {
      update.mutate(
        { code: client.code, ...details, is_active: v.is_active },
        { onSuccess: onClose },
      )
    } else {
      create.mutate({ code: v.code, ...details }, { onSuccess: onClose })
    }
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client ? `Edit ${client.name}` : 'Add a client'}</DialogTitle>
          <DialogDescription>
            {client ? 'Changes are recorded in the audit log.' : 'The code cannot change later.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!client && (
            <div className="space-y-1.5">
              <Label htmlFor="client-code">Code</Label>
              <Input id="client-code" placeholder="CL-ACME" {...form.register('code')} />
              {errors.code && <p className="text-destructive text-sm">{errors.code.message}</p>}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="client-name">Name</Label>
            <Input id="client-name" {...form.register('name')} />
            {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="client-domain">Domain</Label>
              <Controller
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="client-domain">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_DOMAIN}>Not set</SelectItem>
                      {DOMAINS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {domainLabel(d)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-timezone">Timezone</Label>
              <Input
                id="client-timezone"
                list="client-timezones"
                placeholder="Asia/Kolkata"
                {...form.register('timezone')}
              />
              <datalist id="client-timezones">
                {TIMEZONES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-notes">Notes</Label>
            <Textarea id="client-notes" rows={3} {...form.register('notes')} />
          </div>
          {client && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('is_active')} className="size-4" />
              Active (offered for new tasks)
            </label>
          )}
        </div>
        {failed && <ErrorState error={failed} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void submit()}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            {client ? 'Save changes' : 'Add client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
