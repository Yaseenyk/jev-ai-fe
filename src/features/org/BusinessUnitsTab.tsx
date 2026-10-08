import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'

import type { BusinessUnit } from '@/api/types'
import { type Column, DataTable } from '@/components/DataTable'
import { ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateUnit, useUnitHeads, useUnits, useUpdateUnit } from '@/features/org/api'

const SELECT =
  'border-input bg-background h-9 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none'

/** HR names the company's business units and picks each unit's head (ADR 026). */
export function BusinessUnitsTab() {
  const units = useUnits()
  const heads = useUnitHeads()
  const update = useUpdateUnit()
  if (units.isPending || heads.isPending) return <Skeleton className="h-64 w-full rounded-xl" />
  if (units.isError) return <ErrorState error={units.error} />
  if (heads.isError) return <ErrorState error={heads.error} />

  const columns: Column<BusinessUnit>[] = [
    {
      key: 'unit',
      header: 'Unit',
      cell: (u) => (
        <div>
          <p className="font-medium">{u.code}</p>
          <p className="text-muted-foreground text-xs">{u.name}</p>
        </div>
      ),
    },
    {
      key: 'head',
      header: 'Head (manager)',
      cell: (u) => (
        <select
          className={SELECT}
          aria-label={`Head of ${u.code}`}
          value={u.head_user_id ?? ''}
          disabled={update.isPending}
          onChange={(e) => update.mutate({ id: u.id, head_user_id: e.target.value || null })}
        >
          <option value="">No head yet</option>
          {heads.data.map((h) => (
            <option key={h.id} value={h.id}>
              {h.display_name} ({h.email})
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'employees',
      header: 'Employees',
      align: 'right',
      cell: (u) => <span className="tabular-nums">{u.employees}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground max-w-2xl text-sm">
        Units such as BU001, each with a head. Managers see which unit a person belongs to and whom
        to contact; nobody is hidden. The Keka upload can set units and heads too (columns{' '}
        <code>business_unit</code> and <code>business_unit_head_email</code>).
      </p>
      {update.isError && <ErrorState error={update.error} />}
      <AddUnit heads={heads.data} />
      <DataTable
        label="Business units"
        rows={units.data}
        columns={columns}
        rowKey={(u) => u.id}
        empty={{ title: 'No business units yet', body: 'Add one above, or upload the Keka file.' }}
      />
    </div>
  )
}

function AddUnit({ heads }: { heads: { id: string; display_name: string; email: string }[] }) {
  const create = useCreateUnit()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [head, setHead] = useState('')
  const valid = /^[A-Za-z0-9][A-Za-z0-9_-]{1,19}$/.test(code.trim()) && name.trim().length >= 2
  return (
    <form
      className="bg-surface flex flex-wrap items-end gap-3 rounded-xl border p-4"
      aria-label="Add a business unit"
      onSubmit={(e) => {
        e.preventDefault()
        create.mutate(
          { code: code.trim(), name: name.trim(), head_user_id: head || null },
          {
            onSuccess: () => {
              setCode('')
              setName('')
              setHead('')
            },
          },
        )
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="bu-code">Code</Label>
        <Input
          id="bu-code"
          className="w-28"
          placeholder="BU001"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bu-name">Name</Label>
        <Input
          id="bu-name"
          className="w-56"
          placeholder="Data & AI"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bu-head">Head</Label>
        <select
          id="bu-head"
          className={SELECT}
          value={head}
          onChange={(e) => setHead(e.target.value)}
        >
          <option value="">Choose later</option>
          {heads.map((h) => (
            <option key={h.id} value={h.id}>
              {h.display_name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={!valid || create.isPending}>
        {create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
        Add unit
      </Button>
      {create.isError && (
        <div className="w-full">
          <ErrorState error={create.error} />
        </div>
      )}
    </form>
  )
}
