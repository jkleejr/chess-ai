// Shared display formatters. Kept out of screen modules so those export only
// components (React Fast Refresh only works on component-only files).

/** "300" → "5 min", "180+2" → "3 min + 2s", "60" → "1 min", "1/86400" → "Daily". */
export function fmtTimeControl(tc: string): string {
  if (tc.includes('/')) return 'Daily'
  const [baseStr, incStr] = tc.split('+')
  const base = Number(baseStr)
  const inc = Number(incStr ?? 0)
  if (!Number.isFinite(base) || base <= 0) return tc
  const min = base / 60
  const label = min >= 1 ? `${Number.isInteger(min) ? min : min.toFixed(1)} min` : `${base} sec`
  return inc > 0 ? `${label} + ${inc}s` : label
}
