import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { downloadAudit } from '@/features/planning/api'

/** Every recommendation with how it was made and who decided (ADR 024, docs/08). */
export function AuditTab() {
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      await downloadAudit(since, until)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-muted-foreground text-sm">
        A spreadsheet of every person recommended by every finished matching run: the model, the
        version of the questions and the cut-offs it used, the score and band, any warning flags,
        and the manager&apos;s decision with who made it and when.
      </p>
      <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
        <li>The system only recommends; every assignment is a person&apos;s decision.</li>
        <li>
          Scores use skills, level, domain, availability and project history. Gender, age, religion,
          caste and other protected attributes are not stored, so they cannot reach a score.
        </li>
        <li>Names never go to the language model.</li>
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="audit-since">From</Label>
          <Input
            id="audit-since"
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-until">To</Label>
          <Input
            id="audit-until"
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </div>
        <Button onClick={() => void download()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
          Download decisions (CSV)
        </Button>
      </div>
      {error !== null && <ErrorState error={error} />}
    </div>
  )
}
