import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Gauge,
  Loader2,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'
import { type ComponentType, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'

import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/utils'
import { ThemeSwitch } from '@/components/ThemeSwitch'

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your work email')
    .pipe(z.email('Enter a valid email, like name@company.com')),
  password: z.string().min(1, 'Enter your password'),
})
type Values = z.infer<typeof schema>

const PILOT_ACCOUNTS = [
  { email: 'manager1@srtm.local', role: 'Resource manager' },
  { email: 'hr@srtm.local', role: 'HR' },
  { email: 'admin@srtm.local', role: 'Admin' },
  { email: 'viewer@srtm.local', role: 'Viewer' },
]

const POINTS: { icon: ComponentType<{ className?: string }>; title: string; text: string }[] = [
  {
    icon: ShieldCheck,
    title: 'Rules first',
    text: 'Availability, leave, cost band and client clearance are checked in code, every time.',
  },
  {
    icon: Gauge,
    title: 'Honest scores',
    text: 'Our own model rates each fit with a probability and shows the facts behind it.',
  },
  {
    icon: UserCheck,
    title: 'You decide',
    text: 'Nobody is assigned automatically. Accept or reject, and the model learns from it.',
  },
]

export default function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const nextParam = params.get('next')
  // '/' lets the home redirect pick by role (HR → HR home, others → tasks).
  const next = nextParam?.startsWith('/') ? nextParam : '/'
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  })
  const email = useWatch({ control: form.control, name: 'email' })
  const { errors, isSubmitting } = form.formState

  if (status === 'signedIn') return <Navigate to={next} replace />

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setServerError(null)
    try {
      await login(email, password)
      void navigate(next, { replace: true })
    } catch (err) {
      setServerError(
        err instanceof ApiError && err.status === 401
          ? 'That email and password do not match. Check them and try again.'
          : err instanceof ApiError && err.status === 429
            ? 'Too many failed sign-ins. Wait a few minutes, then try again.'
            : 'We could not sign you in right now. Check your connection and try again.',
      )
      form.setFocus('password')
    }
  })

  return (
    <main className="bg-background grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <BrandPanel />

      <section className="relative flex flex-col justify-center px-5 py-10 sm:px-10">
        <ThemeSwitch className="absolute top-5 right-5 w-48" />
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <span className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-xl">
              <Users className="size-5" aria-hidden />
            </span>
            <span className="font-heading text-lg font-semibold">Resource Matching</span>
          </div>

          <h1 className="font-heading text-[30px] leading-tight font-semibold">Welcome back</h1>
          <p className="text-muted-foreground mt-2 text-[15px]">
            Sign in with your work account to staff open tasks.
          </p>

          {serverError && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/5 text-destructive mt-6 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {serverError}
            </div>
          )}

          <form onSubmit={(e) => void onSubmit(e)} noValidate className="mt-7 space-y-5">
            <Field id="email" label="Work email" error={errors.email?.message}>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                placeholder="name@company.com"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={inputClass(Boolean(errors.email))}
                {...form.register('email')}
              />
            </Field>

            <Field
              id="password"
              label="Password"
              error={errors.password?.message}
              hint={capsLock && !errors.password ? 'Caps Lock is on' : undefined}
            >
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Your password"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={
                    errors.password ? 'password-error' : capsLock ? 'password-hint' : undefined
                  }
                  className={cn(inputClass(Boolean(errors.password)), 'pr-12')}
                  onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                  {...form.register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            <Button
              type="submit"
              size="lg"
              className="h-12 w-full rounded-xl text-[15px]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight />
                </>
              )}
            </Button>
          </form>

          <div className="mt-10">
            <div className="text-muted-foreground flex items-center gap-3 text-xs">
              <span className="bg-border h-px flex-1" />
              Pilot accounts · dummy data
              <span className="bg-border h-px flex-1" />
            </div>
            {/* One row per account: equal heights, full emails, room for more roles. */}
            <ul className="bg-surface mt-4 divide-y overflow-hidden rounded-xl border">
              {PILOT_ACCOUNTS.map((a) => {
                const chosen = email.trim().toLowerCase() === a.email
                return (
                  <li key={a.email}>
                    <button
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => {
                        form.setValue('email', a.email, { shouldValidate: true })
                        form.setFocus('password')
                      }}
                      className={cn(
                        'hover:bg-accent/50 focus-visible:ring-ring flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                        chosen && 'bg-accent/60',
                      )}
                    >
                      <span className="text-sm font-medium">{a.role}</span>
                      <span className="text-muted-foreground ml-auto text-xs">{a.email}</span>
                      <Check
                        className={cn('text-primary size-4 shrink-0', !chosen && 'invisible')}
                        aria-hidden
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="text-muted-foreground mt-3 text-xs">
              Pick one to fill the email. The pilot admin shares the password.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

function inputClass(invalid: boolean) {
  return cn(
    'bg-surface h-12 w-full rounded-xl border px-4 text-[15px] transition-shadow outline-none',
    'placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-primary/15 focus:ring-4',
    invalid && 'border-destructive focus:border-destructive focus:ring-destructive/15',
  )
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-destructive flex items-center gap-1.5 text-xs">
          <AlertCircle className="size-3.5" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-band-review-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function BrandPanel() {
  return (
    <aside className="bg-primary text-primary-foreground relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />
      <div className="relative flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-xl bg-white/15">
          <Users className="size-5" aria-hidden />
        </span>
        <span className="font-heading text-lg font-semibold">Resource Matching</span>
      </div>

      <div className="relative max-w-md">
        <h2 className="font-heading text-[34px] leading-[1.15] font-semibold">
          The right people for every task, with reasons you can check.
        </h2>
        <FunnelPreview />
        <ul className="mt-9 space-y-5">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/12">
                <p.icon className="size-4.5" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{p.title}</span>
                <span className="text-primary-foreground/75 block text-sm leading-relaxed">
                  {p.text}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-primary-foreground/60 relative text-xs">
        Pilot on dummy data. No real employee data is used.
      </p>
    </aside>
  )
}

function FunnelPreview() {
  const rows = [
    { label: 'People considered', value: 300, width: 'w-full' },
    { label: 'Passed the rules', value: 170, width: 'w-[62%]' },
    { label: 'Ranked by the model', value: 30, width: 'w-[30%]' },
    { label: 'Worth a look', value: 2, width: 'w-[12%]' },
  ]
  return (
    <div className="mt-8 rounded-2xl bg-white/10 p-4 backdrop-blur-sm" aria-hidden>
      <p className="text-primary-foreground/70 text-xs font-medium">
        Example run · Senior Azure Data Factory engineer
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3">
            <span className="h-2 flex-1 rounded-full bg-white/10">
              <span className={cn('block h-2 rounded-full bg-white/70', r.width)} />
            </span>
            <span className="w-36 shrink-0 text-xs">
              <span className="font-semibold tabular-nums">{r.value}</span>{' '}
              <span className="text-primary-foreground/75">{r.label}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
