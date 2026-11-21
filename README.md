# Payoneer → USDT → BDT Calculator

A static, client-side calculator that compares converting Payoneer USD to BDT **via USDT (P2P)** against the **direct Payoneer → BDT** route. Inputs persist in `localStorage`. No backend.

## Run

```
npm install
npm run dev      # local dev server
npm test         # unit tests for the math
npm run build    # production build in dist/
```

## Formula

All math lives in [`src/lib/calc.ts`](src/lib/calc.ts).

Let `usd` = Payoneer balance, `fee` = P2P fee (as a fraction), `k` = Payoneer USD per 1 USDT.

**USDT before withdrawal**

- Before-conversion (default): `(usd − usd × fee) / k`
- Legacy: `usd / k − usd × fee`

**Then**

```
usdtReceived = max(0, that − withdrawalFeeUsdt)
bdtViaUsdt   = usdtReceived × usdtToBdtRate × (1 − sellFee)
bdtDirect    = usd × directRate × (1 − directFee)
profit       = bdtViaUsdt − bdtDirect
profit %     = profit / bdtDirect × 100
break-even   = bdtDirect / (usdtReceived × (1 − sellFee))
```

Extra fees (flat USDT withdrawal, % on selling USDT, % on the direct route) default to 0.

Invalid input (empty, negative, NaN, Infinity) is treated as 0 and results never contain NaN/Infinity.

### Reference example

`1850 USD / 123 direct / 1.015 / 1% / 131`:

| Mode | USDT | Profit |
|---|---|---|
| Legacy | ≈ 1804.16 | ≈ 8,795 BDT |
| Before conversion | ≈ 1804.43 | ≈ 8,831 BDT |
