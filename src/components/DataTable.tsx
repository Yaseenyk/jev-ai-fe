import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { EmptyState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Clicking the header sorts by this value (server-side sort key). */
  sortKey?: string
  /** Clicking the header sorts the rows in the browser by this value (a list loaded whole). */
  sortValue?: (row: T) => string | number
  align?: 'left' | 'right'
  className?: string
}

/**
 * The list view for anything longer than about 20 rows (docs/04 §6a): column headers, sortable
 * columns, the whole row opens the item, sticky header. Sorting is on the server (`sortKey` +
 * `onSort`) or, for a list loaded whole, in the browser (`sortValue`); clicking the sorted
 * column again flips the order.
 */
export function DataTable<T>({
  label,
  rows,
  columns,
  rowKey,
  rowHref,
  sort,
  descending,
  onSort,
  empty,
}: {
  label: string
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  rowHref?: (row: T) => string
  sort?: string
  /** With a server sort: the current direction, so the arrow shows it. */
  descending?: boolean
  onSort?: (key: string) => void
  empty: { title: string; body?: ReactNode }
}) {
  const navigate = useNavigate()
  const [local, setLocal] = useState<{ key: string; desc: boolean } | null>(null)
  if (rows.length === 0) return <EmptyState title={empty.title}>{empty.body}</EmptyState>
  const localColumn = local && columns.find((c) => c.key === local.key && c.sortValue)
  const shown =
    localColumn?.sortValue && local
      ? [...rows].sort((a, b) => {
          const x = localColumn.sortValue?.(a) ?? ''
          const y = localColumn.sortValue?.(b) ?? ''
          const order =
            typeof x === 'number' && typeof y === 'number'
              ? x - y
              : String(x).localeCompare(String(y))
          return local.desc ? -order : order
        })
      : rows
  const sortState = (c: Column<T>): 'ascending' | 'descending' | undefined => {
    if (c.sortValue && local?.key === c.key) return local.desc ? 'descending' : 'ascending'
    if (c.sortKey && sort === c.sortKey) return descending ? 'descending' : 'ascending'
    return undefined
  }
  const clickSort = (c: Column<T>) => {
    if (c.sortValue) {
      setLocal((s) => ({ key: c.key, desc: s?.key === c.key ? !s.desc : false }))
    } else if (c.sortKey && onSort) onSort(c.sortKey)
  }
  return (
    <div className="bg-surface overflow-hidden rounded-xl border">
      <Table aria-label={label}>
        <TableHeader className="bg-muted/40 sticky top-0 z-10">
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn(
                  'h-10 text-xs font-medium',
                  c.align === 'right' && 'text-right',
                  c.className,
                )}
                aria-sort={sortState(c)}
              >
                {c.sortValue || (c.sortKey && onSort) ? (
                  <button
                    type="button"
                    onClick={() => clickSort(c)}
                    title={`Sort by ${c.header.toLowerCase()}`}
                    className="hover:text-foreground inline-flex items-center gap-1"
                  >
                    {c.header}
                    {sortState(c) === 'descending' ? (
                      <ArrowDown className="size-3.5" aria-hidden />
                    ) : sortState(c) === 'ascending' ? (
                      <ArrowUp className="size-3.5" aria-hidden />
                    ) : (
                      <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />
                    )}
                  </button>
                ) : (
                  c.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((row) => {
            const href = rowHref?.(row)
            return (
              <TableRow
                key={rowKey(row)}
                className={cn(href && 'cursor-pointer')}
                onClick={href ? () => void navigate(href) : undefined}
              >
                {columns.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn(
                      'py-2.5 align-top',
                      c.align === 'right' && 'text-right tabular-nums',
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export const PAGE_SIZES = [25, 50, 100]

/** "Showing 51–100 of 720", page size and previous / next. Never a silent partial list. */
export function Pagination({
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
  noun = 'items',
}: {
  total: number
  page: number
  pageSize: number
  onPage: (page: number) => void
  onPageSize: (size: number) => void
  noun?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav
      aria-label="Pages"
      className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <span>
        Showing {from}–{to} of {total} {noun}
      </span>
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline">Rows per page</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
          <SelectTrigger className="h-8 w-20" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="tabular-nums">
          Page {page} of {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
