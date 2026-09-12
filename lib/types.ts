// All entities mirror the shared API contract (docs/API_CONTRACT.md v2).
// JSON keys are snake_case. Prices/quantities/scores are STRING decimals.
// Times are ISO-8601 UTC strings ("...Z").

// ----- enums (contract v2) -----
export type Market = "CRYPTO" | "US" | "KOSPI" | "KOSDAQ";

// Coin: 15m/1h/4h/1d/3d/1w/1M ; Stock: 1d/3d/1w. Server returns the supported set per market.
export type Timeframe = "15m" | "1h" | "4h" | "1d" | "3d" | "1w" | "1M";

export type SignalType = "ABC" | "TOP" | "IMALOL";

export type SignalStatus =
  | "DETECTED"
  | "NEAR_COMPLETION"
  | "INVALIDATED"
  | "EXPIRED"
  | "CLOSED";

export type EvidenceType =
  | "PIVOT_0"
  | "PIVOT_A"
  | "PIVOT_B"
  | "C_TARGET"
  | "TREND_UPPER"
  | "TREND_LOWER"
  | "BOLL_UPPER"
  | "BOLL_MID"
  | "BOLL_LOWER"
  | "MATCH_BOX";


// Wire value stays "TELEGRAM" (backend collects the Coinness telegram channel),
// but the UI surfaces it as "코인니스" — see newsSourceLabel().
export type NewsSource = "TELEGRAM" | "BLOOMBERG";
export function newsSourceLabel(source: NewsSource): string {
  return source === "TELEGRAM" ? "코인니스" : "Bloomberg";
}

export type TvlMode = "PROTOCOL" | "CHAIN";

export type NotificationStatus =
  | "CREATED"
  | "SENT"
  | "READ"
  | "EXPIRED"
  | "FAILED";

export type Freshness = "FRESH" | "DELAYED";
export type InstrumentStatus = "ACTIVE" | "INACTIVE" | "DELISTED";
export type UserStatus = "PENDING" | "APPROVED" | "LOCKED";

export const COIN_TIMEFRAMES: Timeframe[] = ["15m", "1h", "4h", "1d", "3d", "1w", "1M"];
export const STOCK_TIMEFRAMES: Timeframe[] = ["1d", "3d", "1w"];
export function timeframesForMarket(market?: Market): Timeframe[] {
  return market === "CRYPTO" || market == null ? COIN_TIMEFRAMES : STOCK_TIMEFRAMES;
}

// ----- envelope -----
export interface ApiMeta {
  trace_id?: string;
  freshness?: Freshness;
  next_cursor?: string | null;
  unread_count?: number;
  partial?: boolean;
  [k: string]: unknown;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiFieldError {
  field: string;
  reason: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  trace_id?: string;
  field_errors?: ApiFieldError[];
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

// ----- domain entities -----
export interface User {
  id: string | number;
  email: string;
  role: string;
  status: UserStatus;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

// ----- public content: weekly performance report (/public/reports/weekly) -----
export interface WeeklyReportOverall {
  sample_size: number;
  hit_rate: string;
  avg_return_pct: string;
}

export interface WeeklyReportRow {
  type: string;
  market: string;
  timeframe: string;
  sample_size: number;
  hit_rate: string;
  avg_return_pct: string;
  median_return_pct: string;
}

export interface WeeklyReportHighlight {
  kind: "BEST" | "WORST";
  label: string;
  type: string;
  market: string;
  timeframe: string;
  sample_size: number;
  hit_rate: string;
  avg_return_pct: string;
}

export interface WeeklyReport {
  generated_at: string;
  window_days: number;
  horizon: string;
  overall: WeeklyReportOverall;
  rows: WeeklyReportRow[];
  highlights: WeeklyReportHighlight[];
  disclaimer: string;
}

// ----- macro / market regime (/macro) -----
export interface MacroSignal {
  key: string;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  detail: string;
}

export interface MacroRegime {
  label: "BULL" | "BEAR" | "RANGE" | "TRANSITION";
  score: number;
  summary: string;
  signals: MacroSignal[];
}

export interface MacroYieldCurve {
  tenor3m: string | null;
  tenor2y: string | null;
  tenor10y: string | null;
  spread10y2y: string | null;
  spread10y3m: string | null;
  inverted: boolean | null;
  as_of: string | null;
}

export interface MacroSnapshot {
  regime: MacroRegime;
  yield_curve: MacroYieldCurve | null;
  m2: { value: string; yoy_pct: string | null; as_of: string } | null;
  dxy: { value: string; trend: string; as_of: string } | null;
  generated_at: string;
  sources: string[];
}

// ----- economic calendar (/macro/calendar) -----
export type EconomicEventType = "FOMC" | "CPI" | "EMPLOYMENT" | "EARNINGS";

export interface EconomicEvent {
  date: string; // yyyy-mm-dd
  dday: number; // 오늘 기준 D±n (양수=예정, 0=당일, 음수=경과)
  type: EconomicEventType;
  title: string;
  region: string; // US | GLOBAL
  impact: string; // HIGH | MEDIUM
}

export interface MacroCalendar {
  events: EconomicEvent[];
  generated_at: string;
}

// ----- signal event risk (신호 상세의 이벤트 리스크 라벨) -----
export interface EventRiskItem {
  date: string;
  dday: number;
  type: EconomicEventType;
  title: string;
}

export interface SignalEventRisk {
  active: boolean;
  level: "HIGH" | "MEDIUM";
  confidence_delta: number;
  note: string;
  events: EventRiskItem[];
}

// ----- public signup (/auth/signup) -----
export interface SignupInput {
  email: string;
  password: string;
  signup_source?: string;
  signup_referrer?: string;
}

export interface SignupResponse {
  status: UserStatus;
  user: User;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

// Backend returns numeric ids for instruments (e.g. 4). We keep id as
// string|number to tolerate both, and normalize to a path-safe string via
// instrumentPathId() before building /instruments/{id} URLs.
export interface Instrument {
  id: string | number;
  symbol: string;
  name?: string | null;
  exchange: string;
  market: Market;
  quote_currency: string;
  status: InstrumentStatus;
}

// ----- id normalization -----
// The signals LIST returns prefixed ids ("sig_169", "ins_4") but the detail /
// candle / instrument endpoints expect the bare NUMERIC id ("169", "4").
// Strip a leading "<prefix>_" so navigation works against the real backend.
export function stripIdPrefix(id: string | number | null | undefined): string {
  if (id == null) return "";
  const s = String(id);
  const m = s.match(/^[a-zA-Z]+_(.+)$/);
  return m ? m[1] : s;
}
// Path id for signal detail (numeric) — backend 500s on the "sig_" prefix.
export const signalPathId = stripIdPrefix;
// Path id for instrument detail / candles / indicators (numeric).
export const instrumentPathId = stripIdPrefix;

// OHLCV — all numeric fields are string decimals; open_time is UTC ISO.
export interface Candle {
  open_time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  is_final?: boolean;
}

// GET /instruments/{id}/candles -> data is { candles, provider, freshness }.
// NOTE: backend does NOT nest instrument/timeframe inside data.
export interface CandleResponse {
  candles: Candle[];
  provider?: string | null;
  freshness?: Freshness;
}

// indicators summary — backend keys: rsi14 / ma5/20/60/120 /
// boll_upper/middle/lower / macd / macd_signal / macd_histogram.
export interface IndicatorSummary {
  timeframe: Timeframe;
  rsi14?: string | null;
  ma5?: string | null;
  ma20?: string | null;
  ma60?: string | null;
  ma120?: string | null;
  boll_upper?: string | null;
  boll_middle?: string | null;
  boll_lower?: string | null;
  macd?: string | null;
  macd_signal?: string | null;
  macd_histogram?: string | null;
}

// Nested instrument ref on a signal — { id: "ins_4", symbol: "KRW-SOL" }.
export interface InstrumentRef {
  id: string | number;
  symbol: string;
  name?: string | null;
  market?: Market;
}

// pivots summary on the signal card — { pivot0, pivot_a, pivot_b } (often null).
export interface PivotsSummary {
  pivot0?: unknown;
  pivot_a?: unknown;
  pivot_b?: unknown;
}

export interface Signal {
  id: string;
  type: SignalType;
  status: SignalStatus;
  instrument: InstrumentRef;
  market: Market;
  timeframe: Timeframe;
  detected_at: string;
  score?: string | null;
  current_price?: string | null;
  c_target?: string | null; // ABC / TOP
  subtype?: string | null;
  pivots?: PivotsSummary | null;
  freshness?: Freshness;
}

// Evidence payload arrives as a JSON STRING (e.g. "{\"idx\": 141}").
export interface Evidence {
  type: EvidenceType | string;
  candle_time?: string | null;
  price?: string | null;
  sequence_no?: number;
  payload?: string | Record<string, unknown> | null;
}

// Backend may return invalidation as null. Shape (when present) is best-effort.
export interface Invalidation {
  rule?: string | null;
  price?: string | null;
}

export interface ChartRange {
  from: string;
  to: string;
}

export interface SignalDetail extends Signal {
  evidence: Evidence[];
  invalidation?: Invalidation | null;
  chart_range?: ChartRange | null;
  algorithm_version?: string | null;
  event_risk?: SignalEventRisk | null;
}

// ----- signal performance (성과) -----
// All decimals arrive as STRINGS; format only at display. Times are UTC ISO.
// horizons may be EMPTY when the signal is too fresh to evaluate.
export interface SignalPerformanceHorizon {
  horizon: string; // "1h" | "4h" | "1d" | "3d" | "7d"
  price?: string | null;
  return_pct?: string | null;
  mfe_pct?: string | null; // max favorable excursion
  mae_pct?: string | null; // max adverse excursion
  evaluated_at?: string | null;
}

export interface SignalPerformance {
  signal_id: string;
  detected_price?: string | null;
  detected_at?: string | null;
  horizons: SignalPerformanceHorizon[];
}

// GET /signals/performance/summary -> array of per-pattern aggregate rows.
export interface SignalPerformanceSummaryRow {
  type: SignalType | string;
  market: Market | string;
  timeframe: Timeframe | string;
  horizon: string;
  sample_size: number;
  hit_rate?: string | null;
  avg_return_pct?: string | null;
  median_return_pct?: string | null;
  avg_mfe_pct?: string | null;
  avg_mae_pct?: string | null;
}

export interface SignalScoreFactor {
  key: string;
  label: string;
  score: number;
  max_score: number;
  detail: string;
}

export interface SignalConfidence {
  grade: "INSUFFICIENT" | "LOW" | "MEDIUM" | "HIGH";
  sample_size: number;
  hit_rate?: string | null;
  avg_return_pct?: string | null;
  horizon: string;
}

export interface SignalExplain {
  signal_id: string;
  pattern_score: number;
  risk_guard: "PASS" | "WARN" | "BLOCK";
  factors: SignalScoreFactor[];
  reasons: string[];
  risks: string[];
  next_checks: string[];
  confidence: SignalConfidence;
  template_version: string;
}

export interface ExplainFeedbackSummary {
  total_count: number;
  helpful_count: number;
  helpful_rate?: string | null;
  my_helpful?: boolean | null;
  my_reason?: string | null;
}

export type ConditionIndicator = "RSI" | "VOLUME_RATIO" | "PRICE" | "MA5" | "MACD_HISTOGRAM";
export type ConditionOperator = "<" | "<=" | ">" | ">=";

export interface ScannerCondition {
  indicator: ConditionIndicator;
  operator: ConditionOperator;
  value?: string | null;
  target?: "MA20" | null;
}

export interface ConditionScanRequest {
  market: Market;
  timeframe: Timeframe;
  logic: "AND" | "OR";
  conditions: ScannerCondition[];
}

export interface ConditionScanMatch {
  instrument_id: number;
  symbol: string;
  name?: string | null;
  market: Market;
  price: string;
  rsi14: string;
  volume_ratio?: string | null;
  ma5: string;
  ma20: string;
  macd_histogram: string;
  matched_conditions: string[];
}

export interface ConditionScanResult {
  evaluated_count: number;
  matched_count: number;
  items: ConditionScanMatch[];
}

export interface ScannerRule extends ConditionScanRequest {
  id: number;
  name: string;
  enabled: boolean;
  created_at: string;
  latest_run?: ScannerRuleRun | null;
}

export interface ScannerRuleRun {
  id: number;
  evaluated_count: number;
  matched_count: number;
  match_rate: string;
  frequency_grade: "LOW" | "MEDIUM" | "HIGH";
  notification_count: number;
  created_at: string;
}

export interface ScannerRuleSimulation {
  rule_id: number;
  evaluated_count: number;
  matched_count: number;
  match_rate: string;
  frequency_grade: "LOW" | "MEDIUM" | "HIGH";
  sample_items: ConditionScanMatch[];
}

// ----- backtest (백테스트) -----
// POST /backtests/run. All decimal metrics arrive as STRINGS; format only at
// display. Times are UTC ISO ("...Z"). Every field is optional/null-safe.
export type BacktestOutcome = "WIN" | "LOSS" | "TIME";

export interface BacktestParams {
  type: SignalType | string;
  market?: Market | string | null;
  timeframe?: Timeframe | string | null;
  target_pct: number | string;
  stop_pct: number | string;
  horizon: string;
  period_days?: number | null;
  fee_pct?: number | string | null;
}

export interface BacktestMetrics {
  trade_count: number;
  win_rate?: string | null;
  avg_return_pct?: string | null;
  total_return_pct?: string | null;
  profit_factor?: string | null;
  max_drawdown_pct?: string | null;
  best_pct?: string | null;
  worst_pct?: string | null;
  avg_hold_bars?: number | null;
}

export interface BacktestEquityPoint {
  t: string; // UTC ISO
  equity: string; // decimal string, base 1.0
}

export interface BacktestTrade {
  symbol: string;
  name?: string | null;
  detected_at?: string | null;
  entry?: string | null;
  exit?: string | null;
  return_pct?: string | null;
  outcome?: BacktestOutcome | string | null;
  exit_at?: string | null;
}

// Walk-forward (IS/OOS) validation block. Present only when the run requested
// walk_forward; null/absent otherwise. is_ratio is a STRING decimal (e.g. "0.7"),
// split_at is a UTC ISO ("...Z"). in_sample / out_of_sample reuse BacktestMetrics.
export interface BacktestWalkForward {
  is_ratio?: string | null;
  split_at?: string | null;
  in_sample: BacktestMetrics;
  out_of_sample: BacktestMetrics;
  overfit_warning?: boolean | null;
}

export interface BacktestResult {
  params?: BacktestParams;
  metrics: BacktestMetrics;
  equity_curve: BacktestEquityPoint[];
  trades: BacktestTrade[];
  walk_forward?: BacktestWalkForward | null;
}

// ----- paper trading -----
export interface PaperAccount {
  id: string;
  base_currency: string;
  initial_balance: string;
  cash_balance: string;
  status: string;
  simulation_run: number;
}

export interface PaperFill {
  id: string;
  price: string;
  quantity: string;
  fee: string;
  slippage: string;
  liquidity_source: string;
  filled_at: string;
}

export interface PaperOrder {
  id: string;
  account_id: string;
  instrument_id: number;
  signal_id?: number | null;
  investment_type: "SPOT" | "FUTURES" | string;
  position_side?: "LONG" | "SHORT" | string | null;
  side: "BUY" | "SELL" | string;
  type: "MARKET" | "LIMIT" | string;
  price?: string | null;
  quantity: string;
  leverage: string;
  reduce_only: boolean;
  status: string;
  fill?: PaperFill | null;
}

export interface PaperPosition {
  instrument_id: number;
  symbol?: string | null;
  name?: string | null;
  quantity: string;
  investment_type: "SPOT" | "FUTURES" | string;
  position_side?: "LONG" | "SHORT" | string | null;
  avg_price: string;
  mark_price: string;
  market_value: string;
  margin: string;
  leverage: string;
  unrealized_pnl: string;
  realized_pnl: string;
}

export interface PaperPortfolio {
  account: PaperAccount;
  equity: string;
  unrealized_pnl: string;
  realized_pnl: string;
  positions: PaperPosition[];
  recent_orders: PaperOrder[];
}

export interface PaperPerformance {
  account_id: string;
  total_return_pct: string;
  equity: string;
  realized_pnl: string;
  unrealized_pnl: string;
  open_positions: number;
}

// ----- saved strategies (전략 저장/불러오기) -----
// A saved backtest configuration. `params` mirrors BacktestParams (the form
// inputs); `metrics` is the snapshot taken when the strategy was saved (may be
// null when saved without a prior run). snake_case wire fields; decimals in
// metrics arrive as STRINGS and are formatted only at display.
export interface Strategy {
  id: string | number;
  name: string;
  type: SignalType | string;
  market?: Market | string | null;
  timeframe?: Timeframe | string | null;
  params: BacktestParams;
  metrics?: BacktestMetrics | null;
  created_at: string;
}

// A single re-run snapshot of a saved strategy. POST /strategies/{id}/run
// returns one; GET /strategies/{id}/history returns them newest-first. Decimal
// metrics arrive as STRINGS; format only at display. run_at is a UTC ISO string.
export interface StrategyRun {
  id: string | number;
  strategy_id: string | number;
  metrics?: BacktestMetrics | null;
  trade_count: number;
  total_return_pct?: string | null;
  win_rate?: string | null;
  run_at: string;
}

// ----- watchlist -----
export interface WatchlistItem {
  instrument: Instrument;
  created_at: string;
  last_price?: string | null;
  last_price_at?: string | null;
  recent_signal?: Signal | null;
  price_error?: boolean; // partial failure marker
}

export interface Watchlist {
  id: string;
  name: string;
  items: WatchlistItem[];
}

// ----- market terminal -----
// GET /market/indices -> data is an ARRAY keyed by `key`, NOT an object.
export type IndexKey =
  | "FEAR_GREED"
  | "BTC_DOMINANCE"
  | "USDT_DOMINANCE"
  | "ALT_INDEX"
  | "NASDAQ"
  | "KOSPI"
  | "KOSDAQ";

export interface MarketIndexRow {
  key: IndexKey | string;
  value: string;
  classification?: string | null;
  collected_at?: string | null;
}

// Convenience lookup built from the array.
export type IndicesMap = Partial<Record<string, MarketIndexRow>>;
export function indicesByKey(rows?: MarketIndexRow[] | null): IndicesMap {
  const map: IndicesMap = {};
  for (const r of rows ?? []) map[r.key] = r;
  return map;
}

export interface KimchiPremiumRow {
  instrument_id: string | number;
  symbol: string;
  name?: string | null;
  upbit_price: string;
  binance_price: string;
  usdkrw: string;
  premium_pct: string;
  pinned?: boolean;
}

// ----- news -----
// id is numeric; title may be null (body is the primary text, may be a
// JSON-array-ish string the UI shows verbatim).
export type NewsSentiment = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

export interface NewsItem {
  id: string | number;
  source: NewsSource;
  title?: string | null;
  body?: string | null;
  url: string;
  published_at: string;
  is_new?: boolean;
  // News-level sentiment + coins the item is tagged with (e.g. ["KRW-BTC"]).
  // Both optional/null-safe: missing sentiment -> no badge; empty tags -> no chips.
  sentiment?: NewsSentiment | null;
  tagged_symbols?: string[];
  // Each tagged symbol paired with its CRYPTO instrument id (null if unresolved).
  // Preferred over tagged_symbols for navigation (deep-link to /instruments/{id}).
  tagged_instruments?: { symbol: string; instrument_id?: number | null }[];
}

// ----- scalp (틱띄기) -----
export interface ScalpRankRow {
  rank?: number;
  symbol: string;
  name?: string | null;
  scalp_score: string;
  spread_ticks: string;
  tps: string;
  micro_vol: string;
  ob_imbalance: string;
  wall_state: string;
}

// One combined level row (ask + bid side at the same depth).
export interface ScalpLevel {
  ask_price: string;
  ask_size: string;
  bid_price: string;
  bid_size: string;
}

// GET /scalp/{symbol} -> flat fields + top_levels[].
export interface ScalpDetail {
  symbol: string;
  name?: string | null;
  scalp_score: string;
  spread_ticks?: string;
  tps?: string;
  micro_vol?: string;
  ob_imbalance?: string;
  wall_state: string;
  wall_cancel_warning?: boolean;
  buy_ratio?: string | null;
  sell_ratio?: string | null;
  recent_trade_count?: number;
  top_levels?: ScalpLevel[];
  collected_at?: string | null;
}

// ----- data: tvl / supply / theme / funding -----
// `chains` is a COMMA-SEPARATED STRING; change fields are change1d/change7d.
export interface TvlRow {
  id: string | number;
  rank: number;
  entity_type?: "PROTOCOL" | "CHAIN" | string;
  name: string;
  category?: string | null;
  chains?: string | null;
  tvl: string;
  mcap?: string | null;
  change1d?: string | null;
  change7d?: string | null;
}

// History points use `t` (UTC ISO) for the timestamp.
export interface TvlHistoryPoint {
  t: string;
  tvl: string;
}

export interface TvlHistory {
  id: string | number;
  name: string;
  points: TvlHistoryPoint[];
}

export interface SupplyRow {
  rank: number;
  coingecko_id: string;
  name: string;
  symbol: string;
  price_usd: string;
  market_cap: string;
  circulating: string;
  total_supply?: string | null;
  max_supply?: string | null;
  circulating_pct: string;
  fdv?: string | null;
}

// GET /themes -> counts come as numbers (unclassified_count / low_confidence_count).
export interface ThemeRow {
  id: string | number;
  name: string;
  market: Market | "KR" | string;
  constituent_count: number;
  unclassified_count?: number;
  low_confidence_count?: number;
}

// Constituent items reference instruments by `instrument_ref` (a symbol/string),
// not a navigable numeric id.
export interface ThemeConstituent {
  instrument_ref: string;
  display_name?: string | null;
  classification_source: string;
  classification_confidence: string;
}

export interface ThemeDetail {
  theme_id: string | number;
  market?: string;
  name: string;
  items: ThemeConstituent[];
}

export interface FundingArbRow {
  rank?: number;
  symbol: string;
  name?: string | null;
  funding_pct: string;
  upbit_price: string;
  bybit_price: string;
  next_funding_at: string;
  expected1x_pct: string;
  expected2x_pct: string;
}

// ----- market: fear & greed history -----
// GET /market/fear-greed/history -> ascending by date; value/classification per day.
export interface FearGreedPoint {
  date: string; // "2026-06-13"
  value: string;
  classification?: string | null;
}

// ----- derivatives (파생) -----
export interface Derivative {
  symbol: string;
  perp?: string | null;
  mark_price?: string | null;
  funding_rate?: string | null; // raw rate, e.g. "0.0001" -> 0.01%
  next_funding_at?: string | null;
  open_interest?: string | null;
  oi_value_usd?: string | null;
  long_short_ratio?: string | null;
}

// History points use `t` (UTC ISO) like other history endpoints.
export interface DerivativeLsPoint {
  t: string;
  ratio: string;
}
export interface DerivativeOiPoint {
  t: string;
  oi: string;
}
export interface DerivativeDetail extends Derivative {
  long_short_history?: DerivativeLsPoint[];
  oi_history?: DerivativeOiPoint[];
}

// ----- liquidations (Binance force-order stream) -----
export interface LiquidationEvent {
  symbol: string;
  base: string;
  side: "BUY" | "SELL" | string;
  position_side: "LONG" | "SHORT" | string;
  price: string;
  quantity: string;
  notional_usd: string;
  status?: string | null;
  event_at: string;
}

export interface LiquidationSnapshot {
  connected: boolean;
  last_event_at?: string | null;
  count: number;
  total_notional_usd: string;
  long_liquidation_usd: string;
  short_liquidation_usd: string;
  events: LiquidationEvent[];
}

export interface LiquidationWindowSummary {
  window: "1h" | "24h" | string;
  count: number;
  total_notional_usd: string;
  long_liquidation_usd: string;
  short_liquidation_usd: string;
  max_event_usd: string;
  partial: boolean;
}

export interface LiquidationAggregation {
  connected: boolean;
  last_event_at?: string | null;
  windows: LiquidationWindowSummary[];
  spike: {
    level: "NORMAL" | "MEDIUM" | "HIGH" | string;
    recent5m_usd: string;
    baseline5m_usd: string;
    ratio: string;
  };
}

// ----- market: global (전역 시가총액) -----
// GET /market/global -> aggregate market figures. All decimals arrive as
// STRINGS; active_cryptos is a number. Every field is optional/null-safe.
export interface GlobalMarket {
  total_market_cap_usd?: string | null;
  total_volume_usd?: string | null;
  market_cap_change24h_pct?: string | null;
  active_cryptos?: number | null;
  btc_dominance?: string | null;
  eth_dominance?: string | null;
}

// ----- market: movers (급등락) -----
export type MoverType = "GAINERS" | "LOSERS" | "VOLUME";
export interface Mover {
  symbol: string; // e.g. "KRW-BTC"
  name?: string | null;
  price?: string | null;
  change_rate?: string | null; // percent, e.g. "5.23"
  trade_value24h?: string | null;
  // Navigable numeric instrument id (nullable) — present enables deep-linking
  // the row to /instruments/{id}.
  instrument_id?: number | null;
}

// ----- market: trending (CoinGecko) -----
// GET /market/trending -> top trending coins. rank/market_cap_rank are numbers;
// price_btc is a STRING decimal. thumb is a small image URL (may be null/empty).
export interface Trending {
  rank: number;
  coingecko_id: string;
  symbol: string;
  name: string;
  market_cap_rank?: number | null;
  thumb?: string | null;
  price_btc?: string | null;
}

// ----- alerts / notifications -----
export interface Alert {
  alert_id: string;
  enabled: boolean;
  instrument_id: number;
  symbol?: string | null;
  signal_type: SignalType;
  timeframe?: Timeframe | null;
  market?: Market | null;
  cooldown_sec: number;
}

export interface Notification {
  id: string | number;
  status: NotificationStatus;
  title?: string | null;
  body?: string | null;
  created_at: string;
  read_at?: string | null;
  signal_id?: string | number | null;
  alert_id?: string | number | null;
  instrument?: InstrumentRef | null;
  signal_type?: SignalType | null;
}

export interface WebPushConfig {
  enabled: boolean;
  public_key?: string | null;
}

// ----- 구독 엔타이틀먼트 (GET /me/entitlements, Track C R52) -----
export interface EntitlementFeature {
  key: string;
  label: string;
  limit: number; // -1 = 무제한
}

export interface Entitlements {
  tier: "FREE" | "PRO" | string;
  pro: boolean;
  features: EntitlementFeature[];
}

// ----- 온보딩 "시작하기" 체크리스트 (GET /me/onboarding) -----
export interface OnboardingStep {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

export interface OnboardingStatus {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  all_done: boolean;
  dismissed: boolean;
}

// ----- 알림 다이제스트 · 읽기 시점 요약 (GET /notifications/digest) -----
export interface NotificationDigestCategory {
  category: "SIGNAL" | "SCANNER" | "LIQUIDATION" | "SYSTEM" | string;
  label: string;
  total: number;
  unread: number;
}

export interface NotificationDigest {
  window_hours: number;
  generated_at: string;
  total: number;
  unread: number;
  released: number; // 조용한 시간에 보류됐다 창 안에 방출된 건수(R51)
  categories: NotificationDigestCategory[];
  recent: Notification[];
  summary: string;
}

// ----- system -----
// GET /system/status -> { build_version, time, providers:[{provider, freshness, last_run_at}] }.
export interface ProviderStatus {
  provider: string;
  freshness: Freshness;
  source?: "REAL" | "STUB" | string | null; // STUB = 합성 스텁 폴백 중(사이드카 다운)
  last_run_at?: string | null;
}

export interface SidecarStatus {
  healthy: boolean;
  url?: string | null;
}

// ----- 알림 환경설정 · 조용한 시간 (/me/notification-prefs) -----
export interface NotificationPrefs {
  quiet_enabled: boolean;
  quiet_start_hour: number; // KST 0-23
  quiet_end_hour: number; // KST 0-23
}

export interface SystemStatus {
  providers: ProviderStatus[];
  build_version?: string | null;
  time?: string | null;
  scanner_status?: string | null;
  sidecar?: SidecarStatus | null;
}

export interface AdminOverview {
  generated_at: string;
  users: {
    total: number;
    by_status: Record<string, number>;
  };
  alerts: {
    total: number;
    enabled: number;
    disabled: number;
  };
  notifications: {
    total: number;
    unread: number;
    by_status: Record<string, number>;
    delivery_attempts24h?: number;
    failed_deliveries?: number;
    failed_web_push?: number;
    active_web_push_subscriptions?: number;
    inactive_web_push_subscriptions?: number;
  };
  explain: {
    total: number;
    helpful: number;
    helpful_rate?: string | null;
  };
  scanner_rules: {
    total: number;
    enabled: number;
    disabled: number;
    active_matches?: number;
    runs24h?: number;
  };
  signals: {
    total: number;
    by_status: Record<string, number>;
  };
  instruments: {
    total: number;
    by_market: Record<string, number>;
  };
}

export interface AdminAuditLog {
  id: number;
  actor_id?: number | null;
  action: string;
  target?: string | null;
  ip?: string | null;
  detail?: string | null;
  created_at: string;
}

export interface AdminNotification {
  id: number;
  user_id: number;
  signal_id?: number | null;
  alert_id?: number | null;
  status: NotificationStatus;
  title: string;
  body?: string | null;
  created_at: string;
  read_at?: string | null;
}

export interface AdminDeliveryAttempt {
  id: number;
  notification_id: number;
  channel: string;
  status: string;
  attempt_no: number;
  error_code?: string | null;
  attempted_at: string;
}
