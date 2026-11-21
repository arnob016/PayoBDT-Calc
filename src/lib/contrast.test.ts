import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrast, cvdDistance, MIN_CVD_DELTA_E, runChecks, THEMES_CSS } from '../../scripts/contrast.mjs'
import { THEME_IDS } from './theme'

describe('contrast maths', () => {
  it('matches known WCAG values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2) // the classic AA grey
  })
  it('colour-blind distance is large for green vs red hues that differ in lightness', () => {
    expect(cvdDistance('#047857', '#b91c1c').normal).toBeGreaterThan(50)
  })
})

describe('theme contrast gate (also run by `npm run build`)', () => {
  const css = readFileSync(THEMES_CSS, 'utf8')
  const { rows, failures } = runChecks(css)

  it('all 7 themes pass every text/surface check at WCAG AA', () => {
    expect(failures).toEqual([])
    for (const id of THEME_IDS) expect(rows.filter((r) => r.theme === id).length).toBeGreaterThan(20)
  })

  it('body text, muted text, profit, loss and accent-contrast are each checked at 4.5:1 in every theme', () => {
    for (const id of THEME_IDS) {
      const mine = rows.filter((r) => r.theme === id && !r.cvd)
      for (const name of ['text / surface', 'muted / surface', 'profit / surface', 'loss / surface', 'accent-contrast / accent']) {
        const row = mine.find((r) => r.name === name)
        expect(row, `${id}: ${name}`).toBeDefined()
        expect(row!.min).toBe(4.5)
        expect(row!.ratio).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('profit and loss stay distinguishable under protanopia, deuteranopia and tritanopia', () => {
    for (const r of rows.filter((x) => x.cvd)) expect(r.ratio, `${r.theme} ${r.name}`).toBeGreaterThanOrEqual(MIN_CVD_DELTA_E)
  })

  it('the gate really fails: a washed-out profit colour is reported', () => {
    const bad = css.replace('--profit: #047857;', '--profit: #9ad9c4;')
    const result = runChecks(bad)
    expect(result.failures.some((f) => f.startsWith('light: profit / surface'))).toBe(true)
  })

  it('the gate fails when a theme block is missing', () => {
    const result = runChecks(css.replace(/html\[data-theme="futuristic"\] \{/, 'html[data-theme="futuristic-x"] {'))
    expect(result.failures.some((f) => f.startsWith('futuristic'))).toBe(true)
  })
})
