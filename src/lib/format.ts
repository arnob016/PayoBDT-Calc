export const fmt = (n: number, d = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

/** ৳1,234 (absolute value, no sign) */
export const taka = (n: number, d = 0) => `৳${fmt(Math.abs(n), d)}`

/** +৳1,234 / −৳1,234 */
export const takaSigned = (n: number, d = 0) => `${n < 0 ? '−' : '+'}${taka(n, d)}`

export const pctSigned = (n: number, d = 2) => `${n < 0 ? '−' : '+'}${fmt(Math.abs(n), d)}%`
