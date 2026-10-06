import { CheckCircle2, Download, FileUp, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router'

import { ErrorState } from '@/components/QueryStates'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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

const KINDS: Record<ImportKind, { label: string; template: string }> = {
  clients: {
    label: 'Clients',
    template: 'code,name,domain,timezone\nCL-NEWCO,NewCo Insurance,bfsi,Asia/Kolkata\n',
  },
  employees: {
    label: 'Employees',
    template:
      'employee_code,full_name,designation,level,practice,years_experience,location,cost_band\nSPY-01001,Asha Rao,Data Engineer,L3,data_analytics,4,hyderabad,C\n',
  },
  employee_skills: {
    label: 'Employee skills',
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
      <header>
        <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">Import data</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Load many records at once from a CSV file. Every row is checked first; nothing is saved
          until you confirm, and rows with problems are skipped.
        </p>
      </header>

      <Panel title="1. Choose what to import">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="kind">Data</Label>
            <Select
              value={kind}
              onValueChange={(k) => {
                setKind(k as ImportKind)
                preview.reset()
                commit.reset()
              }}
            >
              <SelectTrigger id="kind" className="w-52">
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
          </div>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download aria-hidden /> Download template
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor="csv">CSV file</Label>
            <input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              className="text-sm"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                preview.reset()
                commit.reset()
              }}
            />
          </div>
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
        {preview.isError && <ErrorState error={preview.error} />}
      </Panel>

      {p && !commit.data && (
        <Panel
          title={`2. Check the rows — ${p.valid} ready, ${p.invalid} with problems`}
          label="Rows"
        >
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground bg-surface sticky top-0 text-left text-xs">
                <tr>
                  <th className="py-1 pr-2 font-normal">Row</th>
                  {p.columns.map((c) => (
                    <th key={c} className="py-1 pr-2 font-normal">
                      {c}
                    </th>
                  ))}
                  <th className="py-1 font-normal">Result</th>
                </tr>
              </thead>
              <tbody>
                {p.rows.map((r) => (
                  <tr
                    key={r.row}
                    className={cn('border-t', r.errors.length > 0 && 'bg-destructive/5')}
                  >
                    <td className="py-1.5 pr-2 tabular-nums">{r.row}</td>
                    {p.columns.map((c) => (
                      <td key={c} className="py-1.5 pr-2">
                        {r.values[c]}
                      </td>
                    ))}
                    <td
                      className={cn(
                        'py-1.5',
                        r.errors.length > 0 ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {r.errors.length > 0
                        ? r.errors.join('; ')
                        : r.action === 'update'
                          ? 'Will update'
                          : 'Will add'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {commit.isError && <ErrorState error={commit.error} />}
          <Button
            className="mt-3"
            disabled={p.valid === 0 || commit.isPending}
            onClick={() => commit.mutate(p.preview_id)}
          >
            Save {p.valid} valid {p.valid === 1 ? 'row' : 'rows'}
          </Button>
        </Panel>
      )}

      {commit.data && (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Imported</AlertTitle>
          <AlertDescription>
            {commit.data.created} added, {commit.data.updated} updated, {commit.data.skipped}{' '}
            skipped because of problems.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
