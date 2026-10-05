import { zodResolver } from '@hookform/resolvers/zod'
import { Copy, KeyRound, Loader2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import type { UserAdmin, UserRole, UserWithPassword } from '@/api/types'
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
import { ROLE_LABELS } from '@/lib/format'

const ROLES = Object.keys(ROLE_LABELS) as [UserRole, ...UserRole[]]

export function UsersTab() {
  const users = useUsers()
  const update = useUpdateUser()
  const reset = useResetPassword()
  const me = useAuth().user
  const [adding, setAdding] = useState(false)
  const [shown, setShown] = useState<UserWithPassword | null>(null)

  if (users.isPending) return <Skeleton className="h-80 w-full rounded-2xl" />
  if (users.isError) return <ErrorState error={users.error} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Everyone who can sign in. New people and password resets get a temporary password, shown
          once; they choose their own at first sign-in. Deactivating someone signs them out at once.
        </p>
        <Button onClick={() => setAdding(true)}>
          <UserPlus aria-hidden /> Add person
        </Button>
      </div>
      {(update.isError || reset.isError) && <ErrorState error={update.error ?? reset.error} />}

      <ul className="divide-y rounded-2xl border" aria-label="People">
        {users.data.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {u.display_name}
                {u.id === me?.id && <span className="text-muted-foreground"> (you)</span>}
                {!u.is_active && (
                  <span className="bg-muted text-muted-foreground ml-2 rounded-full px-2 py-0.5 text-xs">
                    deactivated
                  </span>
                )}
                {u.must_change_password && u.is_active && (
                  <span className="bg-band-review text-band-review-foreground ml-2 rounded-full px-2 py-0.5 text-xs">
                    temporary password
                  </span>
                )}
              </p>
              <p className="text-muted-foreground truncate text-sm">{u.email}</p>
            </div>
            <Select
              value={u.role}
              disabled={update.isPending}
              onValueChange={(role) => update.mutate({ id: u.id, role: role as UserRole })}
            >
              <SelectTrigger className="w-44" aria-label={`Role of ${u.display_name}`}>
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
            <Button
              variant="outline"
              size="sm"
              disabled={reset.isPending}
              onClick={() => reset.mutate(u.id, { onSuccess: setShown })}
            >
              <KeyRound aria-hidden /> Reset password
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: u.id, is_active: !u.is_active })}
            >
              {u.is_active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </li>
        ))}
      </ul>

      {adding && (
        <AddPersonDialog
          onClose={() => setAdding(false)}
          onCreated={(result) => {
            setAdding(false)
            setShown(result)
          }}
        />
      )}
      {shown && <TemporaryPasswordDialog result={shown} onClose={() => setShown(null)} />}
    </div>
  )
}

const schema = z.object({
  email: z.email('Enter a valid email').trim(),
  display_name: z.string().trim().min(1, 'Enter a name').max(100),
  role: z.enum(ROLES),
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
    defaultValues: { email: '', display_name: '', role: 'resource_manager' },
  })
  const errors = form.formState.errors
  const submit = form.handleSubmit((v) => create.mutate(v, { onSuccess: onCreated }))

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a person</DialogTitle>
          <DialogDescription>
            They get a temporary password to sign in with, and choose their own straight away.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-email">Work email</Label>
            <Input id="new-email" type="email" {...form.register('email')} />
            {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Name</Label>
            <Input id="new-name" {...form.register('display_name')} />
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
                  <SelectTrigger id="new-role">
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
          </div>
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
