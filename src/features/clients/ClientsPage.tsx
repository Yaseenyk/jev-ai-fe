import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Navigate } from 'react-router'
import { z } from 'zod'

import type { Client, Domain } from '@/api/types'
import { type Column, DataTable, Pagination } from '@/components/DataTable'
import { FilterBar, FilterSelect, SortSelect } from '@/components/FilterBar'
import { Field, FormSection, FormSheet } from '@/components/FormSheet'
import { EmptyState, ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { useUrlState } from '@/components/useUrlState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

const STATES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const SORTS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'code', label: 'Code (A–Z)' },
]

const DEFAULTS = { q: '', domain: '', state: '', sort: 'name', page: '1', size: '25' }

/**
 * The Clients tab of the Company screen (embedded, so no page title of its own): the clients
 * tasks are staffed for.
 */
export default function ClientsPage() {
  const allowed = useManagesPeople()
  const clients = useClients()
  const [f, set] = useUrlState(DEFAULTS)
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  if (!allowed) return <Navigate to="/tasks" replace />

  const page = Math.max(1, Number(f.page) || 1)
  const size = Number(f.size) || 25
  const q = f.q.trim().toLowerCase()
  const all = clients.data ?? []
  const filtered = all
    .filter(
      (c) =>
        (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) &&
        (!f.domain || (c.domain ?? NO_DOMAIN) === f.domain) &&
        (!f.state || (f.state === 'active') === c.is_active),
    )
    .sort((a, b) =>
      f.sort === 'code' ? a.code.localeCompare(b.code) : a.name.localeCompare(b.name),
    )
  const rows = filtered.slice((page - 1) * size, page * size)
  const activeCount = all.filter((c) => c.is_active).length

  const chips = [
    ...(f.domain
      ? [
          {
            label: `Domain: ${f.domain === NO_DOMAIN ? 'Not set' : domainLabel(f.domain)}`,
            onRemove: () => set({ domain: '' }),
          },
        ]
      : []),
    ...(f.state
      ? [
          {
            label: `Status: ${STATES.find((s) => s.value === f.state)?.label}`,
            onRemove: () => set({ state: '' }),
          },
        ]
      : []),
    ...(f.q ? [{ label: `Search: “${f.q}”`, onRemove: () => set({ q: '' }) }] : []),
  ]

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Client',
      sortKey: 'name',
      cell: (c) => (
        <div className="min-w-0">
          <p className="font-medium">{c.name}</p>
          <p className="text-muted-foreground text-xs">{c.code}</p>
        </div>
      ),
    },
    {
      key: 'domain',
      header: 'Domain',
      cell: (c) =>
        c.domain ? domainLabel(c.domain) : <span className="text-muted-foreground">Not set</span>,
    },
    {
      key: 'timezone',
      header: 'Timezone',
      cell: (c) => c.timezone ?? <span className="text-muted-foreground">Not set</span>,
    },
    {
      key: 'notes',
      header: 'Notes',
      cell: (c) =>
        c.notes ? (
          <p className="text-muted-foreground line-clamp-2 max-w-xs text-xs">{c.notes}</p>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) =>
        c.is_active ? (
          <StatusBadge tone="ready">Active</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Inactive</StatusBadge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (c) => (
        <Button
          variant="outline"
          size="sm"
          aria-label={`Edit ${c.name}`}
          onClick={() => setEditing(c)}
        >
          <Pencil aria-hidden /> Edit
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            Clients
            {clients.data && (
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                {activeCount} active of {all.length}
              </span>
            )}
          </h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            The clients tasks are staffed for. An inactive client is kept for history but no longer
            offered for new tasks.
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus aria-hidden /> Add client
        </Button>
      </div>

      {clients.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : clients.isError ? (
        <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState title="No clients yet">
          Add the first client, or import them from a file, to staff tasks for it.
        </EmptyState>
      ) : (
        <>
          <FilterBar
            search={{
              value: f.q,
              onChange: (v) => set({ q: v }),
              placeholder: 'Name or code',
              label: 'Search clients',
            }}
            filters={
              <>
                <FilterSelect
                  label="Domain"
                  value={f.domain}
                  onChange={(domain) => set({ domain })}
                  allLabel="All domains"
                  options={[
                    ...DOMAINS.map((d) => ({ value: d, label: domainLabel(d) })),
                    { value: NO_DOMAIN, label: 'Not set' },
                  ]}
                  className="w-44"
                />
                <FilterSelect
                  label="Status"
                  value={f.state}
                  onChange={(state) => set({ state })}
                  allLabel="All statuses"
                  options={STATES}
                />
              </>
            }
            sort={<SortSelect value={f.sort} onChange={(sort) => set({ sort })} options={SORTS} />}
            chips={chips}
            onClear={() => set({ q: '', domain: '', state: '' })}
          />
          <DataTable
            label="Clients"
            rows={rows}
            columns={columns}
            rowKey={(c) => c.code}
            sort={f.sort}
            onSort={(sort) => set({ sort })}
            empty={{ title: 'No client matches', body: 'Clear the search or filters.' }}
          />
          {filtered.length > 0 && (
            <Pagination
              total={filtered.length}
              page={page}
              pageSize={size}
              noun="clients"
              onPage={(p) => set({ page: String(p) })}
              onPageSize={(n) => set({ size: String(n) })}
            />
          )}
        </>
      )}

      {editing && (
        <ClientSheet client={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
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

function ClientSheet({ client, onClose }: { client: Client | null; onClose: () => void }) {
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
    <FormSheet
      title={client ? `Edit ${client.name}` : 'Add client'}
      description={
        client
          ? `Client code ${client.code}. Changes are recorded in the audit log.`
          : 'Once added, the client can be picked for new tasks.'
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void submit()}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            {client ? 'Save changes' : 'Add client'}
          </Button>
        </>
      }
    >
      <FormSection title="Client">
        {!client && (
          <Field
            id="client-code"
            label="Code"
            required
            help={errors.code ? undefined : 'A short unique code. It cannot change later.'}
          >
            <Input
              id="client-code"
              placeholder="e.g. CL-ACME"
              aria-invalid={errors.code ? true : undefined}
              {...form.register('code')}
            />
            {errors.code && <p className="text-destructive text-xs">{errors.code.message}</p>}
          </Field>
        )}
        <Field id="client-name" label="Name" required wide={Boolean(client)}>
          <Input
            id="client-name"
            placeholder="e.g. Acme Insurance"
            aria-invalid={errors.name ? true : undefined}
            {...form.register('name')}
          />
          {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
        </Field>
      </FormSection>

      <FormSection title="Details">
        <Field id="client-domain" label="Domain" help="The client’s industry.">
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
        </Field>
        <Field id="client-timezone" label="Timezone" help="The client’s main working timezone.">
          <Input
            id="client-timezone"
            list="client-timezones"
            placeholder="e.g. Asia/Kolkata"
            {...form.register('timezone')}
          />
          <datalist id="client-timezones">
            {TIMEZONES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field id="client-notes" label="Notes" wide>
          <Textarea
            id="client-notes"
            rows={4}
            placeholder="e.g. Prefers people who have worked on their claims platform before"
            {...form.register('notes')}
          />
        </Field>
      </FormSection>

      {client && (
        <FormSection title="Status">
          <label className="flex items-start gap-2.5 text-sm sm:col-span-2">
            <input type="checkbox" {...form.register('is_active')} className="mt-0.5 size-4" />
            <span>
              Active (offered for new tasks)
              <span className="text-muted-foreground block text-xs">
                Untick to stop offering this client for new tasks. Existing tasks keep it.
              </span>
            </span>
          </label>
        </FormSection>
      )}

      {failed && <ErrorState error={failed} />}
    </FormSheet>
  )
}
