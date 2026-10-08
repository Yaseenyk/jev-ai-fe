import { Building } from 'lucide-react'

import type { BusinessUnitRef } from '@/api/types'
import { StatusBadge } from '@/components/StatusBadge'
import { useMyUnit } from '@/features/org/api'

/**
 * A person from another business unit: which unit, and whom to ask (ADR 026). Shown only when
 * the unit differs from the signed-in manager's own. Information only: nothing is blocked.
 */
export function UnitBadge({ unit }: { unit?: BusinessUnitRef | null }) {
  const mine = useMyUnit()
  if (!unit || mine.isPending || mine.data?.code === unit.code) return null
  const text = `${unit.code} · ${unit.head_name ? `contact ${unit.head_name}` : 'no head set'}`
  return (
    <StatusBadge tone="info">
      <Building className="size-3" aria-hidden />
      {unit.head_email ? (
        <a
          href={`mailto:${unit.head_email}`}
          className="hover:underline"
          title={`${unit.name} · ${unit.head_email}`}
        >
          {text}
        </a>
      ) : (
        <span title={unit.name}>{text}</span>
      )}
    </StatusBadge>
  )
}
