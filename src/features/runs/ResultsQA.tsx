import { ArrowUp, ChevronDown, MessageSquareText, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { type Answer, type QaContext, SUGGESTIONS, answer } from '@/features/runs/qa'
import { cn } from '@/lib/utils'

interface Turn {
  question: string
  reply: Answer
}

export function ResultsQA({ ctx }: { ctx: QaContext }) {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [turns])

  const ask = (question: string) => {
    const q = question.trim()
    if (!q) return
    setTurns((t) => [...t, { question: q, reply: answer(q, ctx) }])
    setText('')
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="bg-surface rounded-2xl border">
      <CollapsibleTrigger asChild>
        <button className="hover:bg-muted/40 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left">
          <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-full">
            <MessageSquareText className="size-4" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold">Ask about these results</span>
            <span className="text-muted-foreground block text-xs">
              Why someone is ranked here, why not someone else, compare two people…
            </span>
          </span>
          <ChevronDown
            className={cn(
              'text-muted-foreground size-4 transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-4 pt-4 pb-4">
        {turns.length > 0 && (
          <ol className="mb-4 max-h-[28rem] space-y-5 overflow-y-auto pr-1" aria-live="polite">
            {turns.map((t, i) => (
              <li key={i} className="space-y-3">
                <div className="flex justify-end">
                  <p className="bg-muted max-w-[85%] rounded-3xl rounded-tr-lg px-4 py-2 text-sm">
                    {t.question}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary grid size-7 shrink-0 place-items-center rounded-full">
                    <Sparkles className="size-3.5" aria-hidden />
                  </span>
                  <AnswerView reply={t.reply} />
                </div>
              </li>
            ))}
            <div ref={end} />
          </ol>
        )}
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="Suggested questions">
          {SUGGESTIONS.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => ask(s)}
                className="hover:border-primary/40 hover:bg-accent/50 rounded-full border px-3 py-1.5 text-xs"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            ask(text)
          }}
          className="bg-background focus-within:border-primary/50 focus-within:ring-primary/15 flex items-center gap-2 rounded-3xl border py-1.5 pr-1.5 pl-4 focus-within:ring-4"
        >
          <input
            aria-label="Ask about these results"
            placeholder="e.g. Why not Priya? or Compare #1 and #3"
            className="placeholder:text-muted-foreground h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Ask"
            className="size-9 rounded-full"
            disabled={!text.trim()}
          >
            <ArrowUp />
          </Button>
        </form>
        <p className="text-muted-foreground mt-2 text-xs">
          Answers come from this run's facts and model results; nothing is generated.
        </p>
      </CollapsibleContent>
    </Collapsible>
  )
}

function AnswerView({ reply }: { reply: Answer }) {
  return (
    <div className="min-w-0 flex-1 space-y-1.5 text-sm">
      <p className="font-semibold">{reply.title}</p>
      {reply.lines.map((l) => (
        <p key={l} className="leading-relaxed">
          {l}
        </p>
      ))}
      {reply.table && (
        <div className="mt-2 overflow-x-auto rounded-xl border">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr>
                {reply.table.head.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reply.table.rows.map((row) => (
                <tr key={row[0]} className="border-t">
                  {row.map((c, i) => (
                    <td key={i} className={cn('px-3 py-1.5', i === 0 && 'text-muted-foreground')}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
