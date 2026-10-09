import { Moon, Sun } from 'lucide-react'

import { useTheme, type Theme } from '@/lib/theme'
import { cn } from '@/lib/utils'

/** Light / Dark segmented switch (sidebar and sign-in screen). */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const option = (value: Theme, label: string, Icon: typeof Sun) => (
    <button
      type="button"
      onClick={() => setTheme(value)}
      aria-pressed={theme === value}
      className={cn(
        'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
        theme === value
          ? 'bg-surface text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-3.5" aria-hidden /> {label}
    </button>
  )
  return (
    <div
      className={cn('bg-muted flex gap-1 rounded-xl p-1', className)}
      role="group"
      aria-label="Colour theme"
    >
      {option('light', 'Light', Sun)}
      {option('dark', 'Dark', Moon)}
    </div>
  )
}
