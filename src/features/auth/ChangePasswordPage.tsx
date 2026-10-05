import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'

import { ApiError } from '@/api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/AuthProvider'

const MIN = 10

const schema = z
  .object({
    current: z.string().min(1, 'Enter your current password'),
    next: z.string().min(MIN, `Use at least ${MIN} characters`).max(200),
    repeat: z.string(),
  })
  .refine((v) => v.next === v.repeat, { path: ['repeat'], message: 'The two passwords differ' })
  .refine((v) => v.next !== v.current, {
    path: ['next'],
    message: 'Choose a password different from the current one',
  })
type Values = z.infer<typeof schema>

export default function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth()
  const navigate = useNavigate()
  const [show, setShow] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { current: '', next: '', repeat: '' },
  })
  const forced = user?.must_change_password ?? false
  const errors = form.formState.errors

  const onSubmit = form.handleSubmit(async (v) => {
    setServerError(null)
    try {
      await changePassword(v.current, v.next)
      void navigate('/tasks', { replace: true })
    } catch (err) {
      setServerError(
        err instanceof ApiError && err.status === 422
          ? err.message
          : 'We could not change your password right now. Try again.',
      )
    }
  })

  return (
    <main className="grid min-h-svh place-items-center p-6">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="bg-surface w-full max-w-md space-y-5 rounded-2xl border p-6"
        noValidate
      >
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <KeyRound className="text-primary size-6" aria-hidden />
            {forced ? 'Choose your own password' : 'Change your password'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {forced
              ? 'You signed in with a temporary password from an admin. Choose your own to continue.'
              : 'Other devices signed in with your account will be signed out.'}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="current">{forced ? 'Temporary password' : 'Current password'}</Label>
          <Input
            id="current"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            {...form.register('current')}
          />
          {errors.current && <p className="text-destructive text-sm">{errors.current.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="next">New password</Label>
          <Input
            id="next"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            {...form.register('next')}
          />
          {errors.next ? (
            <p className="text-destructive text-sm">{errors.next.message}</p>
          ) : (
            <p className="text-muted-foreground text-xs">At least {MIN} characters.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="repeat">Repeat the new password</Label>
          <Input
            id="repeat"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            {...form.register('repeat')}
          />
          {errors.repeat && <p className="text-destructive text-sm">{errors.repeat.message}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={show}
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          {show ? 'Hide passwords' : 'Show passwords'}
        </Button>

        {serverError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            Save new password
          </Button>
          <Button type="button" variant="outline" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </form>
    </main>
  )
}
