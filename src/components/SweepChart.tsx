import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { breakEvenBuyRate, breakEvenSellRate, profitAt, type Inputs } from '../lib/calc'
import { fmt, taka, takaSigned } from '../lib/format'
import { snap, SWEEP_STEP, type SweepKind } from '../lib/sweep'
import type { Range } from '../lib/whatif'
import { useChartStyle } from '../hooks/useTheme'
import { Glyph } from './Glyph'

const M = { l: 52, r: 14, t: 12, b: 26 }
const THUMB = 24
const POINTS = 81

const CFG = {
  usdt: {
    title: 'What if the USDT sell rate changes?',
    help: (be: number) => `Below ${taka(be, 2)} the direct route wins`,
    beName: 'Break-even',
    yourName: 'Your sell rate',
    heldName: 'buying rate',
    fmtHeld: (v: number) => fmt(v, 3),
    fmtRate: (v: number) => `${taka(v, 2)}/USDT`,
    fmtAxis: (v: number) => fmt(v, 1),
    fmtLabel: (v: number) => fmt(v, 2),
    unit: 'USDT sell rate (BDT/USDT)',
    /** profit rises with x, so the loss side is on the left */
    lossLeft: true,
  },
  payoneer: {
    title: 'What if the Buying USDT rate changes?',
    help: (be: number) => `Above ~${fmt(be, 3)} the direct route wins`,
    beName: 'Max rate',
    yourName: 'Your buying rate',
    heldName: 'sell rate',
    fmtHeld: (v: number) => taka(v, 2),
    fmtRate: (v: number) => `${fmt(v, 3)} Payo/USDT`,
    fmtAxis: (v: number) => fmt(v, 3),
    fmtLabel: (v: number) => fmt(v, 3),
    unit: 'Buying USDT rate (Payo/USDT)',
    /** profit falls as x rises, so the loss side is on the right */
    lossLeft: false,
  },
} as const

function niceStep(range: number, target = 4) {
  const raw = range / target
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  const f = raw / pow
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow
}

const compact = (n: number) =>
  Math.abs(n) >= 1000 ? `${n < 0 ? '−' : ''}${fmt(Math.abs(n) / 1000, 1)}k` : fmt(n, 0)

const tone = (p: number) => (p >= 0.5 ? 'text-pos' : p <= -0.5 ? 'text-neg' : 'text-ink')

export function SweepChart({
  kind,
  inputs,
  value,
  other,
  range,
  yRange,
  onChange,
  fill,
}: {
  kind: SweepKind
  /** the entered (main-form) inputs */
  inputs: Inputs
  /** scenario value on THIS chart's x-axis */
  value: number
  /** scenario value of the OTHER variable, held fixed on this chart */
  other: number
  /** stable x range (from the entered values) */
  range: Range
  /** stable y range (profit at the four corners of both sweeps) */
  yRange: { min: number; max: number }
  onChange: (v: number) => void
  /** stretch to the parent's height (parent is a flex/grid cell with min-h-0) */
  fill: boolean
}) {
  const cfg = CFG[kind]
  const cs = useChartStyle() // how this theme draws charts (colours always come from tokens)
  const step = SWEEP_STEP[kind]
  const { lo, hi } = range
  const uid = useId().replace(/:/g, '')
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [size, setSize] = useState({ w: 400, h: 200 })
  const [hoverV, setHoverV] = useState<number | null>(null)

  const cur = kind === 'usdt' ? inputs.usdtToBdtRate : inputs.payoneerPerUsdt

  /** profit at x on this chart: this variable at x, the other held at its scenario value */
  const profitHeld = (v: number) =>
    kind === 'usdt' ? profitAt(inputs, { sellRate: v, buyRate: other }) : profitAt(inputs, { buyRate: v, sellRate: other })
  /** the same sweep with the other variable at its ENTERED value (the faint baseline) */
  const profitBase = (v: number) => (kind === 'usdt' ? profitAt(inputs, { sellRate: v }) : profitAt(inputs, { buyRate: v }))

  const breakEven = kind === 'usdt' ? breakEvenSellRate(inputs, other) : breakEvenBuyRate(inputs, other)
  const otherEntered = kind === 'usdt' ? inputs.payoneerPerUsdt : inputs.usdtToBdtRate
  const shifted = Math.abs(other - otherEntered) > 1e-9

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: Math.max(260, Math.floor(e.contentRect.width)), h: Math.max(80, Math.floor(e.contentRect.height)) }),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [fill])

  const W = size.w
  const H = size.h
  const iw = W - M.l - M.r
  const ih = H - M.t - M.b

  const inputsJson = JSON.stringify(inputs)
  const curves = useMemo(() => {
    const xs = Array.from({ length: POINTS }, (_, i) => lo + ((hi - lo) * i) / (POINTS - 1))
    return { xs, now: xs.map(profitHeld), base: xs.map(profitBase) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputsJson, kind, other, lo, hi])

  const compactAxis = ih < 130
  const axis = useMemo(() => {
    const s = niceStep(yRange.max - yRange.min || 1, compactAxis ? 3 : 4)
    const yMin = Math.floor(yRange.min / s) * s
    const yMax = Math.ceil(yRange.max / s) * s
    const ticks: number[] = []
    for (let t = yMin; t <= yMax + s / 2; t += s) ticks.push(Math.round(t / s) * s)
    return { yMin, yMax, ticks }
  }, [yRange.min, yRange.max, compactAxis])

  const { yMin, yMax, ticks } = axis
  const x = (v: number) => M.l + ((v - lo) / (hi - lo)) * iw
  const y = (p: number) => M.t + ((yMax - p) / (yMax - yMin || 1)) * ih
  const y0 = y(0)
  const frac = (v: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)))

  // Adventure draws a coarse step-after line (every STEP_EVERY-th sample); other themes draw the smooth curve
  const STEP_EVERY = 4
  const toPath = (ps: number[]) => {
    if (!cs.stepped) return ps.map((p, i) => `${i ? 'L' : 'M'}${x(curves.xs[i]).toFixed(1)},${y(p).toFixed(1)}`).join('')
    const idx = ps.map((_, i) => i).filter((i) => i % STEP_EVERY === 0 || i === ps.length - 1)
    let d = `M${x(curves.xs[0]).toFixed(1)},${y(ps[0]).toFixed(1)}`
    for (let k = 1; k < idx.length; k++) {
      d += `H${x(curves.xs[idx[k]]).toFixed(1)}V${y(ps[idx[k]]).toFixed(1)}`
    }
    return d
  }
  const line = toPath(curves.now)
  const baseLine = toPath(curves.base)
  const area = `${line}L${x(hi).toFixed(1)},${y0.toFixed(1)}L${x(lo).toFixed(1)},${y0.toFixed(1)}Z`

  const sv = Math.min(hi, Math.max(lo, value))
  const profit = profitHeld(sv)
  const p0 = profitBase(cur)
  const hv = hoverV === null ? null : Math.min(hi, Math.max(lo, hoverV))
  const showGhost = hv !== null && Math.abs(hv - sv) >= step / 2

  const at = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    return snap(kind, Math.min(hi, Math.max(lo, lo + ((px - M.l) / iw) * (hi - lo))))
  }
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const v = at(e)
    setHoverV(v)
    onChange(v)
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const v = at(e)
    setHoverV(v)
    if (dragging.current) onChange(v)
  }
  const onUp = (e: PointerEvent<SVGSVGElement>) => {
    dragging.current = false
    if (e.pointerType !== 'mouse') setHoverV(null)
  }

  const bePx = breakEven !== null ? THUMB / 2 + frac(breakEven) * iw : null
  const neg = 'color-mix(in oklab, var(--neg) 65%, var(--surface-2))'
  const pos = 'color-mix(in oklab, var(--pos) 65%, var(--surface-2))'
  const [left, right] = cfg.lossLeft ? [neg, pos] : [pos, neg]
  const track =
    bePx === null ? 'var(--surface-2)' : `linear-gradient(90deg, ${left} 0 ${bePx}px, ${right} ${bePx}px 100%)`
  const thumb = profit >= 0.5 ? 'var(--pos)' : profit <= -0.5 ? 'var(--neg)' : 'var(--muted)'

  const tipLeft = Math.min(W - 156, Math.max(4, x(hv ?? sv) - 74))
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + (hi - lo) * f)
  const curLabelX = Math.min(M.l + iw - 44, Math.max(M.l + 44, x(cur)))
  const beInRange = breakEven !== null && breakEven >= lo && breakEven <= hi

  return (
    <section
      aria-labelledby={`${uid}-t`}
      className={`flex flex-col rounded-2xl border border-line bg-surface px-4 pb-1 pt-2.5 shadow-card ${fill ? 'h-full min-h-0' : ''}`}
    >
      <h2 id={`${uid}-t`} className="text-sm font-semibold tracking-tight">
        {cfg.title}
      </h2>
      <p className="mt-0.5 truncate text-[11px] leading-4 text-muted">
        {breakEven !== null ? cfg.help(breakEven) : 'Break-even not available for these values.'}
      </p>
      <p className="truncate text-[11px] leading-4 text-muted">
        {cfg.heldName} held at {cfg.fmtHeld(other)}
        {shifted ? ' · dashed line = entered-rate curve' : ` · ${cfg.yourName.toLowerCase()} ${cfg.fmtLabel(cur)}`}
      </p>

      {/* chart */}
      <div ref={wrapRef} className={`relative mt-1 ${fill ? 'min-h-[80px] flex-1' : 'h-[190px]'}`}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Profit for ${cfg.unit} from ${cfg.fmtLabel(lo)} to ${cfg.fmtLabel(hi)}, with the ${cfg.heldName} held at ${cfg.fmtHeld(other)}. ${
            breakEven !== null ? `${cfg.beName} ${cfg.fmtLabel(breakEven)}. ` : ''
          }Click or drag to set the scenario rate, or use the slider below.`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={() => {
            if (!dragging.current) setHoverV(null)
          }}
          className="absolute left-0 top-0 cursor-crosshair touch-pan-y select-none rounded-lg"
        >
          <defs>
            <clipPath id={`${uid}a`}>
              <rect x={M.l} y={0} width={iw} height={Math.max(0, y0)} />
            </clipPath>
            <clipPath id={`${uid}b`}>
              <rect x={M.l} y={y0} width={iw} height={Math.max(0, H - y0)} />
            </clipPath>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize={10.5} fill="var(--muted)">
                {compact(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text
              key={i}
              x={x(t)}
              y={H - 8}
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
              fontSize={10.5}
              fill="var(--muted)"
            >
              {cfg.fmtAxis(t)}
            </text>
          ))}

          {/* Trading: finer grid (vertical lines + minor horizontal lines) */}
          {cs.fineGrid && (
            <g aria-hidden="true">
              {xTicks.map((t, i) => (
                <line key={`v${i}`} x1={x(t)} x2={x(t)} y1={M.t} y2={H - M.b} stroke="var(--chart-grid)" strokeWidth={1} />
              ))}
              {ticks.slice(0, -1).map((t, i) => (
                <line
                  key={`m${i}`}
                  x1={M.l}
                  x2={W - M.r}
                  y1={y((t + ticks[i + 1]) / 2)}
                  y2={y((t + ticks[i + 1]) / 2)}
                  stroke="var(--chart-grid)"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  opacity={0.6}
                />
              ))}
            </g>
          )}

          {/* the d: path() style lets the curve glide to its new shape (CSS transition in index.css) */}
          <path className="wi-curve" style={{ d: `path('${area}')` }} d={area} fill="var(--chart-fill-profit)" clipPath={`url(#${uid}a)`} />
          <path className="wi-curve" style={{ d: `path('${area}')` }} d={area} fill="var(--chart-fill-loss)" clipPath={`url(#${uid}b)`} />
          <line x1={M.l} x2={W - M.r} y1={y0} y2={y0} stroke="var(--muted)" strokeWidth={1} strokeDasharray="4 3" />

          {/* baseline: the same sweep with the other variable at its entered value */}
          {shifted && (
            <path
              d={baseLine}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeLinecap="round"
              opacity={0.55}
            />
          )}
          <path
            className="wi-curve"
            style={{ d: `path('${line}')` }}
            d={line}
            fill="none"
            stroke="var(--chart-line)"
            strokeWidth={cs.stepped ? 3 : 2.5}
            strokeLinejoin={cs.stepped ? 'miter' : 'round'}
            strokeLinecap={cs.stepped ? 'square' : 'round'}
          />

          {/* break-even / max rate on the zero line */}
          {beInRange && (
            cs.square ? (
              <rect x={x(breakEven) - 4} y={y0 - 4} width={8} height={8} fill="var(--surface)" stroke="var(--muted)" strokeWidth={2} />
            ) : (
              <circle cx={x(breakEven)} cy={y0} r={4} fill="var(--surface)" stroke="var(--muted)" strokeWidth={2} />
            )
          )}

          {/* your entered rate, on the baseline curve */}
          <line x1={x(cur)} x2={x(cur)} y1={M.t} y2={H - M.b} stroke="var(--accent-ink)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
          {cs.square ? (
            <rect x={x(cur) - 5} y={y(p0) - 5} width={10} height={10} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2.5} />
          ) : (
            <circle cx={x(cur)} cy={y(p0)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2.5} />
          )}

          {/* hover ghost */}
          {showGhost && hv !== null && (
            <g pointerEvents="none">
              <line x1={x(hv)} x2={x(hv)} y1={M.t} y2={H - M.b} stroke="var(--ink)" strokeWidth={1} opacity={0.25} />
              {cs.square ? (
                <rect x={x(hv) - 4.5} y={y(profitHeld(hv)) - 4.5} width={9} height={9} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} opacity={0.6} />
              ) : (
                <circle cx={x(hv)} cy={y(profitHeld(hv))} r={4.5} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} opacity={0.6} />
              )}
            </g>
          )}

          {/* Trading: crosshair that follows the pointer (horizontal line at the profit under the cursor) */}
          {cs.crosshair && hv !== null && (
            <g pointerEvents="none">
              <line x1={M.l} x2={W - M.r} y1={y(profitHeld(hv))} y2={y(profitHeld(hv))} stroke="var(--ink)" strokeWidth={1} strokeDasharray="3 3" opacity={0.45} />
              <line x1={x(hv)} x2={x(hv)} y1={M.t} y2={H - M.b} stroke="var(--ink)" strokeWidth={1} strokeDasharray="3 3" opacity={0.45} />
            </g>
          )}

          {/* scenario marker: x follows the pointer instantly, y glides when the other variable moves */}
          <g transform={`translate(${x(sv)} 0)`} pointerEvents="none">
            <line y1={M.t} y2={H - M.b} stroke="var(--ink)" strokeWidth={1.25} opacity={0.55} />
            {cs.square ? (
              <rect
                className="wi-dot"
                x={-6}
                y={-6}
                width={12}
                height={12}
                style={{ transform: `translateY(${y(profit)}px)` }}
                fill={thumb}
                stroke="var(--surface)"
                strokeWidth={2.5}
              />
            ) : (
              <circle
                className="wi-dot"
                r={6}
                cx={0}
                cy={0}
                style={{ transform: `translateY(${y(profit)}px)` }}
                fill={thumb}
                stroke="var(--surface)"
                strokeWidth={2.5}
              />
            )}
          </g>
        </svg>

        {hv !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 w-[9.75rem] rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-card"
            style={{ left: tipLeft }}
          >
            <div className="text-muted">At {cfg.fmtRate(hv)}</div>
            <div className={`num text-sm font-bold ${tone(profitHeld(hv))}`}>
              <Glyph value={profitHeld(hv)} />
              {takaSigned(profitHeld(hv))}
            </div>
            <div className="text-[11px] text-muted">
              {cfg.heldName} {cfg.fmtHeld(other)}
            </div>
          </div>
        )}
      </div>

      {/* slider: its thumb centre travels exactly across the plot's x-axis */}
      <div className="relative mt-0.5 h-12 shrink-0">
        <input
          type="range"
          className="sweep-range absolute top-0 h-11"
          min={lo}
          max={hi}
          step={step}
          value={sv}
          onChange={(e) => onChange(snap(kind, Number(e.target.value)))}
          aria-label={`${cfg.title} Scenario rate`}
          aria-valuetext={`${cfg.fmtLabel(sv)}, profit ${profit >= 0 ? 'plus' : 'minus'} ${fmt(Math.abs(profit), 0)} BDT`}
          style={{ left: M.l - THUMB / 2, width: iw + THUMB, '--track': track, '--thumb': thumb } as CSSProperties}
        />
        {beInRange && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[13px] h-[18px] w-0.5 rounded bg-ink"
            style={{ left: M.l + frac(breakEven) * iw - 1 }}
          />
        )}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-3 text-[10.5px] leading-3 text-muted">
          {curLabelX - M.l >= 56 && (
            <span className="absolute" style={{ left: M.l }}>
              {cfg.fmtLabel(lo)}
            </span>
          )}
          <span className="absolute -translate-x-1/2 font-medium text-ink/80" style={{ left: curLabelX }}>
            {cfg.fmtLabel(cur)}
          </span>
          {M.l + iw - curLabelX >= 56 && (
            <span className="absolute -translate-x-full" style={{ left: M.l + iw }}>
              {cfg.fmtLabel(hi)}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
