import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

/**
 * Every page starts the same way (docs/04 §6a): optional back link, title (+ status badge),
 * one plain sentence saying what the page is for, and the page's actions on the right.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  status,
  meta,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
  status?: ReactNode
  meta?: ReactNode
}) {
  return (
    <header className="space-y-2">
      {back && (
        <Link
          to={back.to}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-[28px]">
              {title}
            </h1>
            {status}
          </div>
          {meta && <div className="text-muted-foreground text-sm">{meta}</div>}
          {description && <p className="text-muted-foreground max-w-3xl text-sm">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
