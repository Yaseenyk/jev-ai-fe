import { ChevronDown, Search } from 'lucide-react'
import { useState } from 'react'

import type { ExcludedCandidate } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { FILTER_REASON_LABELS, humanize } from '@/lib/format'

const PAGE = 25

export function ReasonCounts({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return (
    <ul className="flex flex-wrap gap-1.5">
      {entries.map(([reason, n]) => (
        <li key={reason}>
          <Badge variant="outline" className="font-normal">
            {FILTER_REASON_LABELS[reason] ?? humanize(reason)}: {n}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

export function ExcludedPanel({
  excluded,
  total,
  counts,
}: {
  excluded: ExcludedCandidate[]
  total: number
  counts: Record<string, number>
}) {
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(PAGE)
  const matches = excluded.filter((c) =>
    c.employee.full_name.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <Collapsible className="rounded-xl border">
      <CollapsibleTrigger asChild>
        <button className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 text-left">
          <span>
            <span className="font-medium">Why not others?</span>{' '}
            <span className="text-muted-foreground text-sm">
              {total} people were excluded by the rules before any AI scoring
            </span>
          </span>
          <ChevronDown className="text-muted-foreground size-4" aria-hidden />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t px-4 py-3">
        <ReasonCounts counts={counts} />
        <div className="relative max-w-xs">
          <Search className="text-muted-foreground absolute top-2 left-2.5 size-4" aria-hidden />
          <Input
            aria-label="Search excluded people"
            placeholder="Find a person"
            className="pl-8"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setShown(PAGE)
            }}
          />
        </div>
        <ul className="divide-y text-sm">
          {matches.slice(0, shown).map((c) => (
            <li key={c.employee.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-48 font-medium">{c.employee.full_name}</span>
              <span className="text-muted-foreground text-xs">{c.employee.designation}</span>
              <span className="ml-auto flex flex-wrap gap-1">
                {c.filter_reasons.map((r) => (
                  <Badge key={r} variant="secondary" className="font-normal">
                    {FILTER_REASON_LABELS[r] ?? humanize(r)}
                  </Badge>
                ))}
              </span>
            </li>
          ))}
        </ul>
        {matches.length > shown && (
          <Button variant="outline" size="sm" onClick={() => setShown((s) => s + PAGE)}>
            Show more ({matches.length - shown} left)
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
