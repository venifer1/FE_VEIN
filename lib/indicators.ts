// Client-side technical indicators computed from candle closes.
// All math is pure number arithmetic (parse string decimals before calling).
// Returned arrays are index-aligned to the input `closes`; leading entries
// where the lookback window isn't full are `null`.

// Simple moving average over a window of `n` closes.
// Returns an array the same length as `closes`; entries < n-1 are null.
export function sma(closes: number[], n: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (n <= 0 || closes.length < n) return out;
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= n) sum -= closes[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

export interface BollingerBands {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

// Bollinger Bands: middle = SMA(n), upper/lower = middle ± mult * stddev(n).
// Uses population standard deviation (divide by n), aligned to `closes`.
export function bollinger(closes: number[], n = 20, mult = 2): BollingerBands {
  const middle = sma(closes, n);
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = n - 1; i < closes.length; i++) {
    const mean = middle[i];
    if (mean == null) continue;
    let variance = 0;
    for (let j = i - n + 1; j <= i; j++) {
      const diff = closes[j] - mean;
      variance += diff * diff;
    }
    const sd = Math.sqrt(variance / n);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { upper, middle, lower };
}
