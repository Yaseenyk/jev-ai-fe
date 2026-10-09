import { useCallback, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'fitrank:theme'

/** Light / Dark switch. The saved choice (else the system setting) is applied by index.html
 * before first paint, so the page never flashes the wrong theme. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )
  const setTheme = useCallback((next: Theme) => {
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // the switch still works for this visit
    }
    setThemeState(next)
  }, [])
  return { theme, setTheme }
}
