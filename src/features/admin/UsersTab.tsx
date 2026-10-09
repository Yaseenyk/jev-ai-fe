import { zodResolver } from '@hookform/resolvers/zod'
import { Copy, KeyRound, Loader2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { apiFetch } from '@/api/client'
import type { Page, UserAdmin, UserRole, UserWithPassword } from '@/api/types'
import { type Column, DataTable, Pagination } from '@/components/DataTable'
import { FilterBar, FilterSelect, SortSelect } from '@/components/FilterBar'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { useUrlState } from '@/components/useUrlState'
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
import { useCreateUser, useResetPassword, useUpdateUser, useUsers } from '@/features/admin/api'
import { useAuth } from '@/features/auth/AuthProvider'
import { ROLE_LABELS, date } from '@/lib/format'

const ROLES = Object.keys(ROLE_LABELS) as [UserRole, ...UserRole[]]

const ROLE_HELP: Record<UserRole, string> = {
  admin: 'Everything, including this Admin area',
  resource_manager: 'Creates tasks, runs matching, decides on people',
  hr: 'Employees, clients, candidates and hiring requests',
  viewer: 'Can look, cannot change anything',
  employee: 'Sees and updates only their own profile, learning and preferences',
}

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'temporary', label: 'Temporary password' },
  { value: 'deactivated', label: 'Deactivated' },
]

const SORTS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'email', label: 'Email (A–Z)' },
  { value: 'role', label: 'Role' },
  { value: 'newest', label: 'Newest first' },
]

const DEFAULTS = { q: '', role: '', state: '', sort: 'name', page: '1', size: '25' }

function stateOf(u: UserAdmin): string {
  if (!u.is_active) return 'deactivated'
  return u.must_change_password ? 'temporary' : 'active'
}

type Confirm = { kind: 'deactivate' | 'reset'; user: UserAdmin }

export function UsersTab() {
  const users = useUsers()
  const update = useUpdateUser()
  const reset = useResetPassword()
  const me = useAuth().user
  const [f, set] = useUrlState(DEFAULTS)
  const [adding, setAdding] = useState(false)
  const [shown, setShown] = useState<UserWithPassword | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  if (users.isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (users.isError) return <ErrorState error={users.error} />

  const page = Math.max(1, Number(f.page) || 1)
  const size = Number(f.size) || 25
  const q = f.q.trim().toLowerCase()
  const filtered = users.data
    .filter(
      (u) =>
        (!q || u.display_name.toLowerCase().includes(q) || u.email.includes(q)) &&
        (!f.role || u.role === f.role) &&
        (!f.state || stateOf(u) === f.state),
    )
    .sort((a, b) =>
      f.sort === 'email'
        ? a.email.localeCompare(b.email)
        : f.sort === 'role'
          ? ROLE_LABELS[a.role].localeCompare(ROLE_LABELS[b.role])
          : f.sort === 'newest'
            ? b.created_at.localeCompare(a.created_at)
            : a.display_name.localeCompare(b.display_name),
    )
  const rows = filtered.slice((page - 1) * size, page * size)

  const chips = [
    ...(f.role
      ? [{ label: `Role: ${ROLE_LABELS[f.role as UserRole]}`, onRemove: () => set({ role: '' }) }]
      : []),
    ...(f.state
      ? [
          {
            label: `Status: ${STATUSES.find((s) => s.value === f.state)?.label}`,
            onRemove: () => set({ state: '' }),
          },
        ]
      : []),
    ...(f.q ? [{ label: `Search: “${f.q}”`, onRemove: () => set({ q: '' }) }] : []),
  ]

  const columns: Column<UserAdmin>[] = [
    {
      key: 'name',
      header: 'Person',
      sortKey: 'name',
      cell: (u) => (
        <div className="min-w-0">
          <p className="font-medium">
            {u.display_name}
            {u.id === me?.id && <span className="text-muted-foreground font-normal"> (you)</span>}
          </p>
          <p className="text-muted-foreground text-xs">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortKey: 'role',
      cell: (u) => (
        <Select
          value={u.role}
          disabled={update.isPending}
          onValueChange={(role) => update.mutate({ id: u.id, role: role as UserRole })}
        >
          <SelectTrigger className="h-8 w-44" aria-label={`Role of ${u.display_name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (u) =>
        !u.is_active ? (
          <StatusBadge tone="neutral">Deactivated</StatusBadge>
        ) : u.must_change_password ? (
          <StatusBadge tone="attention">Temporary password</StatusBadge>
        ) : (
          <StatusBadge tone="ready">Active</StatusBadge>
        ),
    },
    {
      key: 'added',
      header: 'Added',
      sortKey: 'newest',
      cell: (u) => (
        <span className="text-muted-foreground whitespace-nowrap">{date(u.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (u) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={reset.isPending}
            onClick={() => setConfirm({ kind: 'reset', user: u })}
          >
            <KeyRound aria-hidden /> Reset password
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={update.isPending}
            onClick={() =>
              u.is_active
                ? setConfirm({ kind: 'deactivate', user: u })
                : update.mutate({ id: u.id, is_active: true })
            }
          >
            {u.is_active ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Everyone who can sign in, and what their role lets them do. New people and password resets
          get a temporary password, shown once; they choose their own at first sign-in.
        </p>
        <Button onClick={() => setAdding(true)}>
          <UserPlus aria-hidden /> Add person
        </Button>
      </div>
      {(update.isError || reset.isError) && <ErrorState error={update.error ?? reset.error} />}

      <FilterBar
        search={{
          value: f.q,
          onChange: (v) => set({ q: v }),
          placeholder: 'Name or email',
          label: 'Search people',
        }}
        filters={
          <>
            <FilterSelect
              label="Role"
              value={f.role}
              onChange={(role) => set({ role })}
              allLabel="All roles"
              options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              className="w-44"
            />
            <FilterSelect
              label="Status"
              value={f.state}
              onChange={(state) => set({ state })}
              allLabel="All statuses"
              options={STATUSES}
              className="w-48"
            />
          </>
        }
        sort={<SortSelect value={f.sort} onChange={(sort) => set({ sort })} options={SORTS} />}
        chips={chips}
        onClear={() => set({ q: '', role: '', state: '' })}
      />

      <DataTable
        label="People"
        rows={rows}
        columns={columns}
        rowKey={(u) => u.id}
        sort={f.sort}
        onSort={(sort) => set({ sort })}
        empty={{ title: 'Nobody matches', body: 'Clear the search or filters.' }}
      />
      {filtered.length > 0 && (
        <Pagination
          total={filtered.length}
          page={page}
          pageSize={size}
          noun="people"
          onPage={(p) => set({ page: String(p) })}
          onPageSize={(n) => set({ size: String(n) })}
        />
      )}

      {adding && (
        <AddPersonDialog
          onClose={() => setAdding(false)}
          onCreated={(result) => {
            setAdding(false)
            setShown(result)
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          confirm={confirm}
          busy={update.isPending || reset.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            const u = confirm.user
            if (confirm.kind === 'reset') {
              reset.mutate(u.id, {
                onSuccess: (result) => {
                  setConfirm(null)
                  setShown(result)
                },
              })
            } else {
              update.mutate({ id: u.id, is_active: false }, { onSettled: () => setConfirm(null) })
            }
          }}
        />
      )}
      {shown && <TemporaryPasswordDialog result={shown} onClose={() => setShown(null)} />}
    </div>
  )
}

function ConfirmDialog({
  confirm,
  busy,
  onClose,
  onConfirm,
}: {
  confirm: Confirm
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const name = confirm.user.display_name
  const reset = confirm.kind === 'reset'
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {reset ? `Reset the password of ${name}?` : `Deactivate ${name}?`}
          </DialogTitle>
          <DialogDescription>
            {reset
              ? 'They are signed out everywhere and get a temporary password, shown to you once. They choose their own at the next sign-in.'
              : 'They are signed out at once and can no longer sign in. Their past decisions stay. You can reactivate them later.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={reset ? 'default' : 'destructive'} disabled={busy} onClick={onConfirm}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {reset ? 'Reset password' : 'Deactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const schema = z.object({
  email: z.email('Enter a valid email').trim(),
  display_name: z.string().trim().min(1, 'Enter a name').max(100),
  role: z.enum(ROLES),
  employee_code: z.string().trim().optional(),
})
type Values = z.infer<typeof schema>

function AddPersonDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (result: UserWithPassword) => void
}) {
  const create = useCreateUser()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', display_name: '', role: 'resource_manager', employee_code: '' },
  })
  const errors = form.formState.errors
  const role = useWatch({ control: form.control, name: 'role' })
  const submit = form.handleSubmit(async ({ employee_code, ...v }) => {
    let employee_id: string | null = null
    if (v.role === 'employee') {
      const code = (employee_code ?? '').toUpperCase()
      const found = await apiFetch<Page<{ id: string; employee_code: string }>>(
        `/employees?q=${encodeURIComponent(code)}&limit=5`,
      )
      employee_id = found.items.find((e) => e.employee_code.toUpperCase() === code)?.id ?? null
      if (!employee_id) {
        form.setError('employee_code', { message: `No employee with code ${code}` })
        return
      }
    }
    create.mutate({ ...v, employee_id }, { onSuccess: onCreated })
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a person</DialogTitle>
          <DialogDescription>
            They get a temporary password to sign in with, and choose their own straight away.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-email">Work email</Label>
            <Input
              id="new-email"
              type="email"
              placeholder="name@company.com"
              {...form.register('email')}
            />
            {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Name</Label>
            <Input
              id="new-name"
              placeholder="e.g. Priya Sharma"
              {...form.register('display_name')}
            />
            {errors.display_name && (
              <p className="text-destructive text-sm">{errors.display_name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-role">Role</Label>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="new-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-muted-foreground text-xs">{ROLE_HELP[role]}</p>
          </div>
          {role === 'employee' && (
            <div className="space-y-1.5">
              <Label htmlFor="new-employee">Employee code</Label>
              <Input
                id="new-employee"
                placeholder="e.g. SPY-00048"
                {...form.register('employee_code')}
              />
              {errors.employee_code && (
                <p className="text-destructive text-sm">{errors.employee_code.message}</p>
              )}
            </div>
          )}
        </div>
        {create.isError && <ErrorState error={create.error} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={create.isPending} onClick={() => void submit()}>
            {create.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Add person
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TemporaryPasswordDialog({
  result,
  onClose,
}: {
  result: UserWithPassword
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const person: UserAdmin = result.user
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Temporary password for {person.display_name}</DialogTitle>
          <DialogDescription>
            Shown only now. Pass it on privately; they will choose their own when they sign in as{' '}
            {person.email}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <code
            className="bg-muted flex-1 rounded-lg px-3 py-2 font-mono text-sm"
            aria-label="Temporary password"
          >
            {result.temporary_password}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard
                .writeText(result.temporary_password)
                .then(() => setCopied(true))
            }}
          >
            <Copy aria-hidden /> {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
