import { CheckCircle2, Download, FileUp, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router'

import { Field } from '@/components/FormSheet'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import { useCommitImport, usePreviewImport } from '@/features/hr/api'
import type { ImportKind } from '@/features/hr/types'
import { Panel } from '@/features/hr/ui'
import { cn } from '@/lib/utils'

const KINDS: Record<ImportKind, { label: string; help: string; template: string }> = {
  clients: {
    label: 'Clients',
    help: 'Adds new clients, or updates the ones whose code already exists.',
    template: 'code,name,domain,timezone\nCL-NEWCO,NewCo Insurance,bfsi,Asia/Kolkata\n',
  },
  employees: {
    label: 'Employees',
    help: 'Adds new employees, or updates the ones whose employee code already exists.',
    template:
      'employee_code,full_name,designation,level,practice,years_experience,location,cost_band\nSPY-01001,Asha Rao,Data Engineer,L3,data_analytics,4,hyderabad,C\n',
  },
  employee_skills: {
    label: 'Employee skills',
    help: 'Adds or updates one skill per row for an existing employee.',
    template: 'employee_code,skill,proficiency,years,last_used\nSPY-00001,SQL,4,3,2026-09-01\n',
  },
}

export default function ImportPage() {
  const allowed = useManagesPeople()
  const [kind, setKind] = useState<ImportKind>('employee_skills')
  const [file, setFile] = useState<File | null>(null)
  const preview = usePreviewImport()
  const commit = useCommitImport()
  if (!allowed) return <Navigate to="/tasks" replace />
  const p = preview.data

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([KINDS[kind].template], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${kind}-template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ to: '/company', label: 'Company' }}
        title="Import data"
        description="Load many records at once from a CSV file. Every row is checked first; nothing is saved until you confirm, and rows with problems are skipped."
        actions={
          <Button variant="outline" onClick={downloadTemplate}>
            <Download aria-hidden /> Download template
          </Button>
        }
      />

      <Panel title="1. Choose what to import and the file">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="kind" label="What the file contains" help={KINDS[kind].help}>
            <Select
              value={kind}
              onValueChange={(k) => {
                setKind(k as ImportKind)
                preview.reset()
                commit.reset()
              }}
            >
              <SelectTrigger id="kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KINDS) as ImportKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KINDS[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            id="csv"
            label="CSV file"
            help="Use the template so the columns are named the way we expect."
          >
            <Input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              className="cursor-pointer"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                preview.reset()
                commit.reset()
              }}
            />
          </Field>
        </div>
        {preview.isError && (
          <div className="mt-4">
            <ErrorState error={preview.error} />
          </div>
        )}
        <div className="mt-4 flex justify-end border-t pt-4">
          <Button
            disabled={!file || preview.isPending}
            onClick={() => file && preview.mutate({ kind, file })}
          >
            {preview.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <FileUp aria-hidden />
            )}
            Check the file
          </Button>
        </div>
      </Panel>

      {p && !commit.data && (
        <Panel
          title={`2. Check the rows: ${p.valid} ready, ${p.invalid} with problems`}
          label="Rows"
        >
          <div className="max-h-[28rem] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground sticky top-0 text-left text-xs">
                <tr>
                  <th className="h-9 px-3 font-medium">Row</th>
                  {p.columns.map((c) => (
                    <th key={c} className="h-9 px-3 font-medium whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                  <th className="h-9 px-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {p.rows.map((r) => (
                  <tr
                    key={r.row}
                    className={cn('border-t', r.errors.length > 0 && 'bg-destructive/5')}
                  >
                    <td className="px-3 py-2 tabular-nums">{r.row}</td>
                    {p.columns.map((c) => (
                      <td key={c} className="px-3 py-2">
                        {r.values[c]}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {r.errors.length > 0 ? (
                        <div className="space-y-1">
                          <StatusBadge tone="danger">Skipped</StatusBadge>
                          <p className="text-destructive text-xs">{r.errors.join('; ')}</p>
                        </div>
                      ) : r.action === 'update' ? (
                        <StatusBadge tone="info">Will update</StatusBadge>
                      ) : (
                        <StatusBadge tone="ready">Will add</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {commit.isError && (
            <div className="mt-4">
              <ErrorState error={commit.error} />
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t pt-4">
            {p.valid === 0 && (
              <span className="text-muted-foreground mr-auto text-sm">
                No row is ready. Fix the file and check it again.
              </span>
            )}
            <Button
              disabled={p.valid === 0 || commit.isPending}
              onClick={() => commit.mutate(p.preview_id)}
            >
              Save {p.valid} valid {p.valid === 1 ? 'row' : 'rows'}
            </Button>
          </div>
        </Panel>
      )}

      {commit.data && (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Imported</AlertTitle>
          <AlertDescription>
            <p>
              {commit.data.created} added, {commit.data.updated} updated, {commit.data.skipped}{' '}
              skipped because of problems.
            </p>
            <Link to="/company" className="text-primary text-sm hover:underline">
              Back to Company
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
