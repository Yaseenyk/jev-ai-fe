import { Bell } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useNotifications, useReadNotifications } from '@/features/hr/api'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/** In-app notifications for the hiring-request hand-offs (manager ↔ HR). */
export function NotificationsBell({ compact = false }: { compact?: boolean }) {
  const notifications = useNotifications()
  const read = useReadNotifications()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const items = notifications.data ?? []
  const unread = items.filter((n) => !n.read).length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className={cn(
          'text-muted-foreground hover:bg-muted hover:text-foreground relative grid size-9 shrink-0 place-items-center rounded-lg',
          !compact && 'lg:size-9',
        )}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="bg-destructive absolute top-1 right-1 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
            <DialogDescription>
              Hand-offs between managers and HR on hiring requests.
            </DialogDescription>
          </DialogHeader>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing yet.</p>
          ) : (
            <ul className="-mx-2 max-h-96 overflow-y-auto" aria-label="Notifications">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      'hover:bg-accent/50 w-full rounded-lg px-2 py-2 text-left',
                      !n.read && 'bg-accent/40',
                    )}
                    onClick={() => {
                      if (!n.read) read.mutate(n.id)
                      setOpen(false)
                      void navigate(n.link)
                    }}
                  >
                    <p className="text-sm font-medium">
                      {!n.read && (
                        <span
                          className="bg-primary mr-2 inline-block size-2 rounded-full"
                          aria-label="unread"
                        />
                      )}
                      {n.title}
                    </p>
                    <p className="text-muted-foreground text-sm">{n.body}</p>
                    <p className="text-muted-foreground text-xs">{dateTime(n.created_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={() => read.mutate(undefined)}>
              Mark all as read
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
