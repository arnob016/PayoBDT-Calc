import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  isThemeId,
  readStoredTheme,
  resolveInitialTheme,
  THEMES,
  writeStoredTheme,
  type ThemeId,
} from '../lib/theme'
import { loadThemeFonts } from '../lib/themeFonts'

const safeStorage = () => {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const prefersDark = () => matchMedia('(prefers-color-scheme: dark)').matches

/** Apply a theme to <html>: tokens come from `html[data-theme=...]` in themes.css. */
function applyTheme(id: ThemeId) {
  const root = document.documentElement
  root.dataset.theme = id
  root.classList.toggle('dark', id !== 'light' && id !== 'trainer')
  void loadThemeFonts(id)
  window.dispatchEvent(new Event('themechange'))
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(() => resolveInitialTheme(readStoredTheme(safeStorage()), prefersDark()))
  // Until the user picks a theme explicitly we keep following the OS (light or dark).
  const [manual, setManual] = useState(() => readStoredTheme(safeStorage()) !== null)

  useEffect(() => applyTheme(theme), [theme])

  useEffect(() => {
    if (manual) return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => setTheme(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [manual])

  const choose = useCallback((id: ThemeId) => {
    setTheme(id)
    setManual(true)
    writeStoredTheme(safeStorage(), id)
  }, [])

  return { theme, choose }
}

/** The active theme id, for SVG charts that draw differently per theme. */
export function useThemeId(): ThemeId {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('themechange', cb)
      return () => window.removeEventListener('themechange', cb)
    },
    () => {
      const v = document.documentElement.dataset.theme
      return isThemeId(v) ? v : 'light'
    },
    () => 'light' as ThemeId,
  )
}

export const useChartStyle = () => THEMES[useThemeId()].chart
