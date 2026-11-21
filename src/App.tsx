import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { calculate, type Result } from './lib/calc'
import {
  DEFAULT_STATE,
  loadState,
  saveState,
  toCalcArgs,
  validateAll,
  type FieldKey,
  type FormState,
} from './lib/form'
import { useTheme } from './hooks/useTheme'
import { useMediaQuery } from './hooks/useMediaQuery'
import { Header } from './components/Header'
import { ResultsHero } from './components/ResultsHero'
import { InputsPanel } from './components/InputsPanel'
import { Breakdown } from './components/Breakdown'
import { SensitivityChart } from './components/SensitivityChart'
import { ActionButtons, ScenarioList, Toast } from './components/Extras'
import {
  buildSummary,
  copyText,
  loadScenarios,
  MAX_SCENARIOS,
  persistScenarios,
  type Scenario,
} from './lib/scenarios'

export default function App() {
  const { theme, toggle } = useTheme()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [state, setState] = useState<FormState>(loadState)

  useEffect(() => saveState(state), [state])

  const [scenarios, setScenarios] = useState<Scenario[]>(loadScenarios)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const errors = useMemo(() => validateAll(state.form), [state.form])
  const valid = Object.keys(errors).length === 0

  // While inputs are invalid keep showing the last good result, so nothing jumps.
  const lastGood = useRef<Result | null>(null)
  const result = useMemo(() => {
    const { inputs, options } = toCalcArgs(state)
    return calculate(inputs, options)
  }, [state])
  const lastGoodState = useRef<FormState>(state)
  if (valid) {
    lastGood.current = result
    lastGoodState.current = state
  }
  const shown = valid ? result : (lastGood.current ?? result)

  const inputs = (
    <InputsPanel
      state={state}
      onField={(k: FieldKey, v: string) => setState((s) => ({ ...s, form: { ...s.form, [k]: v } }))}
      onFeeMode={(feeMode) => setState((s) => ({ ...s, feeMode }))}
      onReset={() => setState(DEFAULT_STATE)}
    />
  )
  const hero = <ResultsHero r={shown} valid={valid} />
  // Breakdown reflects the same (last good) numbers as the hero.
  const args = toCalcArgs(valid ? state : lastGoodState.current)
  const copy = async () => {
    if (!valid) return setToast('Fix the highlighted fields first')
    setToast((await copyText(buildSummary(args.inputs, args.options, shown))) ? 'Summary copied' : 'Copy failed')
  }
  const save = () => {
    if (!valid) return setToast('Fix the highlighted fields first')
    const next = [{ id: crypto.randomUUID(), savedAt: Date.now(), state, profit: shown.profitBdt }, ...scenarios].slice(0, MAX_SCENARIOS)
    setScenarios(next)
    persistScenarios(next)
    setToast('Scenario saved')
  }
  const del = (id: string) => {
    const next = scenarios.filter((x) => x.id !== id)
    setScenarios(next)
    persistScenarios(next)
  }
  const load = (sc: Scenario) => {
    setState(sc.state)
    setToast('Scenario loaded')
  }
  const history = <ScenarioList items={scenarios} onLoad={load} onDelete={del} />
  const actions = <ActionButtons onCopy={copy} onSave={save} />
  const breakdown = (
    <Breakdown
      inputs={args.inputs}
      options={args.options}
      result={shown}
      footer={isDesktop ? undefined : actions}
    />
  )
  const chart = <SensitivityChart inputs={args.inputs} options={args.options} breakEven={shown.breakEvenRate} />

  return (
    <div className="mx-auto min-h-screen max-w-[1100px] px-4 pb-16 lg:px-6">
      <Header theme={theme} onToggle={toggle} />
      {isDesktop ? (
        <div className="grid grid-cols-[minmax(0,1fr)_420px] items-start gap-6">
          <div className="space-y-4">
            {inputs}
            {actions}
            {chart}
            {history}
          </div>
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] space-y-4 overflow-y-auto rounded-2xl p-1 -m-1">
            {hero}
            {breakdown}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="sticky top-0 z-20 -mx-4 bg-bg/90 px-4 py-2 backdrop-blur">{hero}</div>
          {inputs}
          {breakdown}
          {chart}
          {history}
        </div>
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
