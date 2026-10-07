import { Bell, BellOff } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useNotifications, useReadNotifications } from '@/features/hr/api'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/** In-app notifications for the hiring-request hand-offs (manager ↔ HR). */
export function NotificationsBell() {
  const notifications = useNotifications()
  const read = useReadNotifications()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const items = notifications.data ?? []
  const unread = items.filter((n) => !n.read).length

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring relative grid size-9 shrink-0 place-items-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
          >
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="bg-destructive absolute top-1 right-1 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold text-white">
                {unread}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>
              {unread > 0
                ? `${unread} unread. Hand-offs between managers and HR on hiring requests.`
                : 'Hand-offs between managers and HR on hiring requests.'}
            </SheetDescription>
          </SheetHeader>
          {items.length === 0 ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm">
              <BellOff className="size-6" aria-hidden />
              <p className="text-foreground font-medium">You are all caught up</p>
              <p>When a manager or HR hands a request to you, it shows up here.</p>
            </div>
          ) : (
            <ul className="flex-1 divide-y overflow-y-auto" aria-label="Notifications">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      'hover:bg-muted/60 flex w-full gap-3 px-5 py-3 text-left transition-colors',
                      !n.read && 'bg-accent/40',
                    )}
                    onClick={() => {
                      if (!n.read) read.mutate(n.id)
                      setOpen(false)
                      void navigate(n.link)
                    }}
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        n.read ? 'bg-transparent' : 'bg-primary',
                      )}
                      aria-label={n.read ? undefined : 'unread'}
                    />
                    <span className="min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-muted-foreground text-sm">{n.body}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {dateTime(n.created_at)}
                      </p>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {unread > 0 && (
            <div className="flex justify-end border-t px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => read.mutate(undefined)}>
                Mark all as read
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
