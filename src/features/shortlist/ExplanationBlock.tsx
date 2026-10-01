import { Sparkles } from 'lucide-react'

import type { Explanation, ExplanationPoint } from '@/api/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function FactChips({ ids, explanation }: { ids: string[]; explanation: Explanation }) {
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {ids.map((id) => {
        const fact = explanation.facts.find((f) => f.id === id)
        return (
          <Tooltip key={id}>
            <TooltipTrigger className="bg-muted rounded px-1 font-mono text-[10px]">
              {id}
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {fact ? `${fact.label}: ${fact.value}` : 'Fact not found'}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </span>
  )
}

function Points({
  title,
  points,
  explanation,
}: {
  title: string
  points: ExplanationPoint[]
  explanation: Explanation
}) {
  if (points.length === 0) return null
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium">{title}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-sm">
        {points.map((p, i) => (
          <li key={i}>
            {p.text}
            <FactChips ids={p.fact_ids} explanation={explanation} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ExplanationBlock({
  explanation,
  status,
}: {
  explanation: Explanation | null
  status: 'ok' | 'unavailable' | null
}) {
  if (status === null) return null
  return (
    <div className="bg-muted/40 space-y-2 rounded-lg border p-3">
      <p className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
        <Sparkles className="size-3.5" aria-hidden /> AI-generated summary · every point cites the
        facts it uses
      </p>
      {explanation ? (
        <>
          <p className="text-sm">{explanation.summary}</p>
          <Points title="Strengths" points={explanation.strengths} explanation={explanation} />
          <Points title="Gaps" points={explanation.gaps} explanation={explanation} />
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Explanation unavailable: the AI's answer did not pass the fact check, so it is not shown.
        </p>
      )}
    </div>
  )
}
