// WCAG contrast check for every theme in src/themes.css.
//   node scripts/contrast.mjs          prints a report, exits 1 if anything fails (used by `npm run build`)
// The same functions are imported by src/lib/contrast.test.ts.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
export const THEMES_CSS = resolve(here, '../src/themes.css')

export const THEME_IDS = ['light', 'dark', 'adventure', 'trainer', 'cinematic', 'trading', 'futuristic']

/* ---------- parsing ---------- */

/** { themeId: { tokenName: value } } from the `html[data-theme="x"] { --token: value }` blocks. */
export function parseThemes(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const themes = {}
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(clean))) {
    const selector = m[1].trim().replace(/\s+/g, ' ')
    const hit =
      selector === ':root, html[data-theme="light"]'
        ? 'light'
        : (selector.match(/^html\[data-theme="([a-z]+)"\]$/) || [])[1]
    if (!hit) continue
    themes[hit] ??= {}
    for (const d of m[2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) themes[hit][d[1]] = d[2].trim()
  }
  // `:root` defaults that a theme may rely on (page-ink falls back to text, etc.)
  return themes
}

const resolveToken = (tokens, name, depth = 0) => {
  let v = tokens[name]
  if (v === undefined || depth > 5) return undefined
  const ref = v.match(/^var\((--[a-z0-9-]+)\)$/)
  return ref ? resolveToken(tokens, ref[1], depth + 1) : v
}

/* ---------- colour maths ---------- */

export const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`not a 6-digit hex colour: ${hex}`)
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
const lin = (c) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
export const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
/** sRGB mix: `pct` percent of a over b (close enough to CSS color-mix for a pass/fail gate). */
export const mix = (a, b, pct) => {
  const [ra, rb] = [hexToRgb(a), hexToRgb(b)]
  return '#' + ra.map((v, i) => Math.round(v * (pct / 100) + rb[i] * (1 - pct / 100)).toString(16).padStart(2, '0')).join('')
}

/* ---------- colour-blindness (Machado et al. 2009, severity 1.0) ---------- */
const CVD = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
}
const toLab = ([r, g, b]) => {
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}
const simulate = (hex, m) => {
  const v = hexToRgb(hex).map(lin)
  return m.map((row) => Math.min(1, Math.max(0, row[0] * v[0] + row[1] * v[1] + row[2] * v[2])))
}
const deltaE = (l1, l2) => Math.hypot(l1[0] - l2[0], l1[1] - l2[1], l1[2] - l2[2])
const labOf = (hex) => toLab(hexToRgb(hex).map(lin))

/** Perceptual distance between two colours as seen with each kind of colour blindness. */
export function cvdDistance(a, b) {
  const out = { normal: deltaE(labOf(a), labOf(b)) }
  for (const [name, m] of Object.entries(CVD)) out[name] = deltaE(toLab(simulate(a, m)), toLab(simulate(b, m)))
  return out
}

/* ---------- the checks ---------- */

const AA = 4.5
const LARGE = 3

/** Every text/surface pair the UI actually uses, per theme. */
export function checksFor(t) {
  const get = (n) => {
    const v = resolveToken(t, n)
    if (!v) throw new Error(`missing token ${n}`)
    return v
  }
  const pageInk = resolveToken(t, '--page-ink') ?? get('--text')
  const pageMuted = resolveToken(t, '--page-muted') ?? get('--text-muted')
  const heroGlow = (glow, surface) => mix(glow, surface, 30) // the hero card's glow overlay, worst case

  return [
    ['text / surface', get('--text'), get('--surface'), AA],
    ['text / surface-2', get('--text'), get('--surface-2'), AA],
    ['muted / surface', get('--text-muted'), get('--surface'), AA],
    ['muted / surface-2', get('--text-muted'), get('--surface-2'), AA],
    ['page text / bg', pageInk, get('--bg'), AA],
    ['page muted / bg', pageMuted, get('--bg'), AA],
    ['profit / surface', get('--profit'), get('--surface'), AA],
    ['profit / surface-2', get('--profit'), get('--surface-2'), AA],
    ['profit / profit-soft', get('--profit'), get('--profit-soft'), AA],
    ['loss / surface', get('--loss'), get('--surface'), AA],
    ['loss / surface-2', get('--loss'), get('--surface-2'), AA],
    ['loss / loss-soft', get('--loss'), get('--loss-soft'), AA],
    ['accent-contrast / accent', get('--accent-contrast'), get('--accent'), AA],
    ['accent-ink / surface', get('--accent-ink'), get('--surface'), AA],
    ['accent-ink / surface-2', get('--accent-ink'), get('--surface-2'), AA],
    ['accent-ink / accent-soft', get('--accent-ink'), get('--accent-soft'), AA],
    ['warning / surface', get('--warning'), get('--surface'), AA],
    ['hero number: profit / glow (large)', get('--profit'), heroGlow(get('--profit-glow'), get('--surface')), LARGE],
    ['hero number: loss / glow (large)', get('--loss'), heroGlow(get('--loss-glow'), get('--surface')), LARGE],
    ['focus ring / surface (UI)', get('--focus-ring'), get('--surface'), LARGE],
    ['focus ring / bg (UI)', get('--focus-ring'), get('--bg'), LARGE],
    ['chart line / surface (UI)', get('--chart-line'), get('--surface'), LARGE],
  ]
}

/** profit vs loss must stay apart under the common colour-vision deficiencies. */
export const MIN_CVD_DELTA_E = 18

export function runChecks(css = readFileSync(THEMES_CSS, 'utf8')) {
  const themes = parseThemes(css)
  const rows = []
  const failures = []
  for (const id of THEME_IDS) {
    const tokens = { ...(themes.light ?? {}), ...(themes[id] ?? {}) }
    if (!themes[id]) {
      failures.push(`${id}: theme block missing in themes.css`)
      continue
    }
    for (const [name, fg, bg, min] of checksFor(tokens)) {
      const ratio = contrast(fg, bg)
      const ok = ratio >= min
      rows.push({ theme: id, name, fg, bg, ratio, min, ok })
      if (!ok) failures.push(`${id}: ${name} = ${ratio.toFixed(2)}:1 (needs ${min}:1)  [${fg} on ${bg}]`)
    }
    const profit = resolveToken(tokens, '--profit')
    const loss = resolveToken(tokens, '--loss')
    const d = cvdDistance(profit, loss)
    for (const [kind, value] of Object.entries(d)) {
      const ok = value >= MIN_CVD_DELTA_E
      rows.push({ theme: id, name: `profit vs loss (${kind}, ΔE)`, fg: profit, bg: loss, ratio: value, min: MIN_CVD_DELTA_E, ok, cvd: true })
      if (!ok) failures.push(`${id}: profit vs loss looks too similar for ${kind} (ΔE ${value.toFixed(1)}, needs ${MIN_CVD_DELTA_E})`)
    }
  }
  return { themes, rows, failures }
}

/* ---------- CLI ---------- */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { rows, failures } = runChecks()
  let last = ''
  for (const r of rows) {
    if (r.theme !== last) {
      console.log(`\n${r.theme}`)
      last = r.theme
    }
    const val = r.cvd ? `ΔE ${r.ratio.toFixed(1)}` : `${r.ratio.toFixed(2)}:1`
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name.padEnd(38)} ${val.padStart(9)}  (min ${r.min})`)
  }
  if (failures.length) {
    console.error(`\n${failures.length} contrast problem(s):\n  ` + failures.join('\n  '))
    process.exit(1)
  }
  console.log(`\nAll ${rows.length} checks pass across ${THEME_IDS.length} themes.`)
}
