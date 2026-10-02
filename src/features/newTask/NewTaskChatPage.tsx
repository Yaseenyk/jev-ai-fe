import { Check, ClipboardList, CornerUpLeft, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import type { Skill } from '@/api/types'
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
import { ChoiceAnswer, SkillsAnswer, TextAnswer } from '@/features/newTask/ChatInputs'
import { useCreateTask, useSkills } from '@/features/newTask/api'
import {
  type Draft,
  FIELD_LABELS,
  STAGES,
  type Step,
  applyAnswer,
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

function Chat({ clients, skills }: { clients: string[]; skills: Skill[] }) {
  const navigate = useNavigate()
  const create = useCreateTask()
  const all = useMemo(() => buildSteps(clients), [clients])
  const [today] = useState(() => new Date())
  const [initial] = useState(loadSaved)
  const [draft, setDraft] = useState<Draft>(initial?.draft ?? {})
  const [current, setCurrent] = useState<number | null>(initial ? initial.current : 0)
  const [restored, setRestored] = useState(
    initial !== null && Object.keys(initial.draft).length > 0,
  )
  const [previewOpen, setPreviewOpen] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  const byId = useMemo(() => new Map(skills.map((s) => [s.id, s.name])), [skills])
  const skillName = (id: string) => byId.get(id) ?? id
  const describe = (s: Step) => answerText(s, draft, skillName, today)
  const applies = (s: Step) => !s.skip?.(draft)
  const step = current === null ? undefined : all[current]

  useEffect(() => {
    save({ draft, current })
  }, [draft, current])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [current, draft])

  const answer = (index: number, value: string | string[]) => {
    const s = all[index]
    if (!s) return
    const next = applyAnswer(draft, s.id, value)
    setDraft(next)
    setCurrent(nextStep(all, next, index))
  }

  const goBack = () => {
    const before = current === null ? all.length : current
    for (let i = before - 1; i >= 0; i--) {
      const s = all[i]
      if (s && applies(s)) {
        setCurrent(i)
        return
      }
    }
  }

  const startOver = () => {
    setDraft({})
    setCurrent(0)
    setRestored(false)
  }

  const history = all
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => i !== current && applies(s) && isAnswered(draft, s.id))

  const preview = (inSheet: boolean) => (
    <TaskPreview
      showTitle={!inSheet}
      steps={all}
      draft={draft}
      current={current}
      describe={describe}
      onEdit={(i) => {
        setCurrent(i)
        setPreviewOpen(false)
      }}
    />
  )

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10">
      <section aria-label="New task conversation" className="min-w-0">
        <header className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">New task</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Answer a few questions. The task builds itself as you go.
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl lg:hidden"
                onClick={() => setPreviewOpen(true)}
              >
                <ClipboardList /> Preview
              </Button>
              <Button variant="ghost" size="sm" className="h-9 rounded-xl" onClick={startOver}>
                <RotateCcw /> <span className="hidden sm:inline">Start over</span>
              </Button>
            </div>
          </div>
          <StageProgress steps={all} draft={draft} current={current} />
        </header>

        {restored && (
          <p className="bg-accent text-accent-foreground mt-5 flex flex-wrap items-center gap-x-2 rounded-xl px-4 py-2.5 text-sm">
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

        <ol className="mt-6 space-y-5" aria-live="polite">
          {history.map(({ s, i }) => (
            <li key={s.id} className="space-y-2">
              <BotMessage>{s.prompt(draft)}</BotMessage>
              <UserAnswer
                label={FIELD_LABELS[s.id]}
                text={describe(s)}
                onEdit={() => setCurrent(i)}
              />
            </li>
          ))}
          {step ? (
            <li>
              <BotMessage>
                {isAnswered(draft, step.id) && (
                  <span className="text-muted-foreground block text-xs">Changing your answer</span>
                )}
                {step.prompt(draft)}
              </BotMessage>
            </li>
          ) : (
            <li className="space-y-3">
              <BotMessage>
                That's everything. Check the preview, change anything you like, then create the
                task.
              </BotMessage>
              <div className="flex flex-wrap gap-2 pl-11">
                <Button
                  size="lg"
                  className="h-11 rounded-xl px-5"
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
                  className="h-11 rounded-xl lg:hidden"
                  onClick={() => setPreviewOpen(true)}
                >
                  Review answers
                </Button>
              </div>
              {create.isError && <ErrorState error={create.error} />}
            </li>
          )}
        </ol>
        <div ref={bottom} className="h-4 scroll-mb-64 md:scroll-mb-44" />

        {step && current !== null && (
          <div className="bg-background/95 sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-4 border-t px-4 pt-3 pb-4 backdrop-blur sm:-mx-6 sm:px-6 md:bottom-0">
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
                disabled={current === 0}
                className="hover:text-foreground flex h-8 items-center gap-1 rounded-md disabled:opacity-40"
              >
                <CornerUpLeft className="size-3.5" /> Go back
              </button>
              <span className="hidden md:inline">
                {step.kind === 'choice' ? 'Press 1–9 to pick' : 'Press Enter to send'}
              </span>
            </div>
          </div>
        )}
      </section>

      <aside className="hidden lg:block">
        <div className="sticky top-10">{preview(false)}</div>
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
    <div className="bg-surface rounded-2xl border">
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
      <span className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full">
        <Sparkles className="size-4" aria-hidden />
      </span>
      <p className="bg-surface max-w-[min(36rem,85%)] rounded-2xl rounded-tl-md border px-4 py-2.5 text-[15px] leading-relaxed">
        {children}
      </p>
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
        className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring max-w-[80%] rounded-2xl rounded-tr-md px-4 py-2.5 text-left text-[15px] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {text}
      </button>
    </div>
  )
}
