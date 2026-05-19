/**
 * Pure financial-math helpers for feasibility analysis.
 * No external dependencies.
 */

/** Net present value at the given (decimal) discount rate. */
export function calculateNPV(cashFlows: number[], discountRate: number): number {
  let npv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    const cf = cashFlows[t] ?? 0;
    npv += cf / Math.pow(1 + discountRate, t);
  }
  return npv;
}

/** Derivative of NPV wrt rate (used by Newton-Raphson). */
function npvDerivative(cashFlows: number[], rate: number): number {
  let d = 0;
  for (let t = 1; t < cashFlows.length; t++) {
    const cf = cashFlows[t] ?? 0;
    d += (-t * cf) / Math.pow(1 + rate, t + 1);
  }
  return d;
}

/**
 * Internal Rate of Return via Newton-Raphson.
 * Returns null if it does not converge.
 */
export function calculateIRR(cashFlows: number[], guess = 0.1): number | null {
  if (cashFlows.length < 2) return null;
  const hasPositive = cashFlows.some((v) => v > 0);
  const hasNegative = cashFlows.some((v) => v < 0);
  if (!hasPositive || !hasNegative) return null;

  const maxIter = 100;
  const tol = 1e-7;
  let rate = guess;

  for (let i = 0; i < maxIter; i++) {
    const npv = calculateNPV(cashFlows, rate);
    if (Math.abs(npv) < tol) return rate;
    const d = npvDerivative(cashFlows, rate);
    if (d === 0 || !Number.isFinite(d)) return null;
    const next = rate - npv / d;
    if (!Number.isFinite(next)) return null;
    if (Math.abs(next - rate) < tol) return next;
    rate = next;
    if (rate <= -1) rate = -0.999999;
  }
  return null;
}

/** Months until cumulative cash flow becomes non-negative. */
export function calculatePaybackMonths(cashFlows: number[]): number | null {
  let acc = 0;
  for (let i = 0; i < cashFlows.length; i++) {
    acc += cashFlows[i] ?? 0;
    if (acc >= 0 && i > 0) return i;
  }
  return null;
}
