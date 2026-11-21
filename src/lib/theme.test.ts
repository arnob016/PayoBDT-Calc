import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseThemes, THEMES_CSS } from '../../scripts/contrast.mjs'
import {
  isThemeId,
  readStoredTheme,
  resolveInitialTheme,
  THEME_IDS,
  THEME_LIST,
  THEME_STORAGE_KEY,
  THEMES,
  writeStoredTheme,
} from './theme'

/** Minimal Storage stand-in. `reload()` keeps the data, like a real page reload does. */
const fakeStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

describe('theme registry', () => {
  it('has the 7 themes: 2 standard + 5 styled', () => {
    expect(THEME_IDS).toEqual(['light', 'dark', 'adventure', 'trainer', 'cinematic', 'trading', 'futuristic'])
    expect(THEME_LIST.map((t) => t.name)).toEqual([
      'Light', 'Dark', 'Adventure', 'Trainer', 'Cinematic', 'Trading', 'Futuristic',
    ])
  })

  it('isThemeId only accepts known ids', () => {
    for (const id of THEME_IDS) expect(isThemeId(id)).toBe(true)
    for (const bad of ['', 'neon', 'DARK', 'dark ', null, undefined, 3, {}, ['dark']]) expect(isThemeId(bad)).toBe(false)
  })

  it('the inline script in index.html lists exactly the same ids (no flash for any theme)', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    const list = html.match(/var IDS = \[([^\]]+)\]/)?.[1] ?? ''
    expect([...list.matchAll(/'([a-z]+)'/g)].map((m) => m[1])).toEqual([...THEME_IDS])
    expect(html).toContain("setAttribute('data-theme'")
    expect(html).toContain(THEME_STORAGE_KEY)
  })

  it('every theme has a token block, and the picker swatch matches its real colours', () => {
    const css = parseThemes(readFileSync(THEMES_CSS, 'utf8'))
    for (const id of THEME_IDS) {
      expect(css[id], `${id} block in themes.css`).toBeDefined()
      const tokens = { ...css.light, ...css[id] }
      const [surface, accent, profit] = THEMES[id].swatch
      expect(tokens['--surface'], `${id} surface`).toBe(surface)
      expect(tokens['--accent'], `${id} accent`).toBe(accent)
      expect(tokens['--profit'], `${id} profit`).toBe(profit)
    }
  })
})

describe('theme persistence', () => {
  it('persists across reloads', () => {
    const storage = fakeStorage()
    expect(readStoredTheme(storage)).toBeNull() // first visit

    expect(writeStoredTheme(storage, 'cinematic')).toBe(true)
    // "reload": a fresh read of the same storage, resolved the way the app does at startup
    const afterReload = resolveInitialTheme(readStoredTheme(storage), false)
    expect(afterReload).toBe('cinematic')
    // and it wins over the OS preference
    expect(resolveInitialTheme(readStoredTheme(storage), true)).toBe('cinematic')

    writeStoredTheme(storage, 'futuristic')
    expect(readStoredTheme(storage)).toBe('futuristic')
  })

  it('every theme id survives a write/read round trip', () => {
    for (const id of THEME_IDS) {
      const storage = fakeStorage()
      writeStoredTheme(storage, id)
      expect(readStoredTheme(storage)).toBe(id)
    }
  })

  it('first visit follows the OS preference (light or dark)', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark')
    expect(resolveInitialTheme(null, false)).toBe('light')
    expect(resolveInitialTheme(readStoredTheme(fakeStorage()), true)).toBe('dark')
    expect(resolveInitialTheme(readStoredTheme(fakeStorage()), false)).toBe('light')
  })

  it('an invalid stored value falls back safely to the OS preference', () => {
    for (const bad of ['neon', '', 'LIGHT', 'undefined', '{"theme":"dark"}', '0']) {
      const storage = fakeStorage({ [THEME_STORAGE_KEY]: bad })
      expect(readStoredTheme(storage)).toBeNull()
      expect(resolveInitialTheme(readStoredTheme(storage), true)).toBe('dark')
      expect(resolveInitialTheme(readStoredTheme(storage), false)).toBe('light')
    }
  })

  it('blocked or throwing storage never crashes', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
    }
    expect(readStoredTheme(throwing)).toBeNull()
    expect(writeStoredTheme(throwing, 'dark')).toBe(false)
    expect(readStoredTheme(undefined)).toBeNull()
    expect(writeStoredTheme(undefined, 'dark')).toBe(false)
  })

  it('keeps the existing storage key, so saved Light/Dark choices still work', () => {
    expect(THEME_STORAGE_KEY).toBe('payoneer-theme')
    expect(readStoredTheme(fakeStorage({ 'payoneer-theme': 'dark' }))).toBe('dark')
    expect(readStoredTheme(fakeStorage({ 'payoneer-theme': 'light' }))).toBe('light')
  })
})
