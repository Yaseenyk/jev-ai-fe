import { TriangleAlert } from 'lucide-react'

import type { DecisionDefinition, DecisionResult } from '@/api/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FLAG_LABELS, humanize, percent } from '@/lib/format'
import { cn } from '@/lib/utils'

export function optionLabel(def: DecisionDefinition, value: string): string {
  if (def.type === 'score') {
    const description = def.options.find((o) => o.value === value)?.description ?? value
    return description.split(':')[0] ?? description
  }
  return humanize(value)
}

/** Expected score (0-1) for score decisions; otherwise the chosen option's probability. */
export function headline(def: DecisionDefinition, result: DecisionResult): number {
  if (def.type === 'score') {
    const max = def.options.length - 1
    return Object.entries(result.probs).reduce((s, [v, p]) => s + (Number(v) / max) * p, 0)
  }
  return result.probs[result.chosen] ?? 0
}

export function DecisionBars({ def, result }: { def: DecisionDefinition; result: DecisionResult }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{def.label}</span>
        <span className="flex items-center gap-1.5">
          {result.flags.length > 0 && (
            <Tooltip>
              <TooltipTrigger aria-label="Warnings for this decision">
                <TriangleAlert className="text-band-review-foreground size-3.5" />
              </TooltipTrigger>
              <TooltipContent>
                {result.flags.map((f) => FLAG_LABELS[f] ?? f).join('; ')}
              </TooltipContent>
            </Tooltip>
          )}
          <span className="text-muted-foreground">
            {optionLabel(def, result.chosen)}
            {def.type === 'score' && ` · ${percent(headline(def, result))}`}
          </span>
        </span>
      </div>
      <ul className="space-y-1" aria-label={`${def.label} probabilities`}>
        {def.options.map((o) => {
          const p = result.probs[o.value] ?? 0
          const chosen = o.value === result.chosen
          return (
            <li
              key={o.value}
              className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-xs"
            >
              <span
                className={cn('truncate', chosen ? 'font-medium' : 'text-muted-foreground')}
                title={o.description}
              >
                {optionLabel(def, o.value)}
              </span>
              <span className="bg-muted h-1.5 overflow-hidden rounded-full">
                <span
                  className={cn(
                    'block h-full rounded-full',
                    chosen ? 'bg-primary' : 'bg-muted-foreground/40',
                  )}
                  style={{ width: `${Math.round(p * 100)}%` }}
                />
              </span>
              <span className="text-right tabular-nums">{percent(p)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
