import { Plus, SendHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { z } from 'zod'

import type { Skill } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Option } from '@/features/newTask/script'

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
      <div className="flex gap-2">
        <Input
          aria-label="Your answer"
          ref={focusRef}
          placeholder={placeholder}
          className="bg-surface h-11 rounded-xl text-[15px]"
          value={f.value}
          onChange={(e) => f.setValue(e.target.value)}
        />
        <Button type="submit" aria-label="Send answer" className="size-11 shrink-0 rounded-xl">
          <SendHorizontal />
        </Button>
        {optional && (
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl px-4"
            onClick={() => onAnswer('')}
          >
            Skip
          </Button>
        )}
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
      <div className="flex max-w-sm gap-2">
        <Input
          className="bg-surface h-11 rounded-xl"
          aria-label={other.label}
          ref={focusRef}
          type={other.inputType}
          value={f.value}
          onChange={(e) => f.setValue(e.target.value)}
        />
        <Button type="submit" aria-label="Send answer" className="size-11 shrink-0 rounded-xl">
          <SendHorizontal />
        </Button>
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
  const focusRef = useFocusOnMount()
  const [picked, setPicked] = useState<string[]>(initial ?? [])
  const [error, setError] = useState<string | null>(null)
  const byId = new Map(skills.map((s) => [s.id, s]))
  const suggestions = matchSkills(skills, query, new Set([...picked, ...exclude]))
  const pick = (id: string) => {
    setPicked((p) => [...p, id])
    setQuery('')
    setError(null)
  }

  return (
    <div className="space-y-2">
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected skills">
          {picked.map((id) => (
            <li key={id}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {byId.get(id)?.name ?? id}
                <button
                  type="button"
                  aria-label={`Remove ${byId.get(id)?.name ?? id}`}
                  className="hover:bg-muted rounded-full p-0.5"
                  onClick={() => setPicked((p) => p.filter((x) => x !== id))}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          aria-label="Search skills"
          ref={focusRef}
          className="bg-surface h-11 rounded-xl text-[15px]"
          placeholder="Type a skill, e.g. Spark, React, Azure"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            const first = suggestions[0]
            if (e.key === 'Enter' && first) {
              e.preventDefault()
              pick(first.id)
            }
          }}
        />
        <Button
          className="h-11 rounded-xl px-5"
          onClick={() =>
            picked.length || optional ? onAnswer(picked) : setError('Pick at least one skill')
          }
        >
          {picked.length ? 'Done' : optional ? 'Skip' : 'Done'}
        </Button>
      </div>
      {suggestions.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Skill suggestions">
          {suggestions.map((s) => (
            <li key={s.id}>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => pick(s.id)}
              >
                <Plus /> {s.name}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && suggestions.length === 0 && (
        <p className="text-muted-foreground text-xs">
          No skill matches “{query}”. Skills come from the company skills list.
        </p>
      )}
      <FieldError message={error} />
    </div>
  )
}
