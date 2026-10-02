import {
  ArrowDown,
  ArrowUp,
  Check,
  ClipboardList,
  CornerUpLeft,
  Lightbulb,
  ListChecks,
  Loader2,
  Pencil,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import type { InterpretResponse, Skill } from '@/api/types'
import { ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ChoiceAnswer, SkillsAnswer, TextAnswer } from '@/features/newTask/ChatInputs'
import { useCreateTask, useInterpret, useSkills } from '@/features/newTask/api'
import {
  type Draft,
  FIELD_LABELS,
  STAGES,
  type Step,
  applyAnswer,
  fromInterpretation,
  isAnswered,
  nextStep,
  steps as buildSteps,
  toTaskCreate,
} from '@/features/newTask/script'
import { useTasks } from '@/features/tasks/api'
import { date } from '@/lib/format'
import { cn } from '@/lib/utils'

const DRAFT_KEY = 'srtm:new-task-draft'

interface Saved {
  draft: Draft
  current: number | null
  description?: string
  prefilled?: (keyof Draft)[]
}

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Saved) : null
  } catch {
    return null
  }
}

function save(value: Saved | null) {
  try {
    if (value) localStorage.setItem(DRAFT_KEY, JSON.stringify(value))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Storage can be unavailable (private mode); the chat still works without a saved draft.
  }
}

export default function NewTaskChatPage() {
  const tasks = useTasks({ q: '', priority: '', domain: '' })
  const skills = useSkills()

  if (tasks.isPending || skills.isPending) return <Skeleton className="h-96 w-full rounded-2xl" />
  if (tasks.isError) return <ErrorState error={tasks.error} />
  if (skills.isError) return <ErrorState error={skills.error} />

  const clients = [...new Set(tasks.data.items.map((t) => t.client_code))].sort()
  return <Chat clients={clients} skills={skills.data} />
}

function answerText(step: Step, d: Draft, skillName: (id: string) => string, today: Date): string {
  const v = d[step.id]
  if (step.kind === 'skills') {
    const ids = v as string[]
    return ids.length ? ids.map(skillName).join(', ') : 'None'
  }
  if (step.kind === 'text') return (v as string) || 'Skipped'
  const option = step.options(d, today).find((o) => o.value === String(v))
  if (step.id === 'start_date') {
    return option ? `${option.label} (${date(String(v))})` : date(String(v))
  }
  return option?.label ?? String(v)
}

type Mode = 'describe' | 'confirm' | 'questions'

const EXAMPLE =
  'Senior PySpark engineer for ACME claims migration, hybrid in Hyderabad, starting next month for about 6 months. SQL is a must, Airflow is a plus.'

function Chat({ clients, skills }: { clients: string[]; skills: Skill[] }) {
  const navigate = useNavigate()
  const create = useCreateTask()
  const interpret = useInterpret()
  const all = useMemo(() => buildSteps(clients), [clients])
  const [today] = useState(() => new Date())
  const [initial] = useState(loadSaved)
  const hadDraft = initial !== null && Object.keys(initial.draft).length > 0
  const [draft, setDraft] = useState<Draft>(initial?.draft ?? {})
  const [current, setCurrent] = useState<number | null>(initial ? initial.current : 0)
  const [mode, setMode] = useState<Mode>(hadDraft ? 'questions' : 'describe')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [prefilled, setPrefilled] = useState<(keyof Draft)[]>(initial?.prefilled ?? [])
  const [understood, setUnderstood] = useState<{ draft: Draft; r: InterpretResponse } | null>(null)
  const [intakeNote, setIntakeNote] = useState<string | null>(null)
  const [restored, setRestored] = useState(hadDraft)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [composerText, setComposerText] = useState(initial?.description ?? '')
  const [atBottom, setAtBottom] = useState(true)
  const scroller = useRef<HTMLDivElement>(null)

  const byId = useMemo(() => new Map(skills.map((s) => [s.id, s.name])), [skills])
  const skillName = (id: string) => byId.get(id) ?? id
  const shown = mode === 'confirm' && understood ? understood.draft : draft
  const describe = (s: Step) => answerText(s, shown, skillName, today)
  const applies = (s: Step) => !s.skip?.(shown)
  const step = mode === 'questions' && current !== null ? all[current] : undefined

  useEffect(() => {
    if (mode === 'questions') save({ draft, current, description, prefilled })
  }, [mode, draft, current, description, prefilled])

  const scrollToEnd = (behavior: ScrollBehavior) => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior })
  }
  const onScroll = () => {
    const el = scroller.current
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }

  useEffect(() => {
    scrollToEnd('smooth')
  }, [mode, current, draft, interpret.isPending])

  const answer = (index: number, value: string | string[]) => {
    const s = all[index]
    if (!s) return
    const next = applyAnswer(draft, s.id, value)
    setDraft(next)
    setPrefilled((p) => p.filter((f) => f !== s.id))
    setCurrent(nextStep(all, next, index))
  }

  const stepByStep = (note: string | null = null) => {
    setIntakeNote(note)
    setUnderstood(null)
    setMode('questions')
    setCurrent(nextStep(all, draft))
  }

  const send = (text: string) => {
    setDescription(text)
    interpret.mutate(
      { text, known_clients: clients },
      {
        onSuccess: (r) => {
          const d = fromInterpretation(r, clients, today)
          if (Object.keys(d).length === 0) {
            stepByStep("I couldn't pick out any details from that, so let's go step by step.")
            return
          }
          setUnderstood({ draft: d, r })
          setMode('confirm')
        },
        onError: () => {
          stepByStep("I couldn't read your description just now, so let's go step by step.")
        },
      },
    )
  }

  const confirm = () => {
    if (!understood) return
    const keys = Object.keys(understood.draft) as (keyof Draft)[]
    setDraft(understood.draft)
    setPrefilled(keys)
    setUnderstood(null)
    setMode('questions')
    setCurrent(nextStep(all, understood.draft))
  }

  const goBack = () => {
    const before = current === null ? all.length : current
    for (let i = before - 1; i >= 0; i--) {
      const s = all[i]
      if (s && applies(s) && !prefilled.includes(s.id)) {
        setCurrent(i)
        return
      }
    }
  }

  const startOver = () => {
    setDraft({})
    setCurrent(0)
    setMode('describe')
    setDescription('')
    setComposerText('')
    setPrefilled([])
    setUnderstood(null)
    setIntakeNote(null)
    setRestored(false)
    save(null)
  }

  const history = all
    .map((s, i) => ({ s, i }))
    .filter(
      ({ s, i }) =>
        i !== current && applies(s) && isAnswered(draft, s.id) && !prefilled.includes(s.id),
    )
  const missing = (d: Draft) => all.filter((s) => !s.skip?.(d) && !isAnswered(d, s.id)).length

  const preview = (inSheet: boolean) => (
    <TaskPreview
      showTitle={!inSheet}
      steps={all}
      draft={shown}
      current={mode === 'questions' ? current : null}
      describe={describe}
      onEdit={(i) => {
        if (mode === 'confirm') confirm()
        else if (mode === 'describe') stepByStep()
        setCurrent(i)
        setPreviewOpen(false)
      }}
    />
  )

  const empty = mode === 'describe' && !description && !interpret.isPending && !restored

  return (
    <div className="-mb-10 flex h-[calc(100svh-9.5rem)] gap-6 md:mb-0 md:h-[calc(100svh-5rem)] lg:h-[calc(100svh-5.5rem)]">
      <section
        aria-label="New task conversation"
        className="bg-surface relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border"
      >
        <header className="flex flex-col gap-3 border-b px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="font-heading truncate text-lg leading-tight font-semibold">
                  New task
                </h1>
                <p className="text-muted-foreground hidden truncate text-xs sm:block">
                  Staffing assistant · you confirm everything before it's created
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-full lg:hidden"
                onClick={() => setPreviewOpen(true)}
              >
                <ClipboardList /> Preview
              </Button>
              <Button variant="ghost" size="sm" className="h-9 rounded-full" onClick={startOver}>
                <RotateCcw /> <span className="hidden sm:inline">Start over</span>
              </Button>
            </div>
          </div>
          {!empty && (
            <StageProgress
              steps={all}
              draft={shown}
              current={mode === 'questions' ? current : null}
            />
          )}
        </header>

        <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-6 sm:px-6">
            {empty ? (
              <Welcome onPick={setComposerText} />
            ) : (
              <>
                {restored && (
                  <p className="bg-accent text-accent-foreground mb-5 flex flex-wrap items-center gap-x-2 rounded-xl px-4 py-2.5 text-sm">
                    Picked up where you left off.
                    <button
                      type="button"
                      className="font-medium underline underline-offset-4"
                      onClick={startOver}
                    >
                      Start over
                    </button>
                  </p>
                )}
                <ol className="space-y-6" aria-live="polite">
                  {(mode !== 'questions' || description) && (
                    <li>
                      <BotMessage>
                        Hi! Describe the role in your own words, like you would to a colleague. I'll
                        fill in what I can and only ask about what's missing.
                      </BotMessage>
                    </li>
                  )}
                  {description && (mode !== 'describe' || interpret.isPending) && (
                    <li className="space-y-6">
                      <UserText text={description} />
                      {interpret.isPending && (
                        <BotMessage>
                          <span className="sr-only">Reading your description…</span>
                          <TypingDots />
                        </BotMessage>
                      )}
                      {mode === 'questions' && prefilled.length > 0 && (
                        <BotMessage>
                          I filled in {prefilled.length}{' '}
                          {prefilled.length === 1 ? 'detail' : 'details'} from that. They're in the
                          preview, and you can change any of them.
                        </BotMessage>
                      )}
                    </li>
                  )}
                  {intakeNote && mode === 'questions' && (
                    <li>
                      <BotMessage>{intakeNote}</BotMessage>
                    </li>
                  )}
                  {mode === 'confirm' && understood && (
                    <li className="space-y-3">
                      <BotMessage>
                        Here's what I understood. Check it, then I'll ask only what's missing.
                      </BotMessage>
                      <Understood
                        steps={all}
                        draft={understood.draft}
                        r={understood.r}
                        describe={describe}
                        left={missing(understood.draft)}
                      />
                    </li>
                  )}
                  {mode === 'questions' &&
                    history.map(({ s, i }) => (
                      <li key={s.id} className="space-y-3">
                        <BotMessage>{s.prompt(draft)}</BotMessage>
                        <UserAnswer
                          label={FIELD_LABELS[s.id]}
                          text={describe(s)}
                          onEdit={() => setCurrent(i)}
                        />
                      </li>
                    ))}
                  {mode === 'questions' &&
                    (step ? (
                      <li>
                        <BotMessage>
                          {isAnswered(draft, step.id) && (
                            <span className="text-muted-foreground block text-xs">
                              Changing your answer
                            </span>
                          )}
                          {step.prompt(draft)}
                        </BotMessage>
                      </li>
                    ) : (
                      <li className="space-y-3">
                        <BotMessage>
                          That's everything. Check the preview, change anything you like, then
                          create the task.
                        </BotMessage>
                        <div className="flex flex-wrap gap-2 pl-11">
                          <Button
                            size="lg"
                            className="h-11 rounded-full px-5"
                            disabled={create.isPending}
                            onClick={() =>
                              create.mutate(toTaskCreate(draft), {
                                onSuccess: (task) => {
                                  save(null)
                                  void navigate(`/tasks/${task.id}`)
                                },
                              })
                            }
                          >
                            {create.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                            Create task
                          </Button>
                          <Button
                            variant="outline"
                            size="lg"
                            className="h-11 rounded-full lg:hidden"
                            onClick={() => setPreviewOpen(true)}
                          >
                            Review answers
                          </Button>
                        </div>
                        {create.isError && <ErrorState error={create.error} />}
                      </li>
                    ))}
                </ol>
              </>
            )}
            {!atBottom && !empty && (
              <div className="pointer-events-none sticky bottom-2 mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Jump to latest message"
                  className="bg-surface pointer-events-auto size-9 rounded-full shadow-md"
                  onClick={() => scrollToEnd('smooth')}
                >
                  <ArrowDown />
                </Button>
              </div>
            )}
          </div>
        </div>

        <footer className="bg-surface border-t px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <div className="mx-auto max-w-2xl">
            {mode === 'describe' && (
              <DescribeComposer
                value={composerText}
                onChange={setComposerText}
                pending={interpret.isPending}
                onSend={send}
                onStepByStep={() => stepByStep()}
              />
            )}
            {mode === 'confirm' && (
              <div className="flex flex-wrap gap-2">
                <Button size="lg" className="h-11 rounded-full px-5" onClick={confirm}>
                  <Check /> Looks right, continue
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 rounded-full"
                  onClick={() => {
                    setComposerText(description)
                    setUnderstood(null)
                    setMode('describe')
                  }}
                >
                  Edit my description
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="h-11 rounded-full"
                  onClick={() => stepByStep()}
                >
                  Answer step by step instead
                </Button>
              </div>
            )}
            {step && current !== null && (
              <>
                <StepInput
                  key={step.id}
                  step={step}
                  draft={draft}
                  skills={skills}
                  today={today}
                  onAnswer={(v) => answer(current, v)}
                />
                <div className="text-muted-foreground mt-2 flex items-center justify-between gap-3 text-xs">
                  <button
                    type="button"
                    onClick={goBack}
                    className="hover:text-foreground flex h-8 items-center gap-1 rounded-md"
                  >
                    <CornerUpLeft className="size-3.5" /> Go back
                  </button>
                  <span className="hidden md:inline">
                    {step.kind === 'choice' ? 'Press 1–9 to pick' : 'Press Enter to send'}
                  </span>
                </div>
              </>
            )}
          </div>
        </footer>
      </section>

      <aside className="bg-surface hidden w-76 shrink-0 flex-col overflow-hidden rounded-3xl border lg:flex">
        <p className="flex items-center gap-2 border-b px-4 py-3.5 text-sm font-semibold">
          <ClipboardList className="text-muted-foreground size-4" aria-hidden /> Task preview
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto">{preview(true)}</div>
      </aside>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Task preview</DialogTitle>
            <DialogDescription>Tap any answer to change it.</DialogDescription>
          </DialogHeader>
          {previewOpen && preview(true)}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const SUGGESTIONS = [
  {
    label: 'React developer',
    text: 'Senior React developer for CL-ACME, onsite in Bengaluru, starting in 2 weeks for about 3 months. Node.js and REST API design are must-haves.',
  },
  {
    label: 'Data engineer, US hours',
    text: 'Lead data engineer for a CL-HELIX banking migration, remote, US East client with 4 hours overlap, for 6 months. Spark and Snowflake are required.',
  },
  {
    label: 'Part-time QA',
    text: 'QA engineer for CL-ORBIT, hybrid in Pune, part-time for 8 weeks starting next month. Playwright is a must, API testing is a plus.',
  },
  {
    label: 'DevOps, start now',
    text: 'Senior DevOps engineer, onsite in Hyderabad, starting as soon as possible for 6 months. Kubernetes and Terraform are required.',
  },
]

function Welcome({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="my-auto py-6">
      <span className="bg-primary text-primary-foreground grid size-11 place-items-center rounded-2xl">
        <Sparkles className="size-5" aria-hidden />
      </span>
      <h2 className="font-heading mt-5 text-[26px] leading-tight font-semibold sm:text-[32px]">
        Which role do you need to fill?
      </h2>
      <p className="text-muted-foreground mt-2 max-w-lg text-[15px]">
        Describe it like you would to a colleague. I'll pick out the details, ask only about what's
        missing, and you confirm everything before the task is created.
      </p>
      <ul className="mt-7 grid gap-2.5 sm:grid-cols-2" aria-label="Example descriptions">
        {SUGGESTIONS.map((s) => (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => onPick(s.text)}
              className="hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-ring group flex h-full w-full flex-col gap-1.5 rounded-2xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="text-sm font-medium">{s.label}</span>
              <span className="text-muted-foreground line-clamp-2 text-[13px] leading-snug">
                {s.text}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex h-6 items-center gap-1" aria-hidden>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}

function DescribeComposer({
  value,
  onChange,
  pending,
  onSend,
  onStepByStep,
}: {
  value: string
  onChange: (text: string) => void
  pending: boolean
  onSend: (text: string) => void
  onStepByStep: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  const ready = value.trim().length >= 3 && !pending
  const submit = () => {
    if (ready) onSend(value.trim())
  }
  return (
    <div>
      <div className="bg-background focus-within:border-primary/50 focus-within:ring-primary/15 rounded-3xl border shadow-sm transition-shadow focus-within:ring-4">
        <Textarea
          ref={ref}
          aria-label="Describe the role"
          rows={1}
          maxLength={2000}
          placeholder="Describe the role you need…"
          className="field-sizing-content max-h-40 min-h-12 resize-none border-0 bg-transparent px-4 pt-3.5 text-[15px] shadow-none focus-visible:ring-0 dark:bg-transparent"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex flex-wrap gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-8 rounded-full"
              onClick={onStepByStep}
            >
              <ListChecks /> Answer step by step instead
            </Button>
            {!value && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hidden h-8 rounded-full sm:inline-flex"
                onClick={() => onChange(EXAMPLE)}
              >
                <Lightbulb /> Use an example
              </Button>
            )}
          </div>
          <Button
            aria-label="Send description"
            size="icon"
            className="size-9 shrink-0 rounded-full"
            disabled={!ready}
            onClick={submit}
          >
            {pending ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground mt-2 hidden text-center text-xs md:block">
        Enter to send, Shift+Enter for a new line. AI can misread details; you'll confirm them.
      </p>
    </div>
  )
}

function Understood({
  steps,
  draft,
  r,
  describe,
  left,
}: {
  steps: Step[]
  draft: Draft
  r: InterpretResponse
  describe: (s: Step) => string
  left: number
}) {
  const found = steps.filter((s) => isAnswered(draft, s.id))
  return (
    <div className="bg-surface ml-11 space-y-3 rounded-2xl border p-4">
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[9rem_1fr]">
        {found.map((s) => (
          <div key={s.id} className="contents">
            <dt className="text-muted-foreground">{FIELD_LABELS[s.id]}</dt>
            <dd className="font-medium">{describe(s)}</dd>
          </div>
        ))}
      </dl>
      {r.unmatched_skills.length > 0 && (
        <p className="bg-band-review text-band-review-foreground rounded-lg px-3 py-2 text-sm">
          Not in the skills list: {r.unmatched_skills.join(', ')}. You can pick the closest skills
          in the next questions.
        </p>
      )}
      {r.notes.map((n) => (
        <p key={n} className="text-muted-foreground text-sm">
          {n}
        </p>
      ))}
      <p className="text-muted-foreground text-sm">
        {left === 0
          ? 'Nothing else to ask.'
          : `${left} ${left === 1 ? 'question' : 'questions'} left after this.`}
      </p>
    </div>
  )
}

function UserText({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="bg-muted max-w-[85%] rounded-3xl rounded-tr-lg px-4 py-2.5 text-[15px] whitespace-pre-wrap">
        {text}
      </p>
    </div>
  )
}

function StageProgress({
  steps,
  draft,
  current,
}: {
  steps: Step[]
  draft: Draft
  current: number | null
}) {
  const currentId = current === null ? null : steps[current]?.id
  return (
    <ol className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Progress">
      {STAGES.map((stage) => {
        const fields = steps.filter((s) => stage.fields.includes(s.id) && !s.skip?.(draft))
        const done = fields.every((s) => isAnswered(draft, s.id))
        const active =
          currentId !== null && currentId !== undefined && stage.fields.includes(currentId)
        return (
          <li
            key={stage.id}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium',
              done && !active && 'bg-accent text-accent-foreground',
              active && 'bg-foreground text-background',
              !done && !active && 'bg-muted text-muted-foreground',
            )}
          >
            {done && !active && <Check className="size-3.5" aria-hidden />}
            {stage.label}
            {done && !active && <span className="sr-only">(done)</span>}
          </li>
        )
      })}
    </ol>
  )
}

function TaskPreview({
  showTitle,
  steps,
  draft,
  current,
  describe,
  onEdit,
}: {
  showTitle: boolean
  steps: Step[]
  draft: Draft
  current: number | null
  describe: (s: Step) => string
  onEdit: (index: number) => void
}) {
  const index = new Map(steps.map((s, i) => [s.id, i]))
  return (
    <div className={cn(showTitle && 'bg-surface rounded-2xl border')}>
      {showTitle && (
        <p className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold">
          <ClipboardList className="text-muted-foreground size-4" aria-hidden /> Task preview
        </p>
      )}
      <div className="divide-y">
        {STAGES.map((stage) => (
          <div key={stage.id} className="px-2 py-2">
            <p className="text-muted-foreground px-2 pt-1 pb-1.5 text-xs font-medium">
              {stage.label}
            </p>
            <ul>
              {stage.fields.map((field) => {
                const i = index.get(field)
                const s = i === undefined ? undefined : steps[i]
                if (!s || i === undefined) return null
                const skipped = s.skip?.(draft) ?? false
                const answered = isAnswered(draft, field)
                const isCurrent = current === i
                return (
                  <li key={field}>
                    <button
                      type="button"
                      disabled={skipped}
                      aria-label={`Edit ${FIELD_LABELS[field]}`}
                      onClick={() => onEdit(i)}
                      className={cn(
                        'hover:bg-muted flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm',
                        isCurrent && 'bg-accent hover:bg-accent',
                        skipped && 'hover:bg-transparent',
                      )}
                    >
                      <span className="text-muted-foreground shrink-0">{FIELD_LABELS[field]}</span>
                      <span
                        className={cn(
                          'min-w-0 truncate text-right',
                          answered && !skipped ? 'font-medium' : 'text-muted-foreground',
                        )}
                      >
                        {skipped
                          ? 'Not needed'
                          : answered
                            ? describe(s)
                            : isCurrent
                              ? 'Answering…'
                              : '—'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepInput({
  step,
  draft,
  skills,
  today,
  onAnswer,
}: {
  step: Step
  draft: Draft
  skills: Skill[]
  today: Date
  onAnswer: (v: string | string[]) => void
}) {
  if (step.kind === 'text') {
    return (
      <TextAnswer
        placeholder={step.placeholder}
        schema={step.schema}
        optional={step.optional ?? false}
        initial={draft[step.id] as string | undefined}
        onAnswer={onAnswer}
      />
    )
  }
  if (step.kind === 'skills') {
    // Nice-to-have suggestions leave out skills already chosen as must-have, and vice versa.
    const exclude =
      step.id === 'nice_skills' ? (draft.must_skills ?? []) : (draft.nice_skills ?? [])
    return (
      <SkillsAnswer
        skills={skills}
        optional={step.optional}
        exclude={exclude}
        initial={draft[step.id] as string[] | undefined}
        onAnswer={onAnswer}
      />
    )
  }
  return (
    <ChoiceAnswer options={step.options(draft, today)} other={step.other} onAnswer={onAnswer} />
  )
}

function BotMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-full">
        <Sparkles className="size-4" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 pt-1 text-[15px] leading-relaxed">{children}</p>
    </div>
  )
}

function UserAnswer({ text, label, onEdit }: { text: string; label: string; onEdit: () => void }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Change ${label}: ${text}`}
        title="Click to change"
        className="bg-muted hover:bg-accent focus-visible:ring-ring group flex max-w-[85%] items-center gap-2 rounded-3xl rounded-tr-lg px-4 py-2.5 text-left text-[15px] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {text}
        <Pencil
          className="text-muted-foreground size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      </button>
    </div>
  )
}
