import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { calculate, type Inputs, type Options } from '../lib/calc'
import { fmt, taka, takaSigned } from '../lib/format'

const H = 240
const M = { l: 56, r: 14, t: 16, b: 32 }
const POINTS = 41

function niceStep(range: number, target = 4) {
  const raw = range / target
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  const f = raw / pow
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow
}

const compact = (n: number) =>
  Math.abs(n) >= 1000 ? `${n < 0 ? '−' : ''}${fmt(Math.abs(n) / 1000, 1)}k` : fmt(n, 0)

export function SensitivityChart({
  inputs,
  options,
  breakEven,
}: {
  inputs: Inputs
  options: Options
  breakEven: number
}) {
  const uid = useId().replace(/:/g, '')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const current = inputs.usdtToBdtRate
  const model = useMemo(() => {
    if (breakEven <= 0) return null
    const half = Math.max(5, Math.abs(current - breakEven) + 0.5)
    const lo = Math.max(0.01, breakEven - half)
    const hi = breakEven + half
    const pts = Array.from({ length: POINTS }, (_, i) => {
      const rate = lo + ((hi - lo) * i) / (POINTS - 1)
      return { rate, profit: calculate({ ...inputs, usdtToBdtRate: rate }, options).profitBdt }
    })
    const ps = pts.map((p) => p.profit)
    let yMin = Math.min(0, ...ps)
    let yMax = Math.max(0, ...ps)
    const step = niceStep(yMax - yMin || 1)
    yMin = Math.floor(yMin / step) * step
    yMax = Math.ceil(yMax / step) * step
    const ticks: number[] = []
    for (let t = yMin; t <= yMax + step / 2; t += step) ticks.push(Math.round(t / step) * step)
    return { pts, lo, hi, yMin, yMax, ticks }
  }, [inputs, options, breakEven, current])

  if (!model) {
    return (
      <Shell>
        <p className="py-10 text-center text-sm text-muted">Enter valid values to see the sensitivity chart.</p>
      </Shell>
    )
  }

  const { pts, lo, hi, yMin, yMax, ticks } = model
  const iw = W - M.l - M.r
  const ih = H - M.t - M.b
  const x = (rate: number) => M.l + ((rate - lo) / (hi - lo)) * iw
  const y = (p: number) => M.t + ((yMax - p) / (yMax - yMin || 1)) * ih
  const y0 = y(0)

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.rate).toFixed(1)},${y(p.profit).toFixed(1)}`).join('')
  const area = `${line}L${x(pts[pts.length - 1].rate).toFixed(1)},${y0.toFixed(1)}L${x(pts[0].rate).toFixed(1)},${y0.toFixed(1)}Z`

  const nearest = (rate: number) =>
    Math.round(((Math.min(hi, Math.max(lo, rate)) - lo) / (hi - lo)) * (POINTS - 1))

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    setActive(nearest(lo + ((px - M.l) / iw) * (hi - lo)))
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return setActive(null)
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    setActive((a) => Math.min(POINTS - 1, Math.max(0, (a ?? nearest(current)) + d)))
  }

  const cx = x(Math.min(hi, Math.max(lo, current)))
  const cy = y(calculate(inputs, options).profitBdt)
  const act = active === null ? null : pts[active]
  const tipLeft = act ? Math.min(W - 150, Math.max(4, x(act.rate) - 70)) : 0

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + (hi - lo) * f)

  return (
    <Shell>
      <div ref={wrapRef} className="relative">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          tabIndex={0}
          role="img"
          aria-label={`Profit for USDT rates from ${fmt(lo)} to ${fmt(hi)} BDT. Break-even at ${fmt(breakEven)}; current rate ${fmt(current)}. Use left and right arrow keys to inspect values.`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          className="block touch-pan-y select-none rounded-lg"
        >
          <defs>
            <clipPath id={`${uid}a`}><rect x={M.l} y={0} width={iw} height={Math.max(0, y0)} /></clipPath>
            <clipPath id={`${uid}b`}><rect x={M.l} y={y0} width={iw} height={Math.max(0, H - y0)} /></clipPath>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
                {compact(t)}
              </text>
            </g>
          ))}
           {xTicks.map((t, i) => (
            <text key={t} x={x(t)} y={H - 10} textAnchor={i === xTicks.length - 1 ? 'end' : 'middle'} fontSize={11} fill="var(--muted)">
              {fmt(t, 1)}
            </text>
          ))}

          <path d={area} fill="var(--pos)" fillOpacity={0.22} clipPath={`url(#${uid}a)`} />
          <path d={area} fill="var(--neg)" fillOpacity={0.25} clipPath={`url(#${uid}b)`} />
          <line x1={M.l} x2={W - M.r} y1={y0} y2={y0} stroke="var(--muted)" strokeWidth={1} strokeDasharray="4 3" />
          <path d={line} fill="none" stroke="var(--accent-ink)" strokeWidth={2.5} strokeLinejoin="round" />

          {/* break-even tick on the zero line */}
          <circle cx={x(breakEven)} cy={y0} r={4} fill="var(--surface)" stroke="var(--muted)" strokeWidth={2} />

          {/* current rate */}
          <line x1={cx} x2={cx} y1={M.t} y2={H - M.b} stroke="var(--accent-ink)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
          <circle cx={cx} cy={cy} r={6} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2.5} />

          {act && (
            <g>
              <line x1={x(act.rate)} x2={x(act.rate)} y1={M.t} y2={H - M.b} stroke="var(--ink)" strokeWidth={1} opacity={0.4} />
              <circle cx={x(act.rate)} cy={y(act.profit)} r={5} fill={act.profit >= 0 ? 'var(--pos)' : 'var(--neg)'} stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>

        {act && (
          <div
            className="pointer-events-none absolute top-1 z-10 w-[9.5rem] rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-card"
            style={{ left: tipLeft }}
          >
            <div className="text-muted">At {taka(act.rate, 2)}/USDT</div>
            <div className={`text-sm font-bold ${act.profit >= 0 ? 'text-pos' : 'text-neg'}`}>
              {takaSigned(act.profit)}
            </div>
          </div>
        )}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" /> Your rate {taka(current, 2)}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-muted bg-surface" /> Break-even {taka(breakEven, 2)}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-neg/60" /> Loss vs direct
        </li>
      </ul>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="sens-title"
      className="rounded-2xl border border-line bg-surface p-4 shadow-card lg:p-6"
    >
      <h2 id="sens-title" className="text-sm font-semibold tracking-tight">
        What if the USDT rate changes?
      </h2>
      <p className="mb-3 text-xs text-muted">Profit (BDT) across rates from break-even −5 to +5. Hover, tap or use arrow keys.</p>
      {children}
    </section>
  )
}
