import { memo, useEffect, useState } from 'react'
import type { ThemeMode } from '../state/types'

interface ThemeToggleProps {
  themeMode: ThemeMode
  onToggle: (nextMode: ThemeMode) => void
}

const ThemeToggle = memo(function ThemeToggle({ themeMode, onToggle }: ThemeToggleProps) {
  const [systemIsDark, setSystemIsDark] = useState<boolean>(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    if (themeMode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent): void => setSystemIsDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [themeMode])

  const resolved: 'light' | 'dark' =
    themeMode === 'system'
      ? systemIsDark
        ? 'dark'
        : 'light'
      : (themeMode as 'light' | 'dark')

  const isDark = resolved === 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle-button ${isDark ? 'is-dark' : 'is-light'}`}
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      onClick={() => onToggle(isDark ? 'light' : 'dark')}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
})

export default ThemeToggle
