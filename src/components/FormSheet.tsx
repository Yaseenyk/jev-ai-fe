import type { ReactNode } from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Create / edit forms with more than three fields open in a right-side panel (docs/04 §6a):
 * title, one sentence of purpose, titled sections, the save action bottom right.
 */
export function FormSheet({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string
  description?: ReactNode
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px]">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">{children}</div>
        <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
          {footer}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

/** Label above, the control full width, an optional help line under it. */
export function Field({
  id,
  label,
  required,
  help,
  wide,
  children,
}: {
  id: string
  label: string
  required?: boolean
  help?: ReactNode
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={cn('space-y-1.5 [&_button[role=combobox]]:w-full', wide && 'sm:col-span-2')}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            {' '}
            *
          </span>
        )}
      </Label>
      {children}
      {help && <p className="text-muted-foreground text-xs">{help}</p>}
    </div>
  )
}
