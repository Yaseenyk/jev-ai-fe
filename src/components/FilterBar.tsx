import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

/** The toolbar above a list: search left, filters and sort, then the active-filter chips. */
export function FilterBar({
  search,
  filters,
  sort,
  chips,
  onClear,
}: {
  search?: { value: string; onChange: (v: string) => void; placeholder: string; label: string }
  filters?: ReactNode
  sort?: ReactNode
  chips?: { label: string; onRemove: () => void }[]
  onClear?: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {search && (
          <div className="relative w-full sm:w-72">
            <Search
              className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              className="pl-9"
              placeholder={search.placeholder}
              aria-label={search.label}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
            />
          </div>
        )}
        {filters}
        {sort && <div className="ml-auto">{sort}</div>}
      </div>
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {chips.map((c) => (
            <span
              key={c.label}
              className="bg-muted inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs"
            >
              {c.label}
              <button
                type="button"
                onClick={c.onRemove}
                aria-label={`Remove filter ${c.label}`}
                className="hover:bg-background rounded-full p-0.5"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          {onClear && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClear}>
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** A dropdown filter whose first option means "no filter". */
export function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  allLabel: string
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? '' : v)}>
      <SelectTrigger className={cn('w-40', className)} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** "Sort by …" dropdown. */
export function SortSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-56" aria-label="Sort by">
        <span className="text-muted-foreground mr-1">Sort:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Segmented buttons for a status filter (the most-used filter of a list). */
export function Segmented({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; count?: number }[]
}) {
  return (
    <div role="group" aria-label={label} className="bg-muted/60 inline-flex rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1 text-sm whitespace-nowrap transition-colors',
            value === o.value
              ? 'bg-background text-foreground font-medium shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className="text-muted-foreground ml-1.5 tabular-nums">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
