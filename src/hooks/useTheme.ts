import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
const KEY = 'payoneer-theme'

const systemTheme = (): Theme =>
  matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

function initial(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    if (t === 'light' || t === 'dark') return t
  } catch {
    /* ignore */
  }
  return systemTheme()
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial)
  const [manual, setManual] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== null
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Follow the OS until the user picks a theme explicitly.
  useEffect(() => {
    if (manual) return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => setTheme(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [manual])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setManual(true)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* ignore */
    }
  }, [theme])

  return { theme, toggle }
}
