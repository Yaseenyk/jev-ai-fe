import type { Band } from '@/api/types'
import { BAND_LABELS } from '@/lib/format'
import { cn } from '@/lib/utils'

const STYLE: Record<Band, string> = {
  shortlist: 'bg-band-shortlist text-band-shortlist-foreground',
  review: 'bg-band-review text-band-review-foreground',
  hidden: 'bg-band-hidden text-band-hidden-foreground',
}

export function BandBadge({ band }: { band: Band }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        STYLE[band],
      )}
    >
      {BAND_LABELS[band]}
    </span>
  )
}
