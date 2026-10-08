import { Printer } from 'lucide-react'
import { Navigate, useParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import { useClientProfile } from '@/features/planning/insightsApi'
import { domainLabel, locationLabel } from '@/lib/format'

/** A client-ready profile to share or print: no cost, rating, revenue or other clients' names. */
export default function ClientProfilePage() {
  const { employeeId = '' } = useParams()
  const role = useAuth().user?.role
  const profile = useClientProfile(employeeId)
  if (role === 'viewer') return <Navigate to="/tasks" replace />
  if (profile.isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (profile.isError) return <ErrorState error={profile.error} />
  const p = profile.data

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          back={{ to: `/planning/people/${employeeId}`, label: 'Value card' }}
          title="Client profile"
          description="What a client may see. No costs, ratings, revenue or other clients' names."
          actions={
            <Button onClick={() => window.print()}>
              <Printer aria-hidden /> Print or save as PDF
            </Button>
          }
        />
      </div>
      <article
        aria-label={`Profile of ${p.full_name}`}
        className="bg-surface mx-auto max-w-3xl space-y-6 rounded-xl border p-8 print:border-0 print:p-0"
      >
        <header>
          <h2 className="text-2xl font-semibold">{p.full_name}</h2>
          <p className="text-muted-foreground">
            {p.designation} · {p.level_title} · {p.years_experience} years ·{' '}
            {locationLabel(p.location)}
          </p>
        </header>
        <p className="text-sm leading-relaxed">{p.summary}</p>
        <section aria-label="Key skills">
          <h3 className="mb-2 text-sm font-semibold">Key skills</h3>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {p.skills.map((s) => (
              <li key={s.name} className="flex justify-between gap-2">
                <span>{s.name}</span>
                <span className="text-muted-foreground tabular-nums">{s.years} yrs</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-label="Experience">
          <h3 className="mb-2 text-sm font-semibold">Experience</h3>
          <ul className="space-y-3 text-sm">
            {p.experience.map((x, i) => (
              <li key={i}>
                <p className="font-medium">
                  {x.role_title} · {domainLabel(x.domain)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {x.months} months{x.skills.length > 0 && ` · ${x.skills.join(', ')}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  )
}
