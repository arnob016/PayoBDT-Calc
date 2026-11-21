# Payoneer → USDT → BDT Calculator

A static, client-side calculator that compares converting Payoneer USD to BDT **via USDT (P2P)** against the **direct Payoneer → BDT** route. Inputs and saved scenarios persist in `localStorage`. No backend.

## Run

```
npm install
npm run dev      # local dev server
npm test         # unit tests for the math and state migration
npm run build    # production build in dist/
```

## Formula

All math lives in [`src/lib/calc.ts`](src/lib/calc.ts) (pure, tested).

Every adjustment has a **sign**: `+ Profit` adds, `− Loss` subtracts (`sign = +1 / −1`).

```
feeUsd        = type === 'percent' ? usd × value/100 : value      // Payoneer fee (P2P): % or flat $
usdAfterFee   = usd + sign × feeUsd                               // fee is applied to the USD balance first
usdtGross     = usdAfterFee / payoneerPerUsdt
usdtNet       = usdtGross + sign × usdtWithdrawalFlat
effectiveRate = usdtToBdtRate + sign × bdtAddedToRate             // bKash/Nagad charge
bdtViaUsdt    = usdtNet × effectiveRate × (1 + sign × sellFeePct/100)
bdtDirect     = usd × directRate × (1 + sign × directFeePct/100)
profit        = bdtViaUsdt − bdtDirect
profit %      = profit / bdtDirect × 100
break-even    = bdtDirect / (usdtNet × sellMult) − sign × bdtAddedToRate   // the usdtToBdtRate where profit = 0
```

Defaults: Payoneer Sending $100, Payoneer Fee (P2P) 1 % **loss**, BDT charges (bKash/Nagad) **profit** (0), every extra fee **loss** (0).

Field names in the UI: *Payoneer Sending* (USD), *Paying Customer (BDT)* (the direct rate, BDT/USD), *Buying USDT rate (Payo/USDT)*, *USDT sell rate (BDT/USDT)*, *BDT charges (bKash/Nagad)* (added to or taken from the sell rate to give the *Effective sell rate*). In code these are `payoneerUsd`, `directRate`, `payoneerPerUsdt`, `usdtToBdtRate`, `bdtAddedToRate`.

Empty / negative / NaN / Infinity values are treated as 0. Values that cannot be solved (for example a break-even with no USDT) come back as `null` and the UI shows "—".

### Reference examples

Defaults (`100 USD / 123 / 1.015 / 1 % loss / 131 / charges 0`): USDT received ≈ 97.54, BDT via USDT ≈ 12,777.34, BDT direct = 12,300, profit ≈ +477.34, break-even sell rate ≈ 126.11.

Larger case (`1850 USD`, same rates): USDT received ≈ 1,804.43, profit ≈ 8,830.78 BDT, break-even ≈ 126.11.

Two sensitivity charts sweep one rate each (sell rate, and Buying USDT rate) with everything else held fixed; `profitAtUsdtRate`, `profitAtPayoneerRate` and `breakEvenPayoneerRate` in `calc.ts` use the same `calculate()` as the results hero. A higher Buying USDT rate lowers profit, so its break-even is a *maximum* acceptable rate.

### Saved data

Old saves that contain `feeMode` or `p2pFeePct` still load: `feeMode` is ignored and `p2pFeePct` becomes a percent **loss** Payoneer fee (`migrateState` in [`src/lib/form.ts`](src/lib/form.ts)).
