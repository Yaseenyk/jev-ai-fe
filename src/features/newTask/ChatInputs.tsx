import { ArrowUp, Check, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { z } from 'zod'

import type { Skill } from '@/api/types'
import { Button } from '@/components/ui/button'
import type { Option } from '@/features/newTask/script'
import { humanize } from '@/lib/format'
import { cn } from '@/lib/utils'

function useValidated(schema: z.ZodType<string>, initial = '') {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const submit = (onValid: (v: string) => void) => {
    const parsed = schema.safeParse(value)
    if (parsed.success) onValid(parsed.data)
    else setError(parsed.error.issues[0]?.message ?? 'Invalid answer')
  }
  const update = (v: string) => {
    setValue(v)
    setError(null)
  }
  return { value, setValue: update, error, submit }
}

/** Each new question's input takes focus when it appears, like a chat composer. */
function useFocusOnMount() {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return ref
}

function FieldError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-destructive mt-1 text-xs">
      {message}
    </p>
  ) : null
}

export function TextAnswer({
  placeholder,
  schema,
  optional,
  initial,
  onAnswer,
}: {
  placeholder: string
  schema: z.ZodType<string>
  optional?: boolean
  initial?: string
  onAnswer: (v: string) => void
}) {
  const f = useValidated(schema, initial)
  const focusRef = useFocusOnMount()
  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault()
        f.submit(onAnswer)
      }}
    >
      <div className={COMPOSER_CARD}>
        <div className="flex items-center gap-2 py-1.5 pr-1.5 pl-4">
          <input
            aria-label="Your answer"
            ref={focusRef}
            placeholder={placeholder}
            className="placeholder:text-muted-foreground h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            value={f.value}
            onChange={(e) => f.setValue(e.target.value)}
          />
          {optional && (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground h-9 rounded-full px-3"
              onClick={() => onAnswer('')}
            >
              Skip
            </Button>
          )}
          <Button
            type="submit"
            aria-label="Send answer"
            size="icon"
            className="size-9 rounded-full"
          >
            <ArrowUp />
          </Button>
        </div>
      </div>
      <FieldError message={f.error} />
    </form>
  )
}

type OtherSpec = { label: string; inputType: 'text' | 'date'; schema: z.ZodType<string> }

function OtherAnswer({ other, onAnswer }: { other: OtherSpec; onAnswer: (v: string) => void }) {
  const f = useValidated(other.schema)
  const focusRef = useFocusOnMount()
  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault()
        f.submit(onAnswer)
      }}
    >
      <div className={cn(COMPOSER_CARD, 'max-w-sm')}>
        <div className="flex items-center gap-2 py-1.5 pr-1.5 pl-4">
          <input
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            aria-label={other.label}
            ref={focusRef}
            type={other.inputType}
            value={f.value}
            onChange={(e) => f.setValue(e.target.value)}
          />
          <Button
            type="submit"
            aria-label="Send answer"
            size="icon"
            className="size-9 rounded-full"
          >
            <ArrowUp />
          </Button>
        </div>
      </div>
      <FieldError message={f.error} />
    </form>
  )
}

export function ChoiceAnswer({
  options,
  other,
  onAnswer,
}: {
  options: Option[]
  other?: OtherSpec
  onAnswer: (v: string) => void
}) {
  const [typing, setTyping] = useState(false)

  // Number keys pick a chip, unless the person is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField =
        e.target instanceof HTMLElement && e.target.closest('input, textarea') !== null
      const n = Number(e.key)
      const option = Number.isInteger(n) && n >= 1 ? options[n - 1] : undefined
      if (!inField && option && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        onAnswer(option.value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [options, onAnswer])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose an answer">
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onAnswer(o.value)}
            className="bg-surface hover:border-primary hover:bg-accent focus-visible:ring-ring flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {i < 9 && (
              <kbd
                aria-hidden
                className="text-muted-foreground bg-muted hidden size-5 place-items-center rounded text-[11px] font-normal md:grid"
              >
                {i + 1}
              </kbd>
            )}
            {o.label}
            {o.hint && <span className="text-muted-foreground text-xs font-normal">{o.hint}</span>}
          </button>
        ))}
        {other && !typing && (
          <button
            type="button"
            onClick={() => setTyping(true)}
            className="text-primary hover:bg-accent flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium"
          >
            <Plus className="size-4" /> {other.label}
          </button>
        )}
      </div>
      {other && typing && <OtherAnswer other={other} onAnswer={onAnswer} />}
    </div>
  )
}

const MAX_SUGGESTIONS = 8

const COMPOSER_CARD =
  'bg-background focus-within:border-primary/50 focus-within:ring-primary/15 rounded-3xl border shadow-sm transition-shadow focus-within:ring-4'

export function matchSkills(skills: Skill[], query: string, exclude: Set<string>): Skill[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return skills
    .filter((s) => !exclude.has(s.id))
    .filter((s) => s.name.toLowerCase().includes(q) || s.aliases.some((a) => a.includes(q)))
    .sort(
      (a, b) =>
        Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)),
    )
    .slice(0, MAX_SUGGESTIONS)
}

const CATEGORY_LABELS: Record<string, string> = { ai_ml: 'AI/ML', devops: 'DevOps' }

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase()
  const at = text.toLowerCase().indexOf(q)
  if (!q || at < 0) return <>{text}</>
  const end = at + q.length
  return (
    <span>
      {text.slice(0, at)}
      <strong className="font-semibold">{text.slice(at, end)}</strong>
      {text.slice(end)}
    </span>
  )
}

export function SkillsAnswer({
  skills,
  optional,
  exclude,
  initial,
  onAnswer,
}: {
  skills: Skill[]
  optional: boolean
  exclude: string[]
  initial?: string[]
  onAnswer: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const focusRef = useFocusOnMount()
  const [picked, setPicked] = useState<string[]>(initial ?? [])
  const [error, setError] = useState<string | null>(null)
  const byId = new Map(skills.map((s) => [s.id, s]))
  const suggestions = matchSkills(skills, query, new Set([...picked, ...exclude]))
  const pick = (id: string) => {
    setPicked((p) => [...p, id])
    setQuery('')
    setActive(0)
    setError(null)
    focusRef.current?.focus()
  }
  const finish = () => {
    if (picked.length || optional) onAnswer(picked)
    else setError('Pick at least one skill')
  }

  return (
    <div className="space-y-1.5">
      {suggestions.length > 0 && (
        <ul
          aria-label="Skill suggestions"
          className="bg-background max-h-52 overflow-y-auto rounded-2xl border p-1.5 shadow-sm"
        >
          {suggestions.map((s, i) => (
            <li key={s.id}>
              <Button
                variant="ghost"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(s.id)}
                className={cn(
                  'h-10 w-full justify-between rounded-xl px-3 text-[15px] font-normal',
                  i === active && 'bg-accent',
                )}
              >
                <span className="flex items-center gap-2">
                  <Plus className="text-muted-foreground" />
                  <Highlight text={s.name} query={query} />
                </span>
                <span className="text-muted-foreground text-xs">
                  {CATEGORY_LABELS[s.category] ?? humanize(s.category)}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && suggestions.length === 0 && (
        <p className="text-muted-foreground px-1 text-xs">
          No skill matches “{query}”. Skills come from the company skills list.
        </p>
      )}
      <div className={COMPOSER_CARD}>
        <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5">
          {picked.length > 0 && (
            <ul className="contents" aria-label="Selected skills">
              {picked.map((id) => (
                <li
                  key={id}
                  className="bg-accent text-accent-foreground flex h-8 items-center gap-1 rounded-full pr-1 pl-3 text-sm font-medium"
                >
                  {byId.get(id)?.name ?? id}
                  <button
                    type="button"
                    aria-label={`Remove ${byId.get(id)?.name ?? id}`}
                    className="hover:bg-background/60 grid size-6 place-items-center rounded-full"
                    onClick={() => setPicked((p) => p.filter((x) => x !== id))}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            aria-label="Search skills"
            ref={focusRef}
            placeholder={
              picked.length ? 'Add another skill' : 'Type a skill, e.g. Spark, React, Azure'
            }
            className="placeholder:text-muted-foreground h-8 min-w-40 flex-1 bg-transparent px-1 text-[15px] outline-none"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                const n = Math.max(1, suggestions.length)
                setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + n) % n)
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const s = suggestions[active] ?? suggestions[0]
                if (s) pick(s.id)
                else if (!query.trim()) finish()
              } else if (e.key === 'Backspace' && !query && picked.length) {
                setPicked((p) => p.slice(0, -1))
              }
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-2">
          <span className="text-muted-foreground text-xs">
            {picked.length
              ? `${picked.length} selected`
              : 'Search the skills list. ↑↓ to move, Enter to add'}
          </span>
          <Button size="sm" className="h-9 rounded-full px-4" onClick={finish}>
            {picked.length ? (
              <>
                <Check /> Done
              </>
            ) : optional ? (
              'Skip'
            ) : (
              'Done'
            )}
          </Button>
        </div>
      </div>
      <FieldError message={error} />
    </div>
  )
}
