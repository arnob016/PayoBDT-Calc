import type { ThemeId } from './theme'

/**
 * Self-hosted fonts (@fontsource), loaded only when their theme is first activated.
 * Inter is the base font (imported once in main.tsx) and covers Light, Dark, and the body text of
 * Cinematic and Trading. Each dynamic import is its own chunk, and @fontsource uses font-display: swap.
 */
const LOADERS: Record<ThemeId, (() => Promise<unknown>)[]> = {
  light: [],
  dark: [],
  adventure: [
    () => import('@fontsource/press-start-2p/index.css'),
    () => import('@fontsource/vt323/index.css'),
  ],
  trainer: [() => import('@fontsource-variable/fredoka/index.css')],
  cinematic: [() => import('@fontsource-variable/cinzel/index.css')],
  trading: [() => import('@fontsource-variable/jetbrains-mono/index.css')],
  futuristic: [
    () => import('@fontsource-variable/orbitron/index.css'),
    () => import('@fontsource-variable/exo-2/index.css'),
  ],
}

const done = new Set<ThemeId>()

export function loadThemeFonts(id: ThemeId): Promise<void> {
  if (done.has(id)) return Promise.resolve()
  done.add(id)
  return Promise.all(LOADERS[id].map((load) => load().catch(() => undefined))).then(() => undefined)
}
