import { useThemeId } from '../hooks/useTheme'

/**
 * ▲ / ▼ next to a signed value. Only the Trading theme shows it, and it never replaces the +/− sign
 * (the sign is always printed), so profit vs loss never relies on colour or on this glyph alone.
 */
export function Glyph({ value }: { value: number | null | undefined }) {
  const theme = useThemeId()
  if (theme !== 'trading' || value === null || value === undefined || Math.abs(value) < 0.005) return null
  return (
    <span aria-hidden="true" className="mr-[0.2em] inline-block align-middle text-[0.62em] leading-none">
      {value > 0 ? '▲' : '▼'}
    </span>
  )
}
