/**
 * Theme registry + persistence rules. Pure (no React, no DOM) so it can be unit-tested.
 * The colour tokens themselves live in src/themes.css; `swatch` here must match them
 * (a test enforces it), and index.html carries a copy of the id list (a test enforces that too).
 */

export const THEME_IDS = [
  'light',
  'dark',
  'adventure',
  'trainer',
  'cinematic',
  'trading',
  'futuristic',
] as const

export type ThemeId = (typeof THEME_IDS)[number]

/** How the SVG charts draw in a theme. Colours always come from CSS tokens. */
export interface ChartStyle {
  /** step-after line instead of a smooth one */
  stepped: boolean
  /** square markers instead of circles */
  square: boolean
  /** extra vertical/horizontal grid lines */
  fineGrid: boolean
  /** horizontal crosshair line that follows the pointer */
  crosshair: boolean
}

export interface ThemeMeta {
  id: ThemeId
  name: string
  /** [surface, accent, profit]: the three dots shown in the picker */
  swatch: [string, string, string]
  chart: ChartStyle
}

const smooth: ChartStyle = { stepped: false, square: false, fineGrid: false, crosshair: false }

export const THEMES: Record<ThemeId, ThemeMeta> = {
  light: { id: 'light', name: 'Light', swatch: ['#ffffff', '#4f46e5', '#047857'], chart: smooth },
  dark: { id: 'dark', name: 'Dark', swatch: ['#0f172a', '#5558ee', '#34d399'], chart: smooth },
  adventure: {
    id: 'adventure',
    name: 'Adventure',
    swatch: ['#f2e2b0', '#f4b400', '#0b6148'],
    chart: { stepped: true, square: true, fineGrid: false, crosshair: false },
  },
  trainer: { id: 'trainer', name: 'Trainer', swatch: ['#ffffff', '#d02c08', '#0b7d6b'], chart: smooth },
  cinematic: { id: 'cinematic', name: 'Cinematic', swatch: ['#15151a', '#c9a24a', '#3ecfb2'], chart: smooth },
  trading: {
    id: 'trading',
    name: 'Trading',
    swatch: ['#131c2a', '#f0b90b', '#1fbf92'],
    chart: { stepped: false, square: false, fineGrid: true, crosshair: true },
  },
  futuristic: { id: 'futuristic', name: 'Futuristic', swatch: ['#0b1224', '#22d3ee', '#7af7dc'], chart: smooth },
}

export const THEME_LIST: ThemeMeta[] = THEME_IDS.map((id) => THEMES[id])

export const THEME_STORAGE_KEY = 'payoneer-theme'

export const isThemeId = (v: unknown): v is ThemeId =>
  typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v)

/** Stored value if it is a known theme, otherwise the OS preference (light or dark). */
export function resolveInitialTheme(stored: unknown, prefersDark: boolean): ThemeId {
  if (isThemeId(stored)) return stored
  return prefersDark ? 'dark' : 'light'
}

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'>

/** The saved theme, or null when nothing valid is saved (first visit, corrupt value, storage blocked). */
export function readStoredTheme(storage: ReadableStorage | undefined): ThemeId | null {
  try {
    const v = storage?.getItem(THEME_STORAGE_KEY)
    return isThemeId(v) ? v : null
  } catch {
    return null
  }
}

export function writeStoredTheme(storage: WritableStorage | undefined, id: ThemeId): boolean {
  try {
    storage?.setItem(THEME_STORAGE_KEY, id)
    return storage !== undefined
  } catch {
    return false
  }
}
