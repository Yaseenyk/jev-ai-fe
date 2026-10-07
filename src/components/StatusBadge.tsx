import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type Tone = 'ready' | 'attention' | 'info' | 'neutral' | 'danger'

/** Status colours are used only for status (docs/04 §6a). */
const TONES: Record<Tone, string> = {
  ready: 'bg-band-shortlist text-band-shortlist-foreground border-band-shortlist-foreground/20',
  attention: 'bg-band-review text-band-review-foreground border-band-review-foreground/20',
  info: 'bg-primary/10 text-primary border-primary/20',
  neutral: 'bg-muted text-muted-foreground border-border',
  danger: 'bg-destructive/10 text-destructive border-destructive/20',
}

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
