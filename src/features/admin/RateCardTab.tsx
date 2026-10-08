import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import type { RateCardLine } from '@/api/types'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useRateCard, useSaveRateCard } from '@/features/planning/api'
import { ClientRatesPanel } from '@/features/planning/QualityPanels'

/** Weekly cost and bill rate per cost band; margins are checked against it (ADR 024). */
export function RateCardTab() {
  const card = useRateCard()
  if (card.isPending) return <Skeleton className="h-64 w-full rounded-xl" />
  if (card.isError) return <ErrorState error={card.error} />
  return (
    <div className="space-y-8">
      <RateCardForm
        key={JSON.stringify(card.data.rows)}
        rows={card.data.rows}
        target={card.data.margin_target_pct}
        synthetic={card.data.synthetic}
      />
      <ClientRatesPanel />
    </div>
  )
}

function RateCardForm({
  rows,
  target,
  synthetic,
}: {
  rows: RateCardLine[]
  target: number
  synthetic: boolean
}) {
  const save = useSaveRateCard()
  const [draft, setDraft] = useState(rows)
  const edit = (i: number, key: 'weekly_cost_usd' | 'weekly_bill_usd', v: string) =>
    setDraft((d) => d.map((r, j) => (j === i ? { ...r, [key]: Math.max(0, Number(v) || 0) } : r)))
  const changed = JSON.stringify(draft) !== JSON.stringify(rows)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          What one person of each cost band costs and is billed per week. Planning uses it for idle
          cost and margins; a match under the {target}% margin target is flagged, never blocked.
        </p>
        {synthetic && <StatusBadge tone="attention">Example rates: enter your own</StatusBadge>}
      </div>
      <div className="bg-surface overflow-x-auto rounded-xl border">
        <table className="w-full text-sm" aria-label="Rate card">
          <thead className="text-muted-foreground border-b text-left text-xs">
            <tr>
              <th className="px-4 py-2 font-medium">Cost band</th>
              <th className="px-4 py-2 font-medium">Cost per week (USD)</th>
              <th className="px-4 py-2 font-medium">Bill rate per week (USD)</th>
              <th className="px-4 py-2 font-medium">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {draft.map((r, i) => {
              const pct = r.weekly_bill_usd
                ? Math.round((1000 * (r.weekly_bill_usd - r.weekly_cost_usd)) / r.weekly_bill_usd) /
                  10
                : 0
              return (
                <tr key={r.cost_band}>
                  <td className="px-4 py-2 font-medium">{r.cost_band}</td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      min={0}
                      aria-label={`Cost per week, band ${r.cost_band}`}
                      className="h-8 w-32"
                      value={r.weekly_cost_usd}
                      onChange={(e) => edit(i, 'weekly_cost_usd', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      min={0}
                      aria-label={`Bill rate per week, band ${r.cost_band}`}
                      className="h-8 w-32"
                      value={r.weekly_bill_usd}
                      onChange={(e) => edit(i, 'weekly_bill_usd', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge tone={pct < target ? 'attention' : 'ready'}>{pct}%</StatusBadge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {save.isError && <ErrorState error={save.error} />}
      <div className="flex gap-2">
        <Button disabled={!changed || save.isPending} onClick={() => save.mutate(draft)}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Save rate card
        </Button>
        <Button variant="outline" disabled={!changed} onClick={() => setDraft(rows)}>
          Undo changes
        </Button>
      </div>
    </div>
  )
}
