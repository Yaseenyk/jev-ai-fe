import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Copy, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import type { Company, CompanyCreated } from '@/api/types'
import { type Column, DataTable } from '@/components/DataTable'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useCompanies, useCreateCompany } from '@/features/admin/api'
import { date } from '@/lib/format'

const columns: Column<Company>[] = [
  {
    key: 'name',
    header: 'Company',
    cell: (c) => (
      <div className="min-w-0">
        <p className="font-medium">{c.name}</p>
        <p className="text-muted-foreground text-xs">{c.id}</p>
      </div>
    ),
  },
  { key: 'users', header: 'People who sign in', align: 'right', cell: (c) => c.users },
  { key: 'employees', header: 'Employees', align: 'right', cell: (c) => c.employees },
  {
    key: 'added',
    header: 'Added',
    cell: (c) => (
      <span className="text-muted-foreground whitespace-nowrap">{date(c.created_at)}</span>
    ),
  },
]

export function CompaniesTab() {
  const companies = useCompanies()
  const [adding, setAdding] = useState(false)
  const [shown, setShown] = useState<CompanyCreated | null>(null)

  if (companies.isPending) return <Skeleton className="h-64 w-full rounded-xl" />
  if (companies.isError) return <ErrorState error={companies.error} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Each company sees only its own people, clients, tasks and decisions. Its first admin gets
          a temporary password, shown once, then adds everyone else.
        </p>
        <Button onClick={() => setAdding(true)}>
          <Building2 aria-hidden /> Add company
        </Button>
      </div>
      <DataTable
        label="Companies"
        rows={companies.data}
        columns={columns}
        rowKey={(c) => c.id}
        empty={{ title: 'No companies yet' }}
      />
      {adding && (
        <AddCompanyDialog
          onClose={() => setAdding(false)}
          onCreated={(result) => {
            setAdding(false)
            setShown(result)
          }}
        />
      )}
      {shown && <FirstAdminDialog result={shown} onClose={() => setShown(null)} />}
    </div>
  )
}

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the company name').max(120),
  id: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{1,39}$/, 'Use 2–40 lower-case letters, digits or dashes'),
  admin_name: z.string().trim().min(2, 'Enter a name').max(120),
  admin_email: z.email('Enter a valid email').trim(),
})
type Values = z.infer<typeof schema>

function idFrom(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function AddCompanyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (result: CompanyCreated) => void
}) {
  const create = useCreateCompany()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', id: '', admin_name: '', admin_email: '' },
  })
  const errors = form.formState.errors
  const submit = form.handleSubmit((v) => create.mutate(v, { onSuccess: onCreated }))
  const nameField = form.register('name')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a company</DialogTitle>
          <DialogDescription>
            The company starts empty, with the standard cut-offs. Its admin signs in with a
            temporary password and chooses their own.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              placeholder="e.g. Acme Corp"
              {...nameField}
              onChange={(e) => {
                void nameField.onChange(e)
                if (!form.getFieldState('id').isDirty) form.setValue('id', idFrom(e.target.value))
              }}
            />
            {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-id">Short id</Label>
            <Input id="company-id" placeholder="acme-corp" {...form.register('id')} />
            <p className="text-muted-foreground text-xs">
              Used in the company&apos;s file folders.
            </p>
            {errors.id && <p className="text-destructive text-sm">{errors.id.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-admin-name">First admin&apos;s name</Label>
            <Input
              id="company-admin-name"
              placeholder="e.g. Priya Sharma"
              {...form.register('admin_name')}
            />
            {errors.admin_name && (
              <p className="text-destructive text-sm">{errors.admin_name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-admin-email">First admin&apos;s work email</Label>
            <Input
              id="company-admin-email"
              type="email"
              placeholder="name@acme.com"
              {...form.register('admin_email')}
            />
            {errors.admin_email && (
              <p className="text-destructive text-sm">{errors.admin_email.message}</p>
            )}
          </div>
          {create.isError && <ErrorState error={create.error} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={create.isPending} onClick={() => void submit()}>
            {create.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Add company
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FirstAdminDialog({ result, onClose }: { result: CompanyCreated; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{result.company.name} is ready</DialogTitle>
          <DialogDescription>
            Shown only now. Pass the password on privately; they choose their own when they sign in
            as {result.admin_email}.
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
