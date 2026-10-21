import {
  ArrowUp,
  Check,
  ClipboardList,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import type { Client, InterpretResponse, Skill, Task } from '@/api/types'
import { ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import { FeedbackPrompt } from '@/components/FeedbackPrompt'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useClients } from '@/features/clients/api'
import { ChoiceAnswer, SkillsAnswer, TextAnswer } from '@/features/newTask/ChatInputs'
import {
  useCreateTask,
  useInterpret,
  useInterpretFile,
  useSkills,
  useStartMatch,
  useUpdateTask,
} from '@/features/newTask/api'
import {
  type Draft,
  FIELD_LABELS,
  STAGES,
  type Step,
  applyAnswer,
  fromClient,
  fromInterpretation,
  fromTask,
  isAnswered,
  nextQuestion,
  questionsLeft,
  steps as buildSteps,
  toTaskCreate,
  withDefaults,
} from '@/features/newTask/script'
import { useTask } from '@/features/tasks/api'
import { date } from '@/lib/format'
import { cn } from '@/lib/utils'
import { showBilling } from '@/lib/features'

const DRAFT_KEY = 'srtm:new-task-draft'
const FILE_TYPES = '.pdf,.docx,.png,.jpg,.jpeg,.webp'

/** What the manager gave: a document or typed text. */
type Source = { kind: 'file'; name: string } | { kind: 'text'; text: string }

interface Saved {
  draft: Draft
  current: number | null
  source: Source
  asked: (keyof Draft)[]
  prefilled: (keyof Draft)[]
  defaulted: (keyof Draft)[]
}

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    const saved = raw ? (JSON.parse(raw) as Partial<Saved>) : null
    // Drafts from the older step-by-step chat have no `asked` list; start fresh.
    return saved?.asked && saved.source ? (saved as Saved) : null
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
  const { taskId } = useParams()
  const clients = useClients()
  const skills = useSkills()
  const editing = useTask(taskId ?? '', Boolean(taskId))

  if (clients.isPending || skills.isPending || (taskId && editing.isPending)) {
    return <Skeleton className="h-96 w-full rounded-2xl" />
  }
  if (clients.isError) return <ErrorState error={clients.error} />
  if (skills.isError) return <ErrorState error={skills.error} />
  if (taskId && editing.isError) return <ErrorState error={editing.error} />

  const task = taskId ? editing.data : undefined
  const active = clients.data.filter((c) => c.is_active || c.code === task?.client_code)
  return <Chat key={task?.id ?? 'new'} clients={active} skills={skills.data} editing={task} />
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

/** The details on the ready card; the rest are under "All details". */
const KEY_FIELDS: (keyof Draft)[] = [
  'title',
  'client_code',
  'must_skills',
  'required_level',
  'start_date',
  'duration_weeks',
  'work_mode',
  'location',
]

function Chat({
  clients,
  skills,
  editing,
}: {
  clients: Client[]
  skills: Skill[]
  editing?: Task
}) {
  const navigate = useNavigate()
  const create = useCreateTask()
  const update = useUpdateTask(editing?.id ?? '')
  const startMatch = useStartMatch()
  const interpret = useInterpret()
  const interpretFile = useInterpretFile()
  const codes = useMemo(() => clients.map((c) => c.code).sort(), [clients])
  const all = useMemo(() => buildSteps(codes), [codes])
  const [today] = useState(() => new Date())
  const [initial] = useState(() => (editing ? null : loadSaved()))
  const [draft, setDraft] = useState<Draft>(() =>
    editing ? fromTask(editing) : (initial?.draft ?? {}),
  )
  const [current, setCurrent] = useState<number | null>(initial?.current ?? null)
  const [source, setSource] = useState<Source | null>(initial?.source ?? null)
  const [asked, setAsked] = useState<(keyof Draft)[]>(initial?.asked ?? [])
  const [prefilled, setPrefilled] = useState<(keyof Draft)[]>(initial?.prefilled ?? [])
  const [defaulted, setDefaulted] = useState<(keyof Draft)[]>(initial?.defaulted ?? [])
  const [read, setRead] = useState<InterpretResponse | null>(null)
  const [intakeNote, setIntakeNote] = useState<string | null>(null)
  const [restored, setRestored] = useState(initial !== null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [composerText, setComposerText] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  const byId = useMemo(() => new Map(skills.map((s) => [s.id, s.name])), [skills])
  const skillName = (id: string) => byId.get(id) ?? id
  const describe = (s: Step) => answerText(s, draft, skillName, today)
  const reading = interpret.isPending || interpretFile.isPending
  const started = Boolean(editing) || source !== null
  const step = current !== null ? all[current] : undefined
  const queued = nextQuestion(all, draft, asked.length)
  const ready = started && !reading && current === null

  useEffect(() => {
    if (!editing && source) save({ draft, current, source, asked, prefilled, defaulted })
  }, [editing, draft, current, source, asked, prefilled, defaulted])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [current, draft, reading])

  /** Ask the next question, or fill the rest with defaults once enough has been asked. */
  const advance = (d: Draft, askedNow: (keyof Draft)[]) => {
    const next = nextQuestion(all, d, askedNow.length)
    if (next === null) {
      const full = withDefaults(d, today)
      const added = (Object.keys(full) as (keyof Draft)[]).filter((k) => !isAnswered(d, k))
      setDefaulted((prev) => [...prev, ...added])
      setDraft(full)
    } else {
      setDraft(d)
    }
    setCurrent(next)
  }

  const begin = (d: Draft, r: InterpretResponse | null, note: string | null) => {
    const withClient = fromClient(d, clients)
    setRead(r)
    setIntakeNote(note)
    setPrefilled(Object.keys(withClient) as (keyof Draft)[])
    setAsked([])
    setDefaulted([])
    advance(withClient, [])
  }

  const handlers = {
    onSuccess: (r: InterpretResponse) => {
      const d = fromInterpretation(r, codes, today)
      const nothing = Object.keys(d).length === 0
      begin(
        d,
        nothing ? null : r,
        nothing ? "I couldn't find the role's details in that, so a few quick questions." : null,
      )
    },
    onError: () => begin({}, null, "I couldn't read that just now, so a few quick questions."),
  }

  const sendText = (text: string) => {
    setSource({ kind: 'text', text })
    setRestored(false)
    interpret.mutate({ text, known_clients: codes }, handlers)
  }

  const sendFile = (file: File) => {
    setSource({ kind: 'file', name: file.name })
    setRestored(false)
    interpretFile.mutate(file, handlers)
  }

  const answer = (index: number, value: string | string[]) => {
    const s = all[index]
    if (!s) return
    // Only the queued question counts towards the limit; changing an answer does not.
    const askedNow = index === queued ? [...asked, s.id] : asked
    setAsked(askedNow)
    setDefaulted((prev) => prev.filter((k) => k !== s.id))
    advance(fromClient(applyAnswer(draft, s.id, value), clients), askedNow)
  }

  const startOver = () => {
    if (editing) {
      setDraft(fromTask(editing))
      setCurrent(null)
      return
    }
    setDraft({})
    setCurrent(null)
    setSource(null)
    setAsked([])
    setPrefilled([])
    setDefaulted([])
    setRead(null)
    setIntakeNote(null)
    setRestored(false)
    setComposerText('')
    interpret.reset()
    interpretFile.reset()
    save(null)
  }

  const finish = () => {
    const body = toTaskCreate(draft)
    if (editing) {
      update.mutate(body, { onSuccess: (t) => void navigate(`/tasks/${t.id}`) })
      return
    }
    create.mutate(body, {
      onSuccess: (t) => {
        save(null)
        startMatch.mutate(t.id, {
          onSuccess: (run) => void navigate(`/runs/${run.run_id}`),
          // The task is saved either way; a refused run (budget, rate limit) can start from there.
          onError: () => void navigate(`/tasks/${t.id}`),
        })
      },
    })
  }

  const left = questionsLeft(all, draft, asked.length)
  const busy = create.isPending || update.isPending || startMatch.isPending

  return (
    <div className="-mb-10 flex h-[calc(100svh-10.5rem)] lg:-mb-8 lg:h-[calc(100svh-7.25rem)]">
      <section
        aria-label="New task conversation"
        className="bg-surface relative mx-auto flex min-h-0 w-full max-w-4xl min-w-0 flex-col overflow-hidden rounded-3xl border"
      >
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="font-heading truncate text-lg leading-tight font-semibold">
                {editing ? `Edit ${editing.code}` : 'New task'}
              </h1>
              <p className="text-muted-foreground hidden truncate text-xs sm:block">
                Upload the requirement, answer a few questions, get matches
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            {started && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-full"
                onClick={() => setDetailsOpen(true)}
              >
                <ClipboardList /> All details
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-9 rounded-full" onClick={startOver}>
              <RotateCcw /> <span className="hidden sm:inline">Start over</span>
            </Button>
          </div>
        </header>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-6 sm:px-6">
            {!started ? (
              <UploadStart onFile={sendFile} />
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
                  {editing && (
                    <li>
                      <BotMessage>
                        You're editing {editing.code}. Change any detail below, then save.
                      </BotMessage>
                    </li>
                  )}
                  {source && (
                    <li className="space-y-6">
                      {source.kind === 'file' ? (
                        <UserFile name={source.name} />
                      ) : (
                        <UserText text={source.text} />
                      )}
                      {reading && (
                        <BotMessage>
                          <span className="sr-only">Reading it…</span>
                          <TypingDots />
                        </BotMessage>
                      )}
                      {!reading && read && (
                        <ReadCard
                          steps={all}
                          draft={draft}
                          fields={prefilled}
                          r={read}
                          describe={describe}
                          left={left}
                        />
                      )}
                    </li>
                  )}
                  {intakeNote && !reading && (
                    <li>
                      <BotMessage>{intakeNote}</BotMessage>
                    </li>
                  )}
                  {!reading &&
                    asked.map((id) => {
                      const i = all.findIndex((s) => s.id === id)
                      const s = all[i]
                      if (!s || i === current) return null
                      return (
                        <li key={id} className="space-y-3">
                          <BotMessage>{s.prompt(draft)}</BotMessage>
                          <UserAnswer
                            label={FIELD_LABELS[id]}
                            text={describe(s)}
                            onEdit={() => setCurrent(i)}
                          />
                        </li>
                      )
                    })}
                  {!reading && step && (
                    <li>
                      <BotMessage>
                        <span className="text-muted-foreground block text-xs">
                          {current === queued
                            ? `Question ${asked.length + 1} of ${asked.length + left}`
                            : `Changing ${FIELD_LABELS[step.id]}`}
                        </span>
                        {step.prompt(draft)}
                      </BotMessage>
                    </li>
                  )}
                  {ready && (
                    <li className="space-y-3">
                      <BotMessage>
                        {editing
                          ? 'Change anything you like, then save. Run matching again to see who fits now.'
                          : "That's all I need. Check the details, then find people."}
                      </BotMessage>
                      <ReadyCard
                        steps={all}
                        draft={draft}
                        describe={describe}
                        defaulted={editing ? [] : defaulted}
                        onEdit={setCurrent}
                        onAll={() => setDetailsOpen(true)}
                      />
                      <div className="flex flex-wrap gap-2 pl-11">
                        <Button
                          size="lg"
                          className="h-11 rounded-full px-5"
                          disabled={busy}
                          onClick={finish}
                        >
                          {busy ? <Loader2 className="animate-spin" /> : <Check />}
                          {editing ? 'Save changes' : 'Find people'}
                        </Button>
                      </div>
                      {create.isError && <ErrorState error={create.error} />}
                      {update.isError && <ErrorState error={update.error} />}
                      {read && (
                        <FeedbackPrompt
                          area="task_intake"
                          question="Did we read the requirement correctly?"
                          className="pl-11"
                        />
                      )}
                    </li>
                  )}
                </ol>
              </>
            )}
          </div>
        </div>

        <footer className="bg-surface border-t px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <div className="mx-auto max-w-2xl">
            {!started && (
              <TextComposer
                value={composerText}
                onChange={setComposerText}
                onSend={sendText}
                onFile={sendFile}
              />
            )}
            {!reading && step && current !== null && (
              <StepInput
                key={step.id}
                step={step}
                draft={draft}
                skills={skills}
                today={today}
                onAnswer={(v) => answer(current, v)}
              />
            )}
          </div>
        </footer>
      </section>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All details</DialogTitle>
            <DialogDescription>Click any detail to change it.</DialogDescription>
          </DialogHeader>
          {detailsOpen && (
            <TaskPreview
              showTitle={false}
              steps={all}
              draft={draft}
              current={current}
              describe={describe}
              onEdit={(i) => {
                setCurrent(i)
                setDetailsOpen(false)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UploadStart({ onFile }: { onFile: (file: File) => void }) {
  const [over, setOver] = useState(false)
  return (
    <div className="my-auto py-6">
      <h2 className="font-heading text-[26px] leading-tight font-semibold sm:text-[32px]">
        Upload the job description
      </h2>
      <p className="text-muted-foreground mt-2 max-w-lg text-[15px]">
        The JD or the client's requirement, as you received it. I'll pick out the details, ask only
        what's missing (five questions at most), then find the best people.
      </p>
      <label
        htmlFor="jd-file"
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const file = e.dataTransfer.files[0]
          if (file) onFile(file)
        }}
        className={cn(
          'hover:border-primary/50 hover:bg-accent/40 mt-7 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors',
          over && 'border-primary bg-accent/50',
        )}
      >
        <Upload className="text-primary size-8" aria-hidden />
        <span className="font-medium">Drop the file here, or click to choose</span>
        <span className="text-muted-foreground text-xs">
          PDF, Word (.docx), PNG or JPG, up to 5 MB. Pictures and scans go to ChatGPT as they are.
        </span>
      </label>
      <input
        id="jd-file"
        type="file"
        accept={FILE_TYPES}
        className="sr-only"
        aria-label="Job description file"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
        }}
      />
    </div>
  )
}

function TextComposer({
  value,
  onChange,
  onSend,
  onFile,
}: {
  value: string
  onChange: (text: string) => void
  onSend: (text: string) => void
  onFile: (file: File) => void
}) {
  const ok = value.trim().length >= 3
  const submit = () => {
    if (ok) onSend(value.trim())
  }
  return (
    <div className="bg-background focus-within:border-primary/50 focus-within:ring-primary/15 rounded-3xl border shadow-sm transition-shadow focus-within:ring-4">
      <Textarea
        aria-label="Describe the role"
        rows={1}
        maxLength={2000}
        placeholder="Or paste the requirement here…"
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
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-8 rounded-full"
        >
          <label htmlFor="jd-file-attach" className="cursor-pointer">
            <Paperclip /> Attach a file
          </label>
        </Button>
        <input
          id="jd-file-attach"
          type="file"
          accept={FILE_TYPES}
          className="sr-only"
          aria-label="Attach a job description file"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
          }}
        />
        <Button
          aria-label="Send description"
          size="icon"
          className="size-9 shrink-0 rounded-full"
          disabled={!ok}
          onClick={submit}
        >
          <ArrowUp />
        </Button>
      </div>
    </div>
  )
}

function ReadCard({
  steps,
  draft,
  fields,
  r,
  describe,
  left,
}: {
  steps: Step[]
  draft: Draft
  fields: (keyof Draft)[]
  r: InterpretResponse
  describe: (s: Step) => string
  left: number
}) {
  const found = steps.filter((s) => fields.includes(s.id) && isAnswered(draft, s.id))
  return (
    <div className="space-y-3">
      <BotMessage>
        I found {found.length} {found.length === 1 ? 'detail' : 'details'}.{' '}
        {left === 0
          ? 'Nothing else to ask.'
          : `${left} quick ${left === 1 ? 'question' : 'questions'} for what's missing.`}
      </BotMessage>
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
            Not in the skills list: {r.unmatched_skills.join(', ')}. Add the closest skills under
            All details if they matter.
          </p>
        )}
        {r.notes.map((n) => (
          <p key={n} className="text-muted-foreground text-sm">
            {n}
          </p>
        ))}
      </div>
    </div>
  )
}

function ReadyCard({
  steps,
  draft,
  describe,
  defaulted,
  onEdit,
  onAll,
}: {
  steps: Step[]
  draft: Draft
  describe: (s: Step) => string
  defaulted: (keyof Draft)[]
  onEdit: (index: number) => void
  onAll: () => void
}) {
  return (
    <div className="bg-surface ml-11 rounded-2xl border p-2">
      <ul>
        {KEY_FIELDS.map((field) => {
          const i = steps.findIndex((s) => s.id === field)
          const s = steps[i]
          if (!s || s.skip?.(draft)) return null
          return (
            <li key={field}>
              <button
                type="button"
                aria-label={`Edit ${FIELD_LABELS[field]}`}
                onClick={() => onEdit(i)}
                className="hover:bg-muted flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm"
              >
                <span className="text-muted-foreground shrink-0">{FIELD_LABELS[field]}</span>
                <span className="min-w-0 truncate text-right font-medium">
                  {describe(s)}
                  {defaulted.includes(field) && (
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                      default
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t px-2 pt-2 pb-1">
        <span className="text-muted-foreground text-xs">
          {defaulted.length > 0
            ? `${defaulted.length} details set by default. Change any of them if needed.`
            : 'Every detail came from you.'}
        </span>
        <Button variant="link" size="sm" className="h-7 shrink-0 px-0" onClick={onAll}>
          All details
        </Button>
      </div>
    </div>
  )
}

function UserFile({ name }: { name: string }) {
  return (
    <div className="flex justify-end">
      <p className="bg-muted flex max-w-[85%] items-center gap-2 rounded-3xl rounded-tr-lg px-4 py-2.5 text-[15px]">
        <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <span className="truncate">{name}</span>
      </p>
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

function UserText({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="bg-muted max-w-[85%] rounded-3xl rounded-tr-lg px-4 py-2.5 text-[15px] whitespace-pre-wrap">
        {text}
      </p>
    </div>
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
                if (field === 'max_cost_band' && !showBilling()) return null
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
