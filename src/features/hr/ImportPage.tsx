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
import type { Level } from '@/api/types'
import {
  useCommitImport,
  usePreviewImport,
  useRecheckImport,
  useSaveMapping,
} from '@/features/hr/api'
import type { ImportKind, ImportPreview, MappingKind } from '@/features/hr/types'
import { Panel } from '@/features/hr/ui'
import { useSkills } from '@/features/newTask/api'
import { LEVEL_TITLES, humanize, levelLabel, locationLabel } from '@/lib/format'
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
  timesheets: {
    label: 'Timesheets',
    help: 'Hours and what people worked on, per day (CSV or Excel). People by employee_code or by name; a day imported again replaces what was there. Shows on each person’s page as “Working on now”.',
    template:
      'Name,Date,Hours,Description\nAsha Rao,10/1/2026,8,Built the Databricks pipeline for claims\n',
  },
}

export default function ImportPage() {
  const allowed = useManagesPeople()
  const [kind, setKind] = useState<ImportKind>('employee_skills')
  const [file, setFile] = useState<File | null>(null)
  const preview = usePreviewImport()
  const recheck = useRecheckImport()
  const commit = useCommitImport()
  if (!allowed) return <Navigate to="/tasks" replace />
  const p = recheck.data ?? preview.data

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
            label={kind === 'timesheets' ? 'CSV or Excel file' : 'CSV file'}
            help="Use the template so the columns are named the way we expect."
          >
            <Input
              id="csv"
              type="file"
              accept={kind === 'timesheets' ? '.csv,text/csv,.xlsx' : '.csv,text/csv'}
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

      {p && !commit.data && (p.unmapped ?? []).length > 0 && (
        <MappingPanel
          unmapped={p.unmapped ?? []}
          busy={recheck.isPending}
          onSaved={() => recheck.mutate(p.preview_id)}
        />
      )}

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

const LOCATION_VALUES = ['hyderabad', 'bengaluru', 'pune', 'chennai', 'remote_india', 'usa', 'uk']
const PRACTICE_VALUES = ['app_dev', 'data_analytics', 'cloud', 'devops', 'ai_ml', 'qa']
const KIND_NAMES: Record<MappingKind, string> = {
  level: 'Level',
  practice: 'Practice',
  location: 'Location',
  skill: 'Skill',
}

/** The company's own names (e.g. "SE-2", "Hyd") mapped once to ours; later imports reuse them. */
function MappingPanel({
  unmapped,
  busy,
  onSaved,
}: {
  unmapped: NonNullable<ImportPreview['unmapped']>
  busy: boolean
  onSaved: () => void
}) {
  const save = useSaveMapping()
  const skills = useSkills()
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const key = (u: { kind: string; value: string }) => `${u.kind}:${u.value}`
  const options = (kind: MappingKind): { value: string; label: string }[] =>
    kind === 'level'
      ? (Object.keys(LEVEL_TITLES) as Level[]).map((l) => ({ value: l, label: levelLabel(l) }))
      : kind === 'practice'
        ? PRACTICE_VALUES.map((v) => ({ value: v, label: humanize(v) }))
        : kind === 'location'
          ? LOCATION_VALUES.map((v) => ({ value: v, label: locationLabel(v) }))
          : (skills.data ?? []).map((k) => ({ value: k.id, label: k.name }))
  const picked = unmapped.filter((u) => chosen[key(u)])
  const saveAll = async () => {
    for (const u of picked) {
      await save.mutateAsync({ kind: u.kind, source: u.value, target: chosen[key(u)] ?? '' })
    }
    onSaved()
  }
  return (
    <Panel title="Values we don't recognise" label="Values we don't recognise">
      <p className="text-muted-foreground mb-3 text-sm">
        Your file uses its own names for some values. Tell us what each one means once; the rows are
        checked again, and future imports use the same choice.
      </p>
      <ul className="divide-y text-sm">
        {unmapped.map((u) => (
          <li key={key(u)} className="flex flex-wrap items-center gap-3 py-2">
            <span className="text-muted-foreground w-24">{KIND_NAMES[u.kind]}</span>
            <span className="min-w-32 font-medium">&ldquo;{u.value}&rdquo;</span>
            <span className="text-muted-foreground text-xs">
              {u.rows} row{u.rows === 1 ? '' : 's'}
            </span>
            <span className="text-muted-foreground" aria-hidden>
              means
            </span>
            <Select
              value={chosen[key(u)] ?? ''}
              onValueChange={(v) => setChosen((c) => ({ ...c, [key(u)]: v }))}
            >
              <SelectTrigger className="w-56" aria-label={`Meaning of ${u.value}`}>
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {options(u.kind).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
      {save.isError && <ErrorState error={save.error} />}
      <div className="mt-3 flex justify-end">
        <Button
          disabled={picked.length === 0 || save.isPending || busy}
          onClick={() => void saveAll()}
        >
          Save {picked.length || ''} and check the rows again
        </Button>
      </div>
    </Panel>
  )
}
