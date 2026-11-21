export const THEMES_CSS: string
export const THEME_IDS: string[]
export const MIN_CVD_DELTA_E: number
export function parseThemes(css: string): Record<string, Record<string, string>>
export function hexToRgb(hex: string): number[]
export function luminance(hex: string): number
export function contrast(a: string, b: string): number
export function mix(a: string, b: string, pct: number): string
export function cvdDistance(a: string, b: string): Record<string, number>
export function checksFor(tokens: Record<string, string>): [string, string, string, number][]
export interface CheckRow {
  theme: string
  name: string
  fg: string
  bg: string
  ratio: number
  min: number
  ok: boolean
  cvd?: boolean
}
export function runChecks(css?: string): {
  themes: Record<string, Record<string, string>>
  rows: CheckRow[]
  failures: string[]
}
