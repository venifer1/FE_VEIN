// Seeded mock data so the UI renders without a backend.
// Gated by NEXT_PUBLIC_USE_MOCK=true via the axios mock adapter in api.ts.
import type {
  Alert,
  BacktestMetrics,
  BacktestOutcome,
  BacktestParams,
  BacktestResult,
  Candle,
  CandleResponse,
  Derivative,
  DerivativeDetail,
  FearGreedPoint,
  FundingArbRow,
  GlobalMarket,
  Mover,
  MoverType,
  IndicatorSummary,
  Instrument,
  KimchiPremiumRow,
  LiquidationSnapshot,
  Market,
  MarketIndexRow,
  NewsItem,
  Notification,
  ScalpDetail,
  ScalpRankRow,
  Signal,
  SignalDetail,
  SignalPerformance,
  SignalPerformanceHorizon,
  SignalPerformanceSummaryRow,
  Strategy,
  StrategyRun,
  SupplyRow,
  SystemStatus,
  ThemeConstituent,
  ThemeDetail,
  ThemeRow,
  Timeframe,
  Trending,
  TvlHistory,
  TvlRow,
  Watchlist,
} from "./types";

/**
 * 목 모드 전용 비밀번호. 백엔드를 전혀 거치지 않는 클라이언트 픽스처 값이며,
 * 실제 서버 계정 비밀번호와 절대 같은 값을 쓰지 않는다.
 */
export const MOCK_PASSWORD = "mock1234";

export const BUILD_VERSION = "vein-frontend-0.2.0 (mock · 5-tab IA)";

// ---------------- instruments (4 markets) ----------------
export const instruments: Instrument[] = [
  // CRYPTO (Upbit KRW)
  { id: "ins_btc", symbol: "KRW-BTC", name: "비트코인", exchange: "UPBIT", market: "CRYPTO", quote_currency: "KRW", status: "ACTIVE" },
  { id: "ins_eth", symbol: "KRW-ETH", name: "이더리움", exchange: "UPBIT", market: "CRYPTO", quote_currency: "KRW", status: "ACTIVE" },
  { id: "ins_sol", symbol: "KRW-SOL", name: "솔라나", exchange: "UPBIT", market: "CRYPTO", quote_currency: "KRW", status: "ACTIVE" },
  { id: "ins_xrp", symbol: "KRW-XRP", name: "리플", exchange: "UPBIT", market: "CRYPTO", quote_currency: "KRW", status: "ACTIVE" },
  { id: "ins_doge", symbol: "KRW-DOGE", name: "도지코인", exchange: "UPBIT", market: "CRYPTO", quote_currency: "KRW", status: "ACTIVE" },
  // US
  { id: "ins_aapl", symbol: "AAPL", name: "Apple", exchange: "NASDAQ", market: "US", quote_currency: "USD", status: "ACTIVE" },
  { id: "ins_nvda", symbol: "NVDA", name: "NVIDIA", exchange: "NASDAQ", market: "US", quote_currency: "USD", status: "ACTIVE" },
  { id: "ins_tsla", symbol: "TSLA", name: "Tesla", exchange: "NASDAQ", market: "US", quote_currency: "USD", status: "ACTIVE" },
  // KOSPI
  { id: "ins_005930", symbol: "005930", name: "삼성전자", exchange: "KRX", market: "KOSPI", quote_currency: "KRW", status: "ACTIVE" },
  { id: "ins_000660", symbol: "000660", name: "SK하이닉스", exchange: "KRX", market: "KOSPI", quote_currency: "KRW", status: "ACTIVE" },
  // KOSDAQ
  { id: "ins_247540", symbol: "247540", name: "에코프로비엠", exchange: "KOSDAQ", market: "KOSDAQ", quote_currency: "KRW", status: "ACTIVE" },
  { id: "ins_086520", symbol: "086520", name: "에코프로", exchange: "KOSDAQ", market: "KOSDAQ", quote_currency: "KRW", status: "ACTIVE" },
];

const instrumentById = Object.fromEntries(instruments.map((i) => [i.id, i]));

function tfStepSec(tf: Timeframe): number {
  switch (tf) {
    case "15m": return 900;
    case "1h": return 3600;
    case "4h": return 14400;
    case "1d": return 86400;
    case "3d": return 259200;
    case "1w": return 604800;
    case "1M": return 2592000;
    default: return 86400;
  }
}

// Deterministic pseudo-random so SSR/CSR match.
function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function genCandles(
  instrumentId: string,
  timeframe: Timeframe,
  count = 200,
  base = 100_000_000,
): Candle[] {
  const step = tfStepSec(timeframe);
  const rnd = seeded(
    instrumentId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + step,
  );
  const nowSec = Math.floor(Date.now() / 1000);
  const lastOpen = Math.floor(nowSec / step) * step - step;
  const startOpen = lastOpen - (count - 1) * step;

  const candles: Candle[] = [];
  let price = base;
  for (let i = 0; i < count; i++) {
    const openTime = (startOpen + i * step) * 1000;
    const drift = (rnd() - 0.48) * 0.03;
    const open = price;
    const close = open * (1 + drift);
    const high = Math.max(open, close) * (1 + rnd() * 0.012);
    const low = Math.min(open, close) * (1 - rnd() * 0.012);
    const volume = 50 + rnd() * 500;
    candles.push({
      open_time: new Date(openTime).toISOString(),
      open: open.toFixed(2),
      high: high.toFixed(2),
      low: low.toFixed(2),
      close: close.toFixed(2),
      volume: volume.toFixed(8),
      is_final: true,
    });
    price = close;
  }
  return candles;
}

const basePrice: Record<string, number> = {
  ins_btc: 142_000_000,
  ins_eth: 5_200_000,
  ins_sol: 240_000,
  ins_xrp: 3_100,
  ins_doge: 280,
  ins_aapl: 228,
  ins_nvda: 132,
  ins_tsla: 245,
  ins_005930: 78_000,
  ins_000660: 195_000,
  ins_247540: 165_000,
  ins_086520: 92_000,
};

export const candleStore: Record<string, Candle[]> = {};
export function getCandles(instrumentId: string, timeframe: Timeframe): Candle[] {
  const key = `${instrumentId}:${timeframe}`;
  if (!candleStore[key]) {
    candleStore[key] = genCandles(
      instrumentId,
      timeframe,
      200,
      basePrice[instrumentId] ?? 1_000_000,
    );
  }
  return candleStore[key];
}

function isoMinutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

// ---------------- indicators ----------------
export function getIndicators(instrumentId: string, timeframe: Timeframe): IndicatorSummary {
  const c = getCandles(instrumentId, timeframe);
  const closes = c.map((x) => Number(x.close));
  const last = closes.at(-1) ?? 0;
  const ma = (n: number) => {
    const slice = closes.slice(-n);
    return (slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2);
  };
  const ma20 = Number(ma(20));
  const sd = Math.sqrt(
    closes.slice(-20).reduce((a, b) => a + (b - ma20) ** 2, 0) / 20,
  );
  return {
    timeframe,
    rsi14: (45 + (last % 20)).toFixed(1),
    ma5: ma(5),
    ma20: ma(20),
    ma60: ma(60),
    ma120: ma(120),
    boll_upper: (ma20 + 2 * sd).toFixed(2),
    boll_middle: ma20.toFixed(2),
    boll_lower: (ma20 - 2 * sd).toFixed(2),
    macd: (last * 0.002).toFixed(2),
    macd_signal: (last * 0.0018).toFixed(2),
    macd_histogram: (last * 0.0002).toFixed(2),
  };
}

// ---------------- signals (4 pattern types × 4 markets) ----------------
function pivotDates(instrumentId: string, tf: Timeframe) {
  const c = getCandles(instrumentId, tf);
  const n = c.length;
  // Match real backend PivotsSummary shape: { pivot0, pivot_a, pivot_b }.
  return {
    pivot0: c[n - 40].open_time,
    pivot_a: c[n - 25].open_time,
    pivot_b: c[n - 10].open_time,
  };
}
function cTargetOf(instrumentId: string, tf: Timeframe) {
  const c = getCandles(instrumentId, tf);
  const n = c.length;
  return (Number(c[n - 10].high) - (Number(c[n - 40].high) - Number(c[n - 25].low))).toFixed(2);
}
function lastClose(instrumentId: string, tf: Timeframe) {
  return getCandles(instrumentId, tf).at(-1)!.close;
}

export const signals: Signal[] = [
  {
    id: "sig_001", type: "ABC", status: "NEAR_COMPLETION", market: "CRYPTO",
    instrument: { id: "ins_btc", symbol: "KRW-BTC", name: "비트코인", market: "CRYPTO" },
    timeframe: "4h", detected_at: isoMinutesAgo(35), score: "82.5",
    current_price: lastClose("ins_btc", "4h"), c_target: cTargetOf("ins_btc", "4h"),
    pivots: pivotDates("ins_btc", "4h"), freshness: "FRESH",
  },
  {
    id: "sig_003", type: "ABC", status: "DETECTED", market: "CRYPTO",
    instrument: { id: "ins_sol", symbol: "KRW-SOL", name: "솔라나", market: "CRYPTO" },
    timeframe: "1d", detected_at: isoMinutesAgo(300), score: "68.2",
    current_price: lastClose("ins_sol", "1d"), c_target: cTargetOf("ins_sol", "1d"),
    pivots: pivotDates("ins_sol", "1d"), freshness: "FRESH",
  },
  {
    id: "sig_004", type: "TOP", status: "DETECTED", market: "US",
    instrument: { id: "ins_nvda", symbol: "NVDA", name: "NVIDIA", market: "US" },
    timeframe: "1d", detected_at: isoMinutesAgo(180), score: "71.4",
    current_price: lastClose("ins_nvda", "1d"), c_target: cTargetOf("ins_nvda", "1d"),
    pivots: pivotDates("ins_nvda", "1d"), freshness: "FRESH",
  },
  {
    id: "sig_005", type: "IMALOL", status: "NEAR_COMPLETION", market: "KOSPI",
    instrument: { id: "ins_005930", symbol: "005930", name: "삼성전자", market: "KOSPI" },
    timeframe: "1d", detected_at: isoMinutesAgo(220), score: "65.0",
    current_price: lastClose("ins_005930", "1d"), pivots: pivotDates("ins_005930", "1d"),
    freshness: "FRESH",
  },
  {
    id: "sig_007", type: "ABC", status: "INVALIDATED", market: "CRYPTO",
    instrument: { id: "ins_xrp", symbol: "KRW-XRP", name: "리플", market: "CRYPTO" },
    timeframe: "4h", detected_at: isoMinutesAgo(720), score: null,
    current_price: lastClose("ins_xrp", "4h"), c_target: cTargetOf("ins_xrp", "4h"),
    pivots: pivotDates("ins_xrp", "4h"), freshness: "FRESH",
  },
  {
    id: "sig_008", type: "IMALOL", status: "EXPIRED", market: "CRYPTO",
    instrument: { id: "ins_eth", symbol: "KRW-ETH", name: "이더리움", market: "CRYPTO" },
    timeframe: "1d", detected_at: isoMinutesAgo(2880), score: "55.0",
    current_price: lastClose("ins_eth", "1d"), freshness: "DELAYED",
  },
  {
    id: "sig_009", type: "TOP", status: "DETECTED", market: "US",
    instrument: { id: "ins_tsla", symbol: "TSLA", name: "Tesla", market: "US" },
    timeframe: "3d", detected_at: isoMinutesAgo(420), score: "63.1",
    current_price: lastClose("ins_tsla", "3d"), c_target: cTargetOf("ins_tsla", "3d"),
    pivots: pivotDates("ins_tsla", "3d"), freshness: "FRESH",
  },
];

function abcEvidence(instrumentId: string, timeframe: Timeframe, invert = false) {
  const c = getCandles(instrumentId, timeframe);
  const n = c.length;
  const i0 = n - 40, iA = n - 25, iB = n - 10;
  // TOP = inverted ABC: 0 low, A high, B low
  const p0 = invert ? c[i0].low : c[i0].high;
  const pA = invert ? c[iA].high : c[iA].low;
  const pB = invert ? c[iB].low : c[iB].high;
  const cTarget = (Number(pB) - (Number(p0) - Number(pA))).toFixed(2);
  return {
    evidence: [
      { type: "PIVOT_0" as const, candle_time: c[i0].open_time, price: p0, sequence_no: 0 },
      { type: "PIVOT_A" as const, candle_time: c[iA].open_time, price: pA, sequence_no: 1 },
      { type: "PIVOT_B" as const, candle_time: c[iB].open_time, price: pB, sequence_no: 2 },
      { type: "C_TARGET" as const, candle_time: c[n - 1].open_time, price: cTarget, sequence_no: 3 },
    ],
    invalidation: { rule: invert ? "B_HIGH_BREAK" : "A_LOW_BREAK", price: pA },
  };
}

function imalolEvidence(instrumentId: string, timeframe: Timeframe) {
  const c = getCandles(instrumentId, timeframe);
  const n = c.length;
  const ind = getIndicators(instrumentId, timeframe);
  // Bollinger band lines anchored across the recent window + a match box at the 2nd low.
  const window = [n - 24, n - 16, n - 8, n - 1];
  const upper = window.map((i, k) => ({
    type: "BOLL_UPPER" as const, candle_time: c[i].open_time, price: ind.boll_upper!, sequence_no: k,
  }));
  const mid = window.map((i, k) => ({
    type: "BOLL_MID" as const, candle_time: c[i].open_time, price: ind.boll_middle!, sequence_no: k,
  }));
  const lower = window.map((i, k) => ({
    type: "BOLL_LOWER" as const, candle_time: c[i].open_time, price: ind.boll_lower!, sequence_no: k,
  }));
  const box = [
    { type: "MATCH_BOX" as const, candle_time: c[n - 12].open_time, price: c[n - 12].low, sequence_no: 0 },
    { type: "MATCH_BOX" as const, candle_time: c[n - 8].open_time, price: c[n - 8].high, sequence_no: 1 },
  ];
  return {
    evidence: [...upper, ...mid, ...lower, ...box],
    invalidation: { rule: "BOLL_LOWER_BREAK", price: ind.boll_lower! },
  };
}

export function getSignalDetail(id: string): SignalDetail | null {
  // Tolerate both prefixed ("sig_001") and stripped ("001") ids.
  const s = signals.find((x) => x.id === id || x.id.replace(/^[a-zA-Z]+_/, "") === id);
  if (!s) return null;
  const insId = String(s.instrument.id);
  let ev;
  switch (s.type) {
    case "TOP": ev = abcEvidence(insId, s.timeframe, true); break;
    case "IMALOL": ev = imalolEvidence(insId, s.timeframe); break;
    case "ABC":
    default: ev = abcEvidence(insId, s.timeframe, false); break;
  }
  const c = getCandles(insId, s.timeframe);
  const algo: Record<string, string> = {
    ABC: "abc-java-1.0.0", TOP: "top-java-1.0.0",
    IMALOL: "imalol-java-1.0.0",
  };
  return {
    ...s,
    evidence: ev.evidence,
    invalidation: ev.invalidation,
    chart_range: { from: c[Math.max(0, c.length - 60)].open_time, to: c[c.length - 1].open_time },
    algorithm_version: algo[s.type],
  };
}

// ---------------- signal performance (성과) ----------------
const PERF_HORIZONS = ["1h", "4h", "1d", "3d", "7d"] as const;

// Deterministic, realistic-looking horizons keyed off the signal id so SSR/CSR
// match. Returns trend up over time; MFE >= return, MAE <= 0.
export function getSignalPerformance(id: string): SignalPerformance | null {
  const s = signals.find(
    (x) => x.id === id || x.id.replace(/^[a-zA-Z]+_/, "") === id,
  );
  if (!s) return null;
  const detectedPrice = s.current_price ?? lastClose(String(s.instrument.id), s.timeframe);
  const rnd = seeded(s.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + 31);

  // Fresh / invalidated signals have no evaluated horizons yet.
  const tooFresh = s.status === "DETECTED" && Number(s.id.replace(/\D/g, "")) % 2 === 0;
  if (tooFresh) {
    return { signal_id: s.id, detected_price: detectedPrice, detected_at: s.detected_at, horizons: [] };
  }

  const base = Number(detectedPrice) || 1;
  // Directional bias: INVALIDATED trends down, others up.
  const bias = s.status === "INVALIDATED" ? -1 : 1;
  const horizons: SignalPerformanceHorizon[] = PERF_HORIZONS.map((h, i) => {
    const ret = bias * (0.4 + i * 0.7) + (rnd() - 0.5) * 1.2;
    const mfe = Math.max(ret, 0) + 0.6 + rnd() * 1.4;
    const mae = Math.min(ret, 0) - (0.3 + rnd() * 1.2);
    const price = base * (1 + ret / 100);
    return {
      horizon: h,
      price: price.toFixed(2),
      return_pct: ret.toFixed(2),
      mfe_pct: mfe.toFixed(2),
      mae_pct: mae.toFixed(2),
      evaluated_at: isoMinutesAgo(2),
    };
  });
  return { signal_id: s.id, detected_price: detectedPrice, detected_at: s.detected_at, horizons };
}

// Aggregate per-pattern summary rows (one per type × a representative tf).
const perfSummaryRows: SignalPerformanceSummaryRow[] = [
  { type: "ABC", market: "CRYPTO", timeframe: "4h", horizon: "1d", sample_size: 42, hit_rate: "61.9", avg_return_pct: "3.2", median_return_pct: "2.1", avg_mfe_pct: "5.1", avg_mae_pct: "-2.3" },
  { type: "ABC", market: "CRYPTO", timeframe: "1d", horizon: "1d", sample_size: 28, hit_rate: "57.1", avg_return_pct: "2.4", median_return_pct: "1.6", avg_mfe_pct: "4.3", avg_mae_pct: "-2.0" },
  { type: "TOP", market: "US", timeframe: "1d", horizon: "1d", sample_size: 19, hit_rate: "47.4", avg_return_pct: "-1.1", median_return_pct: "-0.7", avg_mfe_pct: "2.2", avg_mae_pct: "-3.4" },
  { type: "IMALOL", market: "KOSPI", timeframe: "1d", horizon: "1d", sample_size: 23, hit_rate: "65.2", avg_return_pct: "2.9", median_return_pct: "2.3", avg_mfe_pct: "4.8", avg_mae_pct: "-1.9" },
];

export function getSignalPerformanceSummary(
  filter: { type?: string; market?: string; timeframe?: string; horizon?: string },
): SignalPerformanceSummaryRow[] {
  const horizon = filter.horizon || "1d";
  return perfSummaryRows.filter(
    (r) =>
      r.horizon === horizon &&
      (!filter.type || r.type === filter.type) &&
      (!filter.market || r.market === filter.market) &&
      (!filter.timeframe || r.timeframe === filter.timeframe),
  );
}

// ---------------- watchlist ----------------
export const watchlist: Watchlist = {
  id: "wl_default",
  name: "default",
  items: [
    {
      instrument: instrumentById["ins_btc"], created_at: isoMinutesAgo(5000),
      last_price: lastClose("ins_btc", "1h"), last_price_at: isoMinutesAgo(8), recent_signal: signals[0],
    },
    {
      instrument: instrumentById["ins_eth"], created_at: isoMinutesAgo(4000),
      last_price: lastClose("ins_eth", "1h"), last_price_at: isoMinutesAgo(12), recent_signal: signals[1],
    },
    {
      instrument: instrumentById["ins_005930"], created_at: isoMinutesAgo(3000),
      last_price: lastClose("ins_005930", "1d"), last_price_at: isoMinutesAgo(20), recent_signal: signals[4],
    },
    {
      // simulate a partial price failure
      instrument: instrumentById["ins_sol"], created_at: isoMinutesAgo(2000),
      last_price: null, last_price_at: null, recent_signal: signals[2], price_error: true,
    },
  ],
};

// ---------------- market terminal ----------------
// Mirror the real GET /market/indices: an ARRAY keyed by `key`.
export const marketIndices: MarketIndexRow[] = [
  { key: "FEAR_GREED", value: "68.00", classification: "Greed", collected_at: isoMinutesAgo(3) },
  { key: "BTC_DOMINANCE", value: "54.30", classification: null, collected_at: isoMinutesAgo(3) },
  { key: "USDT_DOMINANCE", value: "4.80", classification: null, collected_at: isoMinutesAgo(3) },
  { key: "ALT_INDEX", value: "41.00", classification: null, collected_at: isoMinutesAgo(3) },
  { key: "NASDAQ", value: "18452.30", classification: null, collected_at: isoMinutesAgo(3) },
  { key: "KOSPI", value: "2718.55", classification: null, collected_at: isoMinutesAgo(3) },
  { key: "KOSDAQ", value: "842.10", classification: null, collected_at: isoMinutesAgo(3) },
];

// Fear & Greed 30d history (ascending). Deterministic so SSR/CSR match.
function classifyFg(v: number): string {
  if (v <= 24) return "Extreme Fear";
  if (v <= 44) return "Fear";
  if (v <= 55) return "Neutral";
  if (v <= 74) return "Greed";
  return "Extreme Greed";
}
export function getFearGreedHistory(days = 30): FearGreedPoint[] {
  const rnd = seeded(20260613);
  const out: FearGreedPoint[] = [];
  let v = 45;
  const day = 86400_000;
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    v = Math.max(5, Math.min(95, v + (rnd() - 0.45) * 12));
    const d = new Date(now - i * day);
    out.push({
      date: d.toISOString().slice(0, 10),
      value: Math.round(v).toString(),
      classification: classifyFg(v),
    });
  }
  return out;
}

// ---------------- market: global (전역 시가총액) ----------------
export const globalMarket: GlobalMarket = {
  total_market_cap_usd: "3420000000000",
  total_volume_usd: "148000000000",
  market_cap_change24h_pct: "2.34",
  active_cryptos: 13842,
  btc_dominance: "54.30",
  eth_dominance: "12.80",
};

// ---------------- market: movers (급등락) ----------------
// instrument_id mirrors the live contract (numeric, nullable). Only the few
// symbols that map to a seeded instrument carry an id; the rest are null so the
// non-clickable path is exercised too.
export const moversGainers: Mover[] = [
  { symbol: "KRW-SOL", name: "솔라나", price: "248500", change_rate: "12.41", trade_value24h: "184000000000", instrument_id: 3 },
  { symbol: "KRW-DOGE", name: "도지코인", price: "312", change_rate: "9.84", trade_value24h: "92000000000", instrument_id: 5 },
  { symbol: "KRW-XRP", name: "리플", price: "3380", change_rate: "7.12", trade_value24h: "210000000000", instrument_id: 4 },
  { symbol: "KRW-ETH", name: "이더리움", price: "5420000", change_rate: "4.05", trade_value24h: "340000000000", instrument_id: 2 },
  { symbol: "KRW-BTC", name: "비트코인", price: "145800000", change_rate: "2.18", trade_value24h: "880000000000", instrument_id: 1 },
];

export const moversLosers: Mover[] = [
  { symbol: "KRW-ADA", name: "에이다", price: "612", change_rate: "-8.43", trade_value24h: "41000000000", instrument_id: null },
  { symbol: "KRW-AVAX", name: "아발란체", price: "31200", change_rate: "-6.91", trade_value24h: "28000000000", instrument_id: null },
  { symbol: "KRW-LINK", name: "체인링크", price: "18400", change_rate: "-5.22", trade_value24h: "33000000000", instrument_id: null },
  { symbol: "KRW-DOT", name: "폴카닷", price: "5210", change_rate: "-3.74", trade_value24h: "19000000000", instrument_id: null },
  { symbol: "KRW-MATIC", name: "폴리곤", price: "388", change_rate: "-2.10", trade_value24h: "12000000000", instrument_id: null },
];

export const moversVolume: Mover[] = [
  { symbol: "KRW-BTC", name: "비트코인", price: "145800000", change_rate: "2.18", trade_value24h: "880000000000", instrument_id: 1 },
  { symbol: "KRW-ETH", name: "이더리움", price: "5420000", change_rate: "4.05", trade_value24h: "340000000000", instrument_id: 2 },
  { symbol: "KRW-XRP", name: "리플", price: "3380", change_rate: "7.12", trade_value24h: "210000000000", instrument_id: 4 },
  { symbol: "KRW-SOL", name: "솔라나", price: "248500", change_rate: "12.41", trade_value24h: "184000000000", instrument_id: 3 },
  { symbol: "KRW-DOGE", name: "도지코인", price: "312", change_rate: "9.84", trade_value24h: "92000000000", instrument_id: 5 },
];

// Equity movers (US / KOSPI / KOSDAQ). change_rate is a string %; trade_value24h
// in the local quote currency. Volume tab reuses the same set sorted by value.
const moversUsGainers: Mover[] = [
  { symbol: "NVDA", name: "NVIDIA", price: "138.42", change_rate: "5.61", trade_value24h: "41200000000", instrument_id: 7 },
  { symbol: "TSLA", name: "Tesla", price: "262.10", change_rate: "3.88", trade_value24h: "28400000000", instrument_id: 8 },
  { symbol: "AAPL", name: "Apple", price: "231.55", change_rate: "1.42", trade_value24h: "19800000000", instrument_id: 6 },
];
const moversUsLosers: Mover[] = [
  { symbol: "INTC", name: "Intel", price: "21.34", change_rate: "-4.72", trade_value24h: "6100000000", instrument_id: null },
  { symbol: "BA", name: "Boeing", price: "178.20", change_rate: "-3.15", trade_value24h: "4300000000", instrument_id: null },
  { symbol: "PFE", name: "Pfizer", price: "25.88", change_rate: "-1.96", trade_value24h: "3500000000", instrument_id: null },
];

const moversKospiGainers: Mover[] = [
  { symbol: "000660", name: "SK하이닉스", price: "201500", change_rate: "4.12", trade_value24h: "1240000000000", instrument_id: 10 },
  { symbol: "005930", name: "삼성전자", price: "79800", change_rate: "1.78", trade_value24h: "2180000000000", instrument_id: 9 },
];
const moversKospiLosers: Mover[] = [
  { symbol: "005380", name: "현대차", price: "238000", change_rate: "-2.34", trade_value24h: "410000000000", instrument_id: null },
  { symbol: "035420", name: "NAVER", price: "182000", change_rate: "-1.55", trade_value24h: "320000000000", instrument_id: null },
];

const moversKosdaqGainers: Mover[] = [
  { symbol: "247540", name: "에코프로비엠", price: "171200", change_rate: "6.04", trade_value24h: "540000000000", instrument_id: 11 },
  { symbol: "086520", name: "에코프로", price: "95400", change_rate: "3.21", trade_value24h: "380000000000", instrument_id: 12 },
];
const moversKosdaqLosers: Mover[] = [
  { symbol: "091990", name: "셀트리온헬스케어", price: "61200", change_rate: "-2.88", trade_value24h: "120000000000", instrument_id: null },
  { symbol: "066970", name: "엘앤에프", price: "84300", change_rate: "-1.42", trade_value24h: "98000000000", instrument_id: null },
];

function sortByValueDesc(rows: Mover[]): Mover[] {
  return [...rows].sort((a, b) => Number(b.trade_value24h ?? 0) - Number(a.trade_value24h ?? 0));
}

export function getMovers(type: MoverType, market: Market = "CRYPTO"): Mover[] {
  if (market === "US") {
    if (type === "LOSERS") return moversUsLosers;
    if (type === "VOLUME") return sortByValueDesc([...moversUsGainers, ...moversUsLosers]);
    return moversUsGainers;
  }
  if (market === "KOSPI") {
    if (type === "LOSERS") return moversKospiLosers;
    if (type === "VOLUME") return sortByValueDesc([...moversKospiGainers, ...moversKospiLosers]);
    return moversKospiGainers;
  }
  if (market === "KOSDAQ") {
    if (type === "LOSERS") return moversKosdaqLosers;
    if (type === "VOLUME") return sortByValueDesc([...moversKosdaqGainers, ...moversKosdaqLosers]);
    return moversKosdaqGainers;
  }
  if (type === "LOSERS") return moversLosers;
  if (type === "VOLUME") return moversVolume;
  return moversGainers;
}

// ---------------- market: trending (CoinGecko) ----------------
export const trending: Trending[] = [
  { rank: 1, coingecko_id: "solana", symbol: "SOL", name: "Solana", market_cap_rank: 5, thumb: "https://assets.coingecko.com/coins/images/4128/thumb/solana.png", price_btc: "0.001689" },
  { rank: 2, coingecko_id: "dogecoin", symbol: "DOGE", name: "Dogecoin", market_cap_rank: 8, thumb: "https://assets.coingecko.com/coins/images/5/thumb/dogecoin.png", price_btc: "0.00000198" },
  { rank: 3, coingecko_id: "ripple", symbol: "XRP", name: "XRP", market_cap_rank: 4, thumb: "https://assets.coingecko.com/coins/images/44/thumb/xrp-symbol-white-128.png", price_btc: "0.0000218" },
  { rank: 4, coingecko_id: "pepe", symbol: "PEPE", name: "Pepe", market_cap_rank: 24, thumb: "https://assets.coingecko.com/coins/images/29850/thumb/pepe-token.jpeg", price_btc: "0.00000000012" },
  { rank: 5, coingecko_id: "render-token", symbol: "RENDER", name: "Render", market_cap_rank: 41, thumb: "https://assets.coingecko.com/coins/images/11636/thumb/rndr.png", price_btc: "0.0000721" },
  { rank: 6, coingecko_id: "sui", symbol: "SUI", name: "Sui", market_cap_rank: 18, thumb: "https://assets.coingecko.com/coins/images/26375/thumb/sui-ocean-square.png", price_btc: "0.0000412" },
  { rank: 7, coingecko_id: "aptos", symbol: "APT", name: "Aptos", market_cap_rank: 32, thumb: "https://assets.coingecko.com/coins/images/26455/thumb/aptos_round.png", price_btc: "0.0000934" },
];

export function getTrending(): Trending[] {
  return trending;
}

// ---------------- derivatives (파생) ----------------
export const derivatives: Derivative[] = [
  { symbol: "BTC", perp: "BTCUSDT", mark_price: "97240.5", funding_rate: "0.0001", next_funding_at: isoMinutesAgo(-185), open_interest: "78420", oi_value_usd: "7625000000", long_short_ratio: "1.18" },
  { symbol: "ETH", perp: "ETHUSDT", mark_price: "3562.8", funding_rate: "0.00008", next_funding_at: isoMinutesAgo(-185), open_interest: "412000", oi_value_usd: "1468000000", long_short_ratio: "0.92" },
  { symbol: "SOL", perp: "SOLUSDT", mark_price: "164.35", funding_rate: "-0.00012", next_funding_at: isoMinutesAgo(-185), open_interest: "5210000", oi_value_usd: "856000000", long_short_ratio: "1.41" },
  { symbol: "XRP", perp: "XRPUSDT", mark_price: "2.318", funding_rate: "0.00003", next_funding_at: isoMinutesAgo(-185), open_interest: "184000000", oi_value_usd: "426000000", long_short_ratio: "0.78" },
  { symbol: "DOGE", perp: "DOGEUSDT", mark_price: "0.2134", funding_rate: "0.00021", next_funding_at: isoMinutesAgo(-185), open_interest: "920000000", oi_value_usd: "196000000", long_short_ratio: "1.06" },
];

export function getDerivativeDetail(symbol: string): DerivativeDetail | null {
  const row = derivatives.find((d) => d.symbol.toLowerCase() === symbol.toLowerCase());
  if (!row) return null;
  const rnd = seeded(symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + 7);
  const ls_history = [];
  const oi_history = [];
  const hour = 3600_000;
  const now = Date.now();
  let ratio = Number(row.long_short_ratio ?? 1);
  let oi = Number(row.oi_value_usd ?? 0) * 0.85;
  for (let i = 47; i >= 0; i--) {
    ratio = Math.max(0.4, ratio * (1 + (rnd() - 0.5) * 0.08));
    oi = Math.max(0, oi * (1 + (rnd() - 0.47) * 0.05));
    const t = new Date(now - i * hour).toISOString();
    ls_history.push({ t, ratio: ratio.toFixed(3) });
    oi_history.push({ t, oi: oi.toFixed(0) });
  }
  return { ...row, long_short_history: ls_history, oi_history };
}

export const kimchiPremium: KimchiPremiumRow[] = [
  { instrument_id: 1, symbol: "KRW-BTC", name: "비트코인", upbit_price: "142000000", binance_price: "97200", usdkrw: "1438.5", premium_pct: "1.62", pinned: true },
  { instrument_id: 2, symbol: "KRW-ETH", name: "이더리움", upbit_price: "5200000", binance_price: "3560", usdkrw: "1438.5", premium_pct: "1.41", pinned: true },
  { instrument_id: 3, symbol: "KRW-XRP", name: "리플", upbit_price: "3100", binance_price: "2.12", usdkrw: "1438.5", premium_pct: "1.73", pinned: true },
  { instrument_id: 4, symbol: "KRW-SOL", name: "솔라나", upbit_price: "240000", binance_price: "164.2", usdkrw: "1438.5", premium_pct: "1.55" },
  { instrument_id: 5, symbol: "KRW-DOGE", name: "도지코인", upbit_price: "280", binance_price: "0.192", usdkrw: "1438.5", premium_pct: "1.49" },
];

// ---------------- news ----------------
export const newsItems: NewsItem[] = [
  { id: "news_1", source: "TELEGRAM", title: "BTC 9.7만 달러 재돌파, 현물 ETF 순유입 지속", body: "미국 현물 비트코인 ETF에 사흘 연속 순유입이 기록되며 가격이 반등했다.", url: "https://t.me/coinnesskr/12001", published_at: isoMinutesAgo(4), is_new: true, sentiment: "POSITIVE", tagged_symbols: ["KRW-BTC"], tagged_instruments: [{ symbol: "KRW-BTC", instrument_id: 1 }] },
  { id: "news_2", source: "BLOOMBERG", title: "Fed officials signal patience on rate cuts", body: "Policymakers indicated they are in no rush to lower interest rates further.", url: "https://www.bloomberg.com/markets/x1", published_at: isoMinutesAgo(18), is_new: true, sentiment: "NEUTRAL", tagged_symbols: [], tagged_instruments: [] },
  { id: "news_3", source: "TELEGRAM", title: "이더리움 스테이킹 인출 대기열 급감", body: "검증인 인출 대기열이 2주 만에 최저 수준으로 떨어졌다.", url: "https://t.me/coinnesskr/11998", published_at: isoMinutesAgo(46), is_new: false, sentiment: "NEGATIVE", tagged_symbols: ["KRW-ETH"], tagged_instruments: [{ symbol: "KRW-ETH", instrument_id: 2 }] },
  { id: "news_4", source: "BLOOMBERG", title: "Nvidia supplier raises annual forecast", body: "A key Nvidia supplier lifted its guidance on AI server demand.", url: "https://www.bloomberg.com/markets/x2", published_at: isoMinutesAgo(75), is_new: false, sentiment: "POSITIVE", tagged_symbols: [], tagged_instruments: [] },
  { id: "news_5", source: "TELEGRAM", title: "솔라나 네트워크 수수료 수익 사상 최고", body: "온체인 활동 증가로 SOL 수수료 수익이 신기록을 세웠다.", url: "https://t.me/coinnesskr/11990", published_at: isoMinutesAgo(140), is_new: false, sentiment: "POSITIVE", tagged_symbols: ["KRW-SOL", "KRW-BTC", "KRW-ETH"], tagged_instruments: [{ symbol: "KRW-SOL", instrument_id: 3 }, { symbol: "KRW-BTC", instrument_id: 1 }, { symbol: "KRW-ETH", instrument_id: 2 }] },
];

// ---------------- scalp (틱띄기) ----------------
export const scalpRanking: ScalpRankRow[] = [
  { rank: 1, symbol: "KRW-BTC", name: "비트코인", scalp_score: "88.2", spread_ticks: "1.0", tps: "42.5", micro_vol: "0.18", ob_imbalance: "0.62", wall_state: "bid_wall" },
  { rank: 2, symbol: "KRW-ETH", name: "이더리움", scalp_score: "81.0", spread_ticks: "2.0", tps: "33.1", micro_vol: "0.22", ob_imbalance: "0.41", wall_state: "neutral" },
  { rank: 3, symbol: "KRW-SOL", name: "솔라나", scalp_score: "77.6", spread_ticks: "1.0", tps: "51.8", micro_vol: "0.31", ob_imbalance: "0.28", wall_state: "ask_wall" },
  { rank: 4, symbol: "KRW-XRP", name: "리플", scalp_score: "72.4", spread_ticks: "3.0", tps: "28.0", micro_vol: "0.27", ob_imbalance: "0.12", wall_state: "neutral" },
  { rank: 5, symbol: "KRW-DOGE", name: "도지코인", scalp_score: "69.9", spread_ticks: "2.0", tps: "60.2", micro_vol: "0.44", ob_imbalance: "0.05", wall_state: "neutral" },
];

export function getScalpDetail(symbol: string): ScalpDetail | null {
  const row = scalpRanking.find((r) => r.symbol === symbol);
  if (!row) return null;
  const base = basePrice[`ins_${symbol.replace("KRW-", "").toLowerCase()}`] ?? 100000;
  const tick = base * 0.0001;
  const top_levels = [];
  for (let i = 1; i <= 5; i++) {
    top_levels.push({
      ask_price: (base + tick * i).toFixed(2), ask_size: (10 / i).toFixed(4),
      bid_price: (base - tick * i).toFixed(2), bid_size: (12 / i).toFixed(4),
    });
  }
  return {
    symbol: row.symbol, name: row.name, scalp_score: row.scalp_score,
    spread_ticks: row.spread_ticks, tps: row.tps, micro_vol: row.micro_vol,
    ob_imbalance: row.ob_imbalance, wall_state: row.wall_state, wall_cancel_warning: false,
    buy_ratio: "0.58", sell_ratio: "0.42", recent_trade_count: 20,
    top_levels, collected_at: isoMinutesAgo(0),
  };
}

// ---------------- data: tvl ----------------
export const tvlProtocols: TvlRow[] = [
  { id: 1001, rank: 1, entity_type: "PROTOCOL", name: "Lido", category: "Liquid Staking", chains: "Ethereum", tvl: "32140000000", mcap: "1820000000", change1d: "0.8", change7d: "3.2" },
  { id: 1002, rank: 2, entity_type: "PROTOCOL", name: "Aave", category: "Lending", chains: "Ethereum,Arbitrum,Base", tvl: "18950000000", mcap: "4210000000", change1d: "-0.4", change7d: "5.1" },
  { id: 1003, rank: 3, entity_type: "PROTOCOL", name: "EigenLayer", category: "Restaking", chains: "Ethereum", tvl: "14200000000", mcap: null, change1d: "1.9", change7d: "-2.3" },
  { id: 1004, rank: 4, entity_type: "PROTOCOL", name: "Sky (Maker)", category: "CDP", chains: "Ethereum", tvl: "9870000000", mcap: "2100000000", change1d: "0.1", change7d: "1.0" },
  { id: 1005, rank: 5, entity_type: "PROTOCOL", name: "Uniswap", category: "DEX", chains: "Ethereum,Arbitrum,Polygon", tvl: "6540000000", mcap: "8900000000", change1d: "-1.2", change7d: "-4.5" },
];

export const tvlChains: TvlRow[] = [
  { id: 2001, rank: 1, entity_type: "CHAIN", name: "Ethereum", category: null, chains: "Ethereum", tvl: "78400000000", mcap: null, change1d: "0.6", change7d: "2.8" },
  { id: 2002, rank: 2, entity_type: "CHAIN", name: "Solana", category: null, chains: "Solana", tvl: "11200000000", mcap: null, change1d: "2.1", change7d: "8.4" },
  { id: 2003, rank: 3, entity_type: "CHAIN", name: "BSC", category: null, chains: "BSC", tvl: "6100000000", mcap: null, change1d: "-0.3", change7d: "0.9" },
  { id: 2004, rank: 4, entity_type: "CHAIN", name: "Base", category: null, chains: "Base", tvl: "4300000000", mcap: null, change1d: "1.4", change7d: "6.2" },
];

export function getTvlHistory(id: string): TvlHistory | null {
  const row = [...tvlProtocols, ...tvlChains].find((r) => String(r.id) === id);
  if (!row) return null;
  const rnd = seeded(id.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const points = [];
  let v = Number(row.tvl) * 0.8;
  const day = 86400_000;
  const now = Date.now();
  for (let i = 89; i >= 0; i--) {
    v = v * (1 + (rnd() - 0.47) * 0.04);
    points.push({ t: new Date(now - i * day).toISOString(), tvl: v.toFixed(0) });
  }
  return { id: row.id, name: row.name, points };
}

// ---------------- data: supply ----------------
export const supplyRows: SupplyRow[] = [
  { rank: 1, coingecko_id: "bitcoin", name: "Bitcoin", symbol: "BTC", price_usd: "97200", market_cap: "1925000000000", circulating: "19800000", total_supply: "19800000", max_supply: "21000000", circulating_pct: "94.3", fdv: "2041000000000" },
  { rank: 2, coingecko_id: "ethereum", name: "Ethereum", symbol: "ETH", price_usd: "3560", market_cap: "428000000000", circulating: "120300000", total_supply: "120300000", max_supply: null, circulating_pct: "100.0", fdv: "428000000000" },
  { rank: 3, coingecko_id: "ripple", name: "XRP", symbol: "XRP", price_usd: "2.12", market_cap: "121000000000", circulating: "57100000000", total_supply: "99980000000", max_supply: "100000000000", circulating_pct: "57.1", fdv: "212000000000" },
  { rank: 4, coingecko_id: "solana", name: "Solana", symbol: "SOL", price_usd: "164.2", market_cap: "78400000000", circulating: "477000000", total_supply: "590000000", max_supply: null, circulating_pct: "80.8", fdv: "96900000000" },
  { rank: 5, coingecko_id: "dogecoin", name: "Dogecoin", symbol: "DOGE", price_usd: "0.192", market_cap: "28100000000", circulating: "146000000000", total_supply: "146000000000", max_supply: null, circulating_pct: "100.0", fdv: "28100000000" },
];

// ---------------- data: themes ----------------
export const themes: ThemeRow[] = [
  { id: 301, name: "AI / 반도체", market: "US", constituent_count: 12, unclassified_count: 0, low_confidence_count: 0 },
  { id: 302, name: "이더리움 L2", market: "CRYPTO", constituent_count: 8, unclassified_count: 0, low_confidence_count: 0 },
  { id: 303, name: "2차전지", market: "KR", constituent_count: 9, unclassified_count: 0, low_confidence_count: 3 },
  { id: 304, name: "밈코인", market: "CRYPTO", constituent_count: 6, unclassified_count: 0, low_confidence_count: 4 },
  { id: 305, name: "미분류", market: "CRYPTO", constituent_count: 14, unclassified_count: 14, low_confidence_count: 14 },
];

const themeConstituents: Record<string, ThemeConstituent[]> = {
  "301": [
    { instrument_ref: "NVDA", display_name: "NVIDIA", classification_source: "json_map", classification_confidence: "0.98" },
    { instrument_ref: "AAPL", display_name: "Apple", classification_source: "heuristic", classification_confidence: "0.61" },
  ],
  "302": [
    { instrument_ref: "ETH", display_name: "Ethereum", classification_source: "json_map", classification_confidence: "0.95" },
  ],
  "303": [
    { instrument_ref: "247540", display_name: "에코프로비엠", classification_source: "json_map", classification_confidence: "0.92" },
    { instrument_ref: "086520", display_name: "에코프로", classification_source: "heuristic", classification_confidence: "0.48" },
  ],
  "304": [
    { instrument_ref: "DOGE", display_name: "Dogecoin", classification_source: "heuristic", classification_confidence: "0.55" },
  ],
  "305": [],
};

export function getThemeConstituents(id: string): ThemeDetail | null {
  const t = themes.find((x) => String(x.id) === id);
  if (!t) return null;
  return { theme_id: t.id, market: String(t.market), name: t.name, items: themeConstituents[id] ?? [] };
}

// ---------------- data: funding arb (펀비차익) ----------------
export const fundingArb: FundingArbRow[] = [
  { rank: 1, symbol: "BTC", name: "비트코인", funding_pct: "0.0100", upbit_price: "142000000", bybit_price: "97180", next_funding_at: isoMinutesAgo(-185), expected1x_pct: "0.41", expected2x_pct: "0.82" },
  { rank: 2, symbol: "ETH", name: "이더리움", funding_pct: "0.0085", upbit_price: "5200000", bybit_price: "3558", next_funding_at: isoMinutesAgo(-185), expected1x_pct: "0.34", expected2x_pct: "0.68" },
  { rank: 3, symbol: "SOL", name: "솔라나", funding_pct: "0.0220", upbit_price: "240000", bybit_price: "164.0", next_funding_at: isoMinutesAgo(-185), expected1x_pct: "0.61", expected2x_pct: "1.22" },
  { rank: 4, symbol: "XRP", name: "리플", funding_pct: "-0.0050", upbit_price: "3100", bybit_price: "2.13", next_funding_at: isoMinutesAgo(-185), expected1x_pct: "-0.18", expected2x_pct: "-0.36" },
];

export const liquidations: LiquidationSnapshot = {
  connected: true,
  last_event_at: isoMinutesAgo(1),
  count: 5,
  total_notional_usd: "2845000",
  long_liquidation_usd: "1830000",
  short_liquidation_usd: "1015000",
  events: [
    { symbol: "BTCUSDT", base: "BTC", side: "SELL", position_side: "LONG", price: "96520.4", quantity: "12.4", notional_usd: "1196852.96", status: "FILLED", event_at: isoMinutesAgo(1) },
    { symbol: "ETHUSDT", base: "ETH", side: "BUY", position_side: "SHORT", price: "3521.8", quantity: "184.2", notional_usd: "648475.56", status: "FILLED", event_at: isoMinutesAgo(2) },
    { symbol: "SOLUSDT", base: "SOL", side: "SELL", position_side: "LONG", price: "161.42", quantity: "2270", notional_usd: "366343.40", status: "FILLED", event_at: isoMinutesAgo(3) },
    { symbol: "XRPUSDT", base: "XRP", side: "BUY", position_side: "SHORT", price: "2.119", quantity: "173000", notional_usd: "366587", status: "FILLED", event_at: isoMinutesAgo(4) },
    { symbol: "DOGEUSDT", base: "DOGE", side: "SELL", position_side: "LONG", price: "0.1921", quantity: "1380000", notional_usd: "265098", status: "FILLED", event_at: isoMinutesAgo(5) },
  ],
};

// ---------------- alerts / notifications ----------------
export const alerts: Alert[] = [
  { alert_id: "1", instrument_id: 1, symbol: "KRW-BTC", signal_type: "ABC", timeframe: "4h", market: "CRYPTO", enabled: true, cooldown_sec: 3600 },
  { alert_id: "3", instrument_id: 21, symbol: "005930", signal_type: "IMALOL", timeframe: "1d", market: "KOSPI", enabled: true, cooldown_sec: 14400 },
];

export const notifications: Notification[] = [
  { id: "ntf_1", status: "CREATED", title: "ABC 신호 임박 · KRW-BTC", body: "4h ABC 패턴이 완성에 근접했습니다.", created_at: isoMinutesAgo(35), read_at: null, signal_id: "sig_001", alert_id: "alt_1", instrument: { id: "ins_btc", symbol: "KRW-BTC" }, signal_type: "ABC" },
  { id: "ntf_3", status: "CREATED", title: "이말올 신호 · 삼성전자", body: "1d 이말올 패턴이 탐지되었습니다.", created_at: isoMinutesAgo(120), read_at: null, signal_id: "sig_005", alert_id: "alt_3", instrument: { id: "ins_005930", symbol: "005930" }, signal_type: "IMALOL" },
  { id: "ntf_4", status: "EXPIRED", title: "신호 만료 · KRW-ETH", body: "이말올 신호가 만료되었습니다.", created_at: isoMinutesAgo(2880), read_at: null, signal_id: "sig_008", alert_id: null, instrument: { id: "ins_eth", symbol: "KRW-ETH" }, signal_type: "IMALOL" },
];

// ---------------- system ----------------
export const systemStatus: SystemStatus = {
  providers: [
    { provider: "upbit", freshness: "FRESH", last_run_at: isoMinutesAgo(1) },
    { provider: "binance", freshness: "FRESH", last_run_at: isoMinutesAgo(1) },
    { provider: "coingecko", freshness: "FRESH", last_run_at: isoMinutesAgo(3) },
    { provider: "defillama", freshness: "FRESH", last_run_at: isoMinutesAgo(2) },
    { provider: "yfinance", freshness: "DELAYED", last_run_at: isoMinutesAgo(28) },
    { provider: "pykrx", freshness: "FRESH", last_run_at: isoMinutesAgo(5) },
    { provider: "bybit", freshness: "FRESH", last_run_at: isoMinutesAgo(2) },
  ],
  build_version: BUILD_VERSION,
  time: new Date().toISOString(),
};

// ---------------- backtest (백테스트) ----------------
// Compute the metrics block (same shape as BacktestResult.metrics) from a slice
// of trades. Decimals returned as strings. Used for full + IS/OOS slices.
function metricsFromTrades(trades: BacktestResult["trades"]): BacktestMetrics {
  let wins = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let equityVal = 1;
  for (const t of trades) {
    const r = Number(t.return_pct);
    if (!Number.isFinite(r)) continue;
    if (r >= 0) {
      wins++;
      grossWin += r;
    } else {
      grossLoss += Math.abs(r);
    }
    equityVal *= 1 + r / 100;
  }
  const returns = trades.map((t) => Number(t.return_pct)).filter((v) => Number.isFinite(v));
  const n = returns.length;
  const winRate = n ? (wins / n) * 100 : 0;
  const avgReturn = n ? returns.reduce((a, b) => a + b, 0) / n : 0;
  const totalReturn = (equityVal - 1) * 100;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;

  // Drawdown across the compounded equity path of this slice.
  let peak = 0;
  let maxDd = 0;
  let eq = 1;
  for (const r of returns) {
    eq *= 1 + r / 100;
    if (eq > peak) peak = eq;
    const dd = peak > 0 ? (eq - peak) / peak : 0;
    if (dd < maxDd) maxDd = dd;
  }

  return {
    trade_count: n,
    win_rate: winRate.toFixed(1),
    avg_return_pct: avgReturn.toFixed(2),
    total_return_pct: totalReturn.toFixed(1),
    profit_factor: profitFactor.toFixed(2),
    max_drawdown_pct: (maxDd * 100).toFixed(1),
    best_pct: n ? Math.max(...returns).toFixed(2) : null,
    worst_pct: n ? Math.min(...returns).toFixed(2) : null,
    avg_hold_bars: null,
  };
}

// Deterministic, realistic-looking seeded result for POST /backtests/run so the
// mock UI renders metrics + equity curve + trades. ~30 trades; decimals as strings.
export function runBacktest(input: {
  type?: string;
  market?: string;
  timeframe?: string;
  target_pct?: number;
  stop_pct?: number;
  horizon?: string;
  period_days?: number;
  fee_pct?: number;
  walk_forward?: boolean;
  is_ratio?: number;
}): BacktestResult {
  const type = input.type ?? "ABC";
  const market = input.market;
  const timeframe = input.timeframe ?? "1d";
  const target = input.target_pct ?? 5;
  const stop = input.stop_pct ?? 3;
  const fee = input.fee_pct ?? 0.1;
  const periodDays = input.period_days ?? 90;

  // Pick a candidate universe matching the requested market (fall back to all).
  const universe = instruments.filter((i) => !market || i.market === market);
  const pool = universe.length ? universe : instruments;

  // Seed from the params so identical requests are stable across SSR/CSR.
  const seedStr = `${type}|${market ?? "ALL"}|${timeframe}|${target}|${stop}|${periodDays}`;
  let seedNum = 0;
  for (let i = 0; i < seedStr.length; i++) seedNum = (seedNum * 31 + seedStr.charCodeAt(i)) % 2147483647;
  const rnd = seeded(seedNum + 7);

  const tradeCount = 28 + Math.floor(rnd() * 8); // ~28-35
  const trades: BacktestResult["trades"] = [];
  let wins = 0;
  let losses = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let cumReturn = 0;

  // Equity curve starts at 1.0 and compounds each trade's net return.
  const equity: BacktestResult["equity_curve"] = [];
  let equityVal = 1;
  const startMin = periodDays * 24 * 60;
  equity.push({ t: isoMinutesAgo(startMin), equity: "1.000" });

  for (let i = 0; i < tradeCount; i++) {
    const inst = pool[Math.floor(rnd() * pool.length)];
    const roll = rnd();
    let outcome: BacktestOutcome;
    let rawPct: number;
    if (roll < 0.6) {
      outcome = "WIN";
      rawPct = target * (0.7 + rnd() * 0.5); // near/above target
    } else if (roll < 0.88) {
      outcome = "LOSS";
      rawPct = -stop * (0.7 + rnd() * 0.5);
    } else {
      outcome = "TIME";
      rawPct = (rnd() - 0.5) * stop; // small +/- at horizon
    }
    const netPct = rawPct - fee; // subtract round-trip fee approximation
    if (netPct >= 0) {
      wins++;
      grossWin += netPct;
    } else {
      losses++;
      grossLoss += Math.abs(netPct);
    }
    cumReturn += netPct;
    equityVal *= 1 + netPct / 100;

    // Spread detected/exit times across the period (newest last).
    const detMin = startMin - Math.floor((startMin * (i + 1)) / (tradeCount + 1));
    const holdMin = (4 + Math.floor(rnd() * 12)) * 60;
    const entryPrice = Number(lastClose(String(inst.id), timeframe as Timeframe) ?? "100");
    const exitPrice = entryPrice * (1 + netPct / 100);

    trades.push({
      symbol: inst.symbol,
      name: inst.name ?? null,
      detected_at: isoMinutesAgo(detMin + holdMin),
      entry: entryPrice.toFixed(2),
      exit: exitPrice.toFixed(2),
      return_pct: netPct.toFixed(2),
      outcome,
      exit_at: isoMinutesAgo(Math.max(detMin, 0)),
    });
    equity.push({ t: isoMinutesAgo(Math.max(detMin, 0)), equity: equityVal.toFixed(3) });
  }

  // Drawdown across the equity curve.
  let peak = 0;
  let maxDd = 0;
  for (const p of equity) {
    const v = Number(p.equity);
    if (v > peak) peak = v;
    const dd = peak > 0 ? (v - peak) / peak : 0;
    if (dd < maxDd) maxDd = dd;
  }

  const returns = trades.map((t) => Number(t.return_pct));
  const winRate = trades.length ? (wins / trades.length) * 100 : 0;
  const avgReturn = trades.length ? cumReturn / trades.length : 0;
  const totalReturn = (equityVal - 1) * 100;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;
  const avgHold = 4 + Math.floor(rnd() * 8);

  // Walk-forward (IS/OOS): split trades chronologically (oldest = in-sample).
  // Trades were appended oldest-first, so a leading slice is the in-sample set.
  let walkForward: BacktestResult["walk_forward"] = null;
  if (input.walk_forward) {
    const ratio = Math.min(0.9, Math.max(0.5, input.is_ratio ?? 0.7));
    const splitIdx = Math.max(1, Math.min(trades.length - 1, Math.round(trades.length * ratio)));
    const isTrades = trades.slice(0, splitIdx);
    const oosTrades = trades.slice(splitIdx);
    const inSample = metricsFromTrades(isTrades);
    const outOfSample = metricsFromTrades(oosTrades);
    inSample.avg_hold_bars = avgHold;
    outOfSample.avg_hold_bars = avgHold;
    // Overfit warning: OOS win rate collapses well below IS, or OOS turns
    // negative while IS was positive. Deterministic from the seeded metrics.
    const isWin = Number(inSample.win_rate);
    const oosWin = Number(outOfSample.win_rate);
    const isTotal = Number(inSample.total_return_pct);
    const oosTotal = Number(outOfSample.total_return_pct);
    const overfit = isWin - oosWin >= 15 || (isTotal > 0 && oosTotal < 0);
    // The split timestamp is the boundary trade's exit (UTC ISO).
    const splitAt = oosTrades[0]?.detected_at ?? isTrades.at(-1)?.exit_at ?? equity.at(-1)?.t ?? null;
    walkForward = {
      is_ratio: ratio.toFixed(2),
      split_at: splitAt,
      in_sample: inSample,
      out_of_sample: outOfSample,
      overfit_warning: overfit,
    };
  }

  return {
    params: {
      type,
      market: market ?? null,
      timeframe,
      target_pct: target,
      stop_pct: stop,
      horizon: input.horizon ?? "1d",
      period_days: periodDays,
      fee_pct: fee,
    },
    metrics: {
      trade_count: trades.length,
      win_rate: winRate.toFixed(1),
      avg_return_pct: avgReturn.toFixed(2),
      total_return_pct: totalReturn.toFixed(1),
      profit_factor: profitFactor.toFixed(2),
      max_drawdown_pct: (maxDd * 100).toFixed(1),
      best_pct: returns.length ? Math.max(...returns).toFixed(2) : null,
      worst_pct: returns.length ? Math.min(...returns).toFixed(2) : null,
      avg_hold_bars: avgHold,
    },
    equity_curve: equity,
    trades,
    walk_forward: walkForward,
  };
}

// ---------------- saved strategies (전략 저장/불러오기) ----------------
// In-memory mutable list so save/delete persist for the session in mock mode.
// Seeded with a couple of examples (metrics snapshots from a representative run).
export const strategies: Strategy[] = [
  {
    id: "stg_2",
    name: "ABC 코인 1d 공격형",
    type: "ABC",
    market: "CRYPTO",
    timeframe: "1d",
    params: {
      type: "ABC",
      market: "CRYPTO",
      timeframe: "1d",
      target_pct: 8,
      stop_pct: 4,
      horizon: "3d",
      period_days: 120,
      fee_pct: 0.1,
    },
    metrics: {
      trade_count: 31,
      win_rate: "61.3",
      avg_return_pct: "1.42",
      total_return_pct: "38.7",
      profit_factor: "1.84",
      max_drawdown_pct: "-12.4",
      best_pct: "9.10",
      worst_pct: "-4.20",
      avg_hold_bars: 9,
    },
    created_at: isoMinutesAgo(60 * 24 * 2),
  },
];

let strategySeq = 100;

export function listStrategies(): Strategy[] {
  // Newest-first.
  return [...strategies].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function getStrategy(id: string): Strategy | null {
  return strategies.find((s) => String(s.id) === id) ?? null;
}

export function createStrategy(input: {
  name?: string;
  params?: BacktestParams;
  metrics?: BacktestResult["metrics"] | null;
}): Strategy {
  const params = input.params ?? ({ type: "ABC", target_pct: 5, stop_pct: 3, horizon: "1d" } as BacktestParams);
  const strat: Strategy = {
    id: `stg_${++strategySeq}`,
    name: input.name?.trim() || "이름 없는 전략",
    type: params.type,
    market: params.market ?? null,
    timeframe: params.timeframe ?? null,
    params,
    metrics: input.metrics ?? null,
    created_at: new Date().toISOString(),
  };
  strategies.push(strat);
  return strat;
}

export function deleteStrategy(id: string): boolean {
  const idx = strategies.findIndex((s) => String(s.id) === id);
  if (idx < 0) return false;
  strategies.splice(idx, 1);
  return true;
}

// ---------------- strategy run history (성과 히스토리) ----------------
// In-memory snapshots keyed by strategy id, oldest-first per key. Seeded with a
// few runs for the example strategy so the sparkline renders without a re-run.
const strategyRuns: Record<string, StrategyRun[]> = {};
let strategyRunSeq = 500;

function snapshotFrom(strategyId: string, metrics: BacktestMetrics, runAt: string): StrategyRun {
  return {
    id: `run_${++strategyRunSeq}`,
    strategy_id: strategyId,
    metrics,
    trade_count: metrics.trade_count ?? 0,
    total_return_pct: metrics.total_return_pct ?? null,
    win_rate: metrics.win_rate ?? null,
    run_at: runAt,
  };
}

// Seed a short history for the example strategy (oldest-first).
(function seedRuns() {
  const seed = strategies[0];
  if (!seed) return;
  const base = [
    { total_return_pct: "21.4", win_rate: "54.8", trade_count: 29, days: 9 },
    { total_return_pct: "29.8", win_rate: "58.1", trade_count: 30, days: 6 },
    { total_return_pct: "34.2", win_rate: "59.4", trade_count: 31, days: 3 },
    { total_return_pct: "38.7", win_rate: "61.3", trade_count: 31, days: 1 },
  ];
  strategyRuns[String(seed.id)] = base.map((b) =>
    snapshotFrom(
      String(seed.id),
      { ...(seed.metrics ?? { trade_count: b.trade_count }), trade_count: b.trade_count, total_return_pct: b.total_return_pct, win_rate: b.win_rate },
      isoMinutesAgo(60 * 24 * b.days),
    ),
  );
})();

// Newest-first, capped at `limit`.
export function getStrategyHistory(id: string, limit = 30): StrategyRun[] {
  const runs = strategyRuns[id] ?? [];
  return [...runs]
    .sort((a, b) => new Date(b.run_at).getTime() - new Date(a.run_at).getTime())
    .slice(0, limit);
}

// Re-run a saved strategy now: replay its params through runBacktest, append a
// snapshot to history, and refresh the strategy's stored metrics. Returns the
// new snapshot (null if the strategy does not exist).
export function runStrategy(id: string): StrategyRun | null {
  const strat = strategies.find((s) => String(s.id) === id);
  if (!strat) return null;
  const p = strat.params;
  const result = runBacktest({
    type: String(p.type),
    market: p.market != null ? String(p.market) : undefined,
    timeframe: p.timeframe != null ? String(p.timeframe) : undefined,
    target_pct: p.target_pct != null ? Number(p.target_pct) : undefined,
    stop_pct: p.stop_pct != null ? Number(p.stop_pct) : undefined,
    horizon: p.horizon,
    period_days: p.period_days != null ? Number(p.period_days) : undefined,
    fee_pct: p.fee_pct != null ? Number(p.fee_pct) : undefined,
  });
  // Nudge the seed so successive runs differ slightly (history isn't flat).
  const runCount = (strategyRuns[id]?.length ?? 0) + 1;
  const drift = seeded(strategyRunSeq + runCount * 13)();
  const m: BacktestMetrics = {
    ...result.metrics,
    total_return_pct: (Number(result.metrics.total_return_pct ?? 0) + (drift - 0.5) * 6).toFixed(1),
    win_rate: Math.min(99, Math.max(1, Number(result.metrics.win_rate ?? 0) + (drift - 0.5) * 4)).toFixed(1),
  };
  const snap = snapshotFrom(id, m, new Date().toISOString());
  (strategyRuns[id] ??= []).push(snap);
  strat.metrics = m; // latest run becomes the strategy's displayed snapshot
  return snap;
}

export { instrumentById };
