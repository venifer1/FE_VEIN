import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api, type Envelope } from "./api";
import { authBridge } from "@/store/auth";
import { instrumentPathId, signalPathId } from "./types";
import type { WeeklyReport, SignupInput, SignupResponse, MacroSnapshot, MacroCalendar } from "./types";
import type {
  Alert,
  AdminAuditLog,
  AdminDeliveryAttempt,
  AdminNotification,
  AdminOverview,
  AuthTokens,
  BacktestResult,
  CandleResponse,
  ConditionScanRequest,
  ConditionScanResult,
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
  LiquidationAggregation,
  Market,
  MarketIndexRow,
  NewsItem,
  NewsSource,
  Entitlements,
  Notification,
  NotificationDigest,
  NotificationPrefs,
  OnboardingStatus,
  PaperAccount,
  PaperOrder,
  PaperPerformance,
  PaperPortfolio,
  ScalpDetail,
  ScalpRankRow,
  ScannerRule,
  ScannerRuleRun,
  ScannerRuleSimulation,
  Signal,
  SignalDetail,
  SignalExplain,
  ExplainFeedbackSummary,
  SignalPerformance,
  SignalPerformanceSummaryRow,
  SignalStatus,
  SignalType,
  Strategy,
  StrategyRun,
  SupplyRow,
  SystemStatus,
  ThemeDetail,
  ThemeRow,
  Timeframe,
  Trending,
  TvlHistory,
  TvlMode,
  TvlRow,
  User,
  Watchlist,
  WatchlistItem,
  WebPushConfig,
} from "./types";

// ============ market terminal (홈) ============
export function useMarketIndices() {
  return useQuery({
    queryKey: ["market-indices"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<MarketIndexRow[]>>("/market/indices");
      return resp.data;
    },
  });
}

// Global aggregate market figures (총 시가총액 / 24h 거래량 / 변동률). Slow-moving,
// so ~60s. A live backend without this endpoint yet may 404; callers render a
// null-safe placeholder, never crash.
export function useGlobalMarket() {
  return useQuery({
    queryKey: ["market-global"],
    refetchInterval: 60_000,
    retry: false,
    queryFn: async () => {
      const resp = await api.get<Envelope<GlobalMarket>>("/market/global");
      return resp.data;
    },
  });
}

export function useKimchiPremium(sort?: string) {
  return useQuery({
    queryKey: ["kimchi-premium", sort ?? ""],
    refetchInterval: 30_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<KimchiPremiumRow[]>>("/market/kimchi-premium", {
        params: { sort: sort || undefined },
      });
      return resp.data;
    },
  });
}

export function useFearGreedHistory(days = 30) {
  return useQuery({
    queryKey: ["fear-greed-history", days],
    refetchInterval: 60_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<FearGreedPoint[]>>("/market/fear-greed/history", {
        params: { days },
      });
      return resp.data;
    },
  });
}

// Time series for any market index key (BTC_DOMINANCE, ALT_INDEX, NASDAQ, ...)
// for sparklines. A live backend without this endpoint yet 404s → callers
// simply render no sparkline (retry:false keeps it quiet).
export function useIndexHistory(key: string, days = 30) {
  return useQuery({
    queryKey: ["index-history", key, days],
    refetchInterval: 60_000,
    retry: false,
    queryFn: async () => {
      const resp = await api.get<Envelope<{ t: string; value: string }[]>>(
        `/market/indices/${key}/history`,
        { params: { days } },
      );
      return resp.data;
    },
  });
}

export function useMovers(type: MoverType, market: Market = "CRYPTO", limit = 20) {
  return useQuery({
    queryKey: ["movers", market, type, limit],
    refetchInterval: 30_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<Mover[]>>("/market/movers", {
        params: { market, type, limit },
      });
      return resp.data;
    },
  });
}

// CoinGecko trending — slow-moving, so a longer staleTime. A live backend
// without this endpoint yet may 404; callers render an empty state, never crash.
export function useTrending() {
  return useQuery({
    queryKey: ["trending"],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const resp = await api.get<Envelope<Trending[]>>("/market/trending");
      return resp.data;
    },
  });
}

// ============ derivatives (파생) ============
export function useDerivatives(limit = 20) {
  return useQuery({
    queryKey: ["derivatives", limit],
    refetchInterval: 30_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<Derivative[]>>("/derivatives", {
        params: { limit },
      });
      return resp.data;
    },
  });
}

export function useDerivative(symbol: string | undefined) {
  return useQuery({
    queryKey: ["derivative", symbol],
    enabled: Boolean(symbol),
    refetchInterval: 60_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<DerivativeDetail>>(`/derivatives/${symbol}`);
      return resp.data;
    },
  });
}

export function useLiquidations(minNotional = 10_000, limit = 100) {
  return useQuery({
    queryKey: ["liquidations", minNotional, limit],
    refetchInterval: 3_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<LiquidationSnapshot>>("/liquidations", {
        params: { min_notional: minNotional, limit },
      });
      return resp.data;
    },
  });
}

export function useLiquidationSummary() {
  return useQuery({
    queryKey: ["liquidations", "summary"],
    refetchInterval: 10_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<LiquidationAggregation>>("/liquidations/summary");
      return resp.data;
    },
  });
}

// ============ instruments + candles + indicators ============
export function useInstruments(q?: string, market?: Market) {
  return useQuery({
    queryKey: ["instruments", q ?? "", market ?? ""],
    queryFn: async () => {
      const resp = await api.get<Envelope<Instrument[]>>("/instruments", {
        params: { q: q || undefined, market: market || undefined },
      });
      return resp.data.data;
    },
  });
}

export function useInstrument(id: string | undefined) {
  return useQuery({
    queryKey: ["instrument", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const resp = await api.get<Envelope<Instrument>>(`/instruments/${instrumentPathId(id)}`);
      return resp.data.data;
    },
  });
}

const CANDLE_PAGE_SIZE = 200;

export function useInstrumentCandles(id: string | undefined, timeframe: Timeframe) {
  return useInfiniteQuery({
    queryKey: ["candles", id, timeframe],
    enabled: Boolean(id),
    refetchInterval: 60_000,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const resp = await api.get<Envelope<CandleResponse>>(
        `/instruments/${instrumentPathId(id)}/candles`,
        { params: { timeframe, limit: CANDLE_PAGE_SIZE, to: pageParam } },
      );
      return resp.data;
    },
    getNextPageParam: (lastPage) => {
      const candles = lastPage.data.candles ?? [];
      if (candles.length < CANDLE_PAGE_SIZE) return undefined;
      const oldest = candles[0]?.open_time;
      if (!oldest) return undefined;
      const beforeOldest = new Date(oldest).getTime() - 1;
      if (!Number.isFinite(beforeOldest)) return undefined;
      return new Date(beforeOldest).toISOString();
    },
    select: (data) => {
      const seen = new Set<string>();
      const candles = data.pages
        .slice()
        .reverse()
        .flatMap((page) => page.data.candles ?? [])
        .filter((candle) => {
          if (seen.has(candle.open_time)) return false;
          seen.add(candle.open_time);
          return true;
        });
      const latestPage = data.pages[0];
      return {
        pages: data.pages,
        pageParams: data.pageParams,
        data: {
          ...latestPage.data,
          candles,
        },
        meta: latestPage.meta,
      };
    },
  });
}

export function useInstrumentIndicators(
  id: string | undefined,
  timeframe: Timeframe,
  enabled = true,
) {
  return useQuery({
    queryKey: ["indicators", id, timeframe],
    enabled: Boolean(id) && enabled,
    queryFn: async () => {
      const resp = await api.get<Envelope<IndicatorSummary>>(
        `/instruments/${instrumentPathId(id)}/indicators`,
        { params: { timeframe } },
      );
      return resp.data.data;
    },
  });
}

// ============ signals (스캐너) ============
export interface SignalFilter {
  type?: SignalType;
  market?: Market;
  timeframe?: Timeframe;
  status?: SignalStatus;
  instrument_id?: string;
  watchlist_only?: boolean;
  near_only?: boolean;
  active_only?: boolean; // true면 활성(DETECTED/NEAR_COMPLETION)만, 만료·무효 숨김 (R54)
}

export function useSignals(filter: SignalFilter) {
  return useInfiniteQuery({
    queryKey: ["signals", filter],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const resp = await api.get<Envelope<Signal[]>>("/signals", {
        params: {
          ...filter,
          instrument_id: filter.instrument_id ? instrumentPathId(filter.instrument_id) : undefined,
          cursor: pageParam,
        },
      });
      return resp.data;
    },
    getNextPageParam: (last) => last.meta?.next_cursor ?? undefined,
    refetchInterval: 30_000,
  });
}

// 오늘의 주목 신호(R41): Pattern Score 상위 활성 신호. 신호 과다 완화용 홈 큐레이션.
export function useTopSignals(market?: Market, limit = 6) {
  return useQuery({
    queryKey: ["signals-top", market ?? "ALL", limit],
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<Signal[]>>("/signals/top", {
        params: { market, limit },
      });
      return resp.data.data;
    },
  });
}

export function useRunConditionScan() {
  return useMutation({
    mutationFn: async (request: ConditionScanRequest) => {
      const resp = await api.post<Envelope<ConditionScanResult>>("/scanner/run", request);
      return resp.data.data;
    },
  });
}

export function useScannerRules() {
  return useQuery({
    queryKey: ["scanner-rules"],
    queryFn: async () => {
      const resp = await api.get<Envelope<ScannerRule[]>>("/scanner/rules");
      return resp.data.data;
    },
  });
}

export function useSaveScannerRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request: ConditionScanRequest & { name: string }) => {
      const resp = await api.post<Envelope<ScannerRule>>("/scanner/rules", request);
      return resp.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scanner-rules"] }),
  });
}

export function useDeleteScannerRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/scanner/rules/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scanner-rules"] }),
  });
}

export function useUpdateScannerRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; enabled?: boolean }) => {
      const { id, ...body } = input;
      const resp = await api.patch<Envelope<ScannerRule>>(`/scanner/rules/${id}`, body);
      return resp.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scanner-rules"] }),
  });
}

export function useSimulateScannerRule() {
  return useMutation({
    mutationFn: async (id: number) => {
      const resp = await api.post<Envelope<ScannerRuleSimulation>>(
        `/scanner/rules/${id}/simulate`,
      );
      return resp.data.data;
    },
  });
}

export function useScannerRuleHistory(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ["scanner-rule-history", id],
    enabled: Boolean(id) && enabled,
    queryFn: async () => {
      const resp = await api.get<Envelope<ScannerRuleRun[]>>(
        `/scanner/rules/${id}/history`,
      );
      return resp.data.data;
    },
  });
}

export function useSignalDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["signal", id],
    enabled: Boolean(id),
    queryFn: async () => {
      // Backend wants the bare numeric id (the "sig_" prefix 500s).
      const resp = await api.get<Envelope<SignalDetail>>(`/signals/${signalPathId(id)}`);
      return resp.data;
    },
  });
}

// ============ signal performance (성과) ============
// Detail panel: horizons may be empty if the signal is too fresh — that is NOT
// an error. A live backend without this endpoint yet may 404; callers must
// render an empty/loading state, never crash.
export function useSignalPerformance(id: string | undefined) {
  return useQuery({
    queryKey: ["signal-performance", id],
    enabled: Boolean(id),
    // Don't retry a missing endpoint into a noisy error on live; the panel
    // simply shows the empty note when data is unavailable.
    retry: false,
    queryFn: async () => {
      const resp = await api.get<Envelope<SignalPerformance>>(
        `/signals/${signalPathId(id)}/performance`,
      );
      return resp.data.data;
    },
  });
}

export function useSignalExplain(id: string | undefined) {
  return useQuery({
    queryKey: ["signal-explain", id],
    enabled: Boolean(id),
    retry: false,
    queryFn: async () => {
      const resp = await api.get<Envelope<SignalExplain>>(
        `/signals/${signalPathId(id)}/explain`,
      );
      return resp.data.data;
    },
  });
}

export function useExplainFeedback(id: string | undefined) {
  return useQuery({
    queryKey: ["explain-feedback", id],
    enabled: Boolean(id),
    retry: false,
    queryFn: async () => {
      const resp = await api.get<Envelope<ExplainFeedbackSummary>>(
        `/explain/${signalPathId(id)}/feedback`,
      );
      return resp.data.data;
    },
  });
}

export function useSubmitExplainFeedback(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ helpful, reason }: { helpful: boolean; reason?: string }) => {
      const resp = await api.post<Envelope<ExplainFeedbackSummary>>(
        `/explain/${signalPathId(id)}/feedback`,
        { helpful, reason },
      );
      return resp.data.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(["explain-feedback", id], data);
    },
  });
}

export interface SignalPerformanceSummaryParams {
  type?: SignalType;
  market?: Market;
  timeframe?: Timeframe;
  horizon?: string;
}

export function useSignalPerformanceSummary(params: SignalPerformanceSummaryParams) {
  return useQuery({
    queryKey: ["signal-performance-summary", params],
    retry: false,
    queryFn: async () => {
      const resp = await api.get<Envelope<SignalPerformanceSummaryRow[]>>(
        "/signals/performance/summary",
        {
          params: {
            type: params.type || undefined,
            market: params.market || undefined,
            timeframe: params.timeframe || undefined,
            horizon: params.horizon || undefined,
          },
        },
      );
      return resp.data.data;
    },
  });
}

// ============ scalp (틱띄기) ============
export function useScalpRanking(limit = 30) {
  return useQuery({
    queryKey: ["scalp-ranking", limit],
    refetchInterval: 10_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<ScalpRankRow[]>>("/scalp/ranking", {
        params: { limit },
      });
      return resp.data;
    },
  });
}

export function useScalpDetail(symbol: string | undefined) {
  return useQuery({
    queryKey: ["scalp", symbol],
    enabled: Boolean(symbol),
    refetchInterval: 5_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<ScalpDetail>>(`/scalp/${symbol}`);
      return resp.data;
    },
  });
}

// ============ backtest (백테스트) ============
export interface BacktestInput {
  type: SignalType;
  market?: Market;
  timeframe?: Timeframe;
  target_pct: number;
  stop_pct: number;
  horizon: string;
  period_days?: number;
  fee_pct?: number;
  // Walk-forward (IS/OOS) validation. When walk_forward is true the response
  // gains a `walk_forward` block; is_ratio (0.5–0.9, default 0.7) is the
  // in-sample fraction.
  walk_forward?: boolean;
  is_ratio?: number;
}

// POST /backtests/run. A one-shot mutation (no polling); decimals arrive as
// strings and are formatted only at display. The page renders loading / empty
// (0 trades) / error states, never crashes on a missing field.
export function useBacktest() {
  return useMutation({
    mutationFn: async (input: BacktestInput) => {
      const resp = await api.post<Envelope<BacktestResult>>("/backtests/run", {
        type: input.type,
        market: input.market || undefined,
        timeframe: input.timeframe || undefined,
        target_pct: input.target_pct,
        stop_pct: input.stop_pct,
        horizon: input.horizon,
        period_days: input.period_days,
        fee_pct: input.fee_pct,
        walk_forward: input.walk_forward || undefined,
        is_ratio: input.walk_forward ? input.is_ratio : undefined,
      });
      return resp.data.data;
    },
  });
}

// ============ paper trading ============
export function usePaperPortfolio() {
  return useQuery({
    queryKey: ["paper-portfolio"],
    retry: false,
    refetchInterval: 30_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<PaperPortfolio>>("/paper/portfolio");
      return resp.data.data;
    },
  });
}

export function usePaperPerformance() {
  return useQuery({
    queryKey: ["paper-performance"],
    retry: false,
    refetchInterval: 30_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<PaperPerformance>>("/paper/performance");
      return resp.data.data;
    },
  });
}

export function useCreatePaperAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { initial_balance: string; base_currency?: string }) => {
      const resp = await api.post<Envelope<PaperAccount>>("/paper/accounts", input);
      return resp.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paper-portfolio"] });
      qc.invalidateQueries({ queryKey: ["paper-performance"] });
    },
  });
}

export function useCreatePaperOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      instrument_id: string | number;
      side: "BUY" | "SELL";
      type: "MARKET" | "LIMIT";
      quantity: string;
      price?: string;
      investment_type?: "SPOT" | "FUTURES";
      position_side?: "LONG" | "SHORT";
      leverage?: string;
      reduce_only?: boolean;
      timeframe?: Timeframe;
    }) => {
      const resp = await api.post<Envelope<PaperOrder>>("/paper/orders", {
        instrument_id: instrumentPathId(input.instrument_id),
        side: input.side,
        type: input.type,
        quantity: input.quantity,
        price: input.price || undefined,
        investment_type: input.investment_type || undefined,
        position_side: input.position_side || undefined,
        leverage: input.leverage || undefined,
        reduce_only: input.reduce_only || undefined,
        timeframe: input.timeframe || undefined,
      });
      return resp.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paper-portfolio"] });
      qc.invalidateQueries({ queryKey: ["paper-performance"] });
    },
  });
}

// ============ saved strategies (전략 저장/불러오기) ============
// GET /strategies -> user's saved backtest configs, newest-first. The list
// powers the "저장된 전략" section; callers render loading/empty/error states.
export function useStrategies() {
  return useQuery({
    queryKey: ["strategies"],
    queryFn: async () => {
      const resp = await api.get<Envelope<Strategy[]>>("/strategies");
      return resp.data.data;
    },
  });
}

export interface SaveStrategyInput {
  name: string;
  params: BacktestInput;
  metrics?: BacktestResult["metrics"] | null;
}

// POST /strategies -> persist the current form params + the last result metrics.
// On success the strategies query is invalidated so the saved list refreshes.
export function useSaveStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveStrategyInput) => {
      const { params } = input;
      const resp = await api.post<Envelope<Strategy>>("/strategies", {
        name: input.name,
        params: {
          type: params.type,
          market: params.market || undefined,
          timeframe: params.timeframe || undefined,
          target_pct: params.target_pct,
          stop_pct: params.stop_pct,
          horizon: params.horizon,
          period_days: params.period_days,
          fee_pct: params.fee_pct,
        },
        metrics: input.metrics ?? undefined,
      });
      return resp.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
  });
}

export function useDeleteStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | number) => {
      await api.delete(`/strategies/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
  });
}

// GET /strategies/{id}/history?limit=30 -> run snapshots newest-first. Powers
// the per-strategy 성과 히스토리; enabled only when the row is expanded.
export function useStrategyHistory(id: string | number | undefined, enabled = true) {
  return useQuery({
    queryKey: ["strategy-history", String(id ?? "")],
    enabled: Boolean(id) && enabled,
    queryFn: async () => {
      const resp = await api.get<Envelope<StrategyRun[]>>(`/strategies/${id}/history`, {
        params: { limit: 30 },
      });
      return resp.data.data;
    },
  });
}

// POST /strategies/{id}/run -> re-runs the saved strategy now, appending a
// snapshot. On success invalidate that strategy's history and the strategies
// list (its `metrics` snapshot updates).
export function useRunStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | number) => {
      const resp = await api.post<Envelope<StrategyRun>>(`/strategies/${id}/run`);
      return resp.data.data;
    },
    onSuccess: (_run, id) => {
      qc.invalidateQueries({ queryKey: ["strategy-history", String(id)] });
      qc.invalidateQueries({ queryKey: ["strategies"] });
    },
  });
}

// ============ news (속보) ============
export function useNews(source?: NewsSource) {
  return useInfiniteQuery({
    queryKey: ["news", source ?? ""],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const resp = await api.get<Envelope<NewsItem[]>>("/news", {
        params: { source: source || undefined, cursor: pageParam },
      });
      return resp.data;
    },
    getNextPageParam: (last) => last.meta?.next_cursor ?? undefined,
    refetchInterval: 30_000,
  });
}

// Latest news tagged with a specific instrument symbol (e.g. "KRW-BTC"), via
// GET /news?symbol=. Used by the instrument detail "관련 속보" section. Null-safe:
// a backend without the symbol filter or with no matches returns an empty list,
// never crashes; we don't retry into a noisy error.
export function useInstrumentNews(symbol: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ["instrument-news", symbol ?? "", limit],
    enabled: Boolean(symbol),
    retry: false,
    refetchInterval: 60_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<NewsItem[]>>("/news", {
        params: { symbol, page_size: limit },
      });
      return resp.data.data;
    },
  });
}

// Single news item for the detail page. There is no GET /news/{id}; the list
// item already carries the full content, so we look it up from the newest page.
export function useNewsItem(id: string | undefined) {
  return useQuery({
    queryKey: ["news-item", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const resp = await api.get<Envelope<NewsItem[]>>("/news", {
        params: { page_size: 100 },
      });
      return resp.data.data.find((n) => String(n.id) === String(id)) ?? null;
    },
  });
}

// ============ data: tvl ============
export function useTvl(mode: TvlMode, sort?: string, q?: string) {
  return useQuery({
    queryKey: ["tvl", mode, sort ?? "", q ?? ""],
    refetchInterval: 60_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<TvlRow[]>>("/tvl", {
        params: { mode, sort: sort || undefined, q: q || undefined },
      });
      return resp.data;
    },
  });
}

export function useTvlHistory(id: string | undefined) {
  return useQuery({
    queryKey: ["tvl-history", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const resp = await api.get<Envelope<TvlHistory>>(`/tvl/${id}/history`);
      return resp.data.data;
    },
  });
}

// ============ data: supply ============
export function useSupply(sort?: string, q?: string) {
  return useQuery({
    queryKey: ["supply", sort ?? "", q ?? ""],
    refetchInterval: 60_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<SupplyRow[]>>("/supply", {
        params: { sort: sort || undefined, q: q || undefined },
      });
      return resp.data;
    },
  });
}

// ============ data: themes ============
export interface ThemeFilter {
  market?: Market | "KR";
  q?: string;
  unclassified_only?: boolean;
  low_confidence_only?: boolean;
}

export function useThemes(filter: ThemeFilter) {
  return useQuery({
    queryKey: ["themes", filter],
    queryFn: async () => {
      const resp = await api.get<Envelope<ThemeRow[]>>("/themes", {
        params: {
          market: filter.market || undefined,
          q: filter.q || undefined,
          unclassified_only: filter.unclassified_only || undefined,
          low_confidence_only: filter.low_confidence_only || undefined,
        },
      });
      return resp.data;
    },
  });
}

export function useThemeConstituents(id: string | undefined) {
  return useQuery({
    queryKey: ["theme-constituents", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const resp = await api.get<Envelope<ThemeDetail>>(`/themes/${id}/constituents`);
      return resp.data.data;
    },
  });
}

// ============ data: funding arb (펀비차익) ============
export function useFundingArb(sort?: string) {
  return useQuery({
    queryKey: ["funding-arb", sort ?? ""],
    refetchInterval: 30_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<FundingArbRow[]>>("/funding-arb", {
        params: { sort: sort || undefined },
      });
      return resp.data;
    },
  });
}

// ============ watchlist ============
export function useWatchlist() {
  return useQuery({
    queryKey: ["watchlist"],
    queryFn: async () => {
      const resp = await api.get<Envelope<Watchlist>>("/watchlists/default");
      return resp.data.data;
    },
  });
}

export function useAddWatchItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (instrument_id: string) => {
      const resp = await api.post<Envelope<WatchlistItem>>(
        "/watchlists/default/items",
        { instrument_id: instrumentPathId(instrument_id) },
      );
      return resp.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

export function useRemoveWatchItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (instrument_id: string) => {
      await api.delete(`/watchlists/default/items/${instrumentPathId(instrument_id)}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

// ============ notifications (unread poll) ============
export function useNotifications(unreadOnly = false, enabled = true) {
  return useQuery({
    queryKey: ["notifications", unreadOnly],
    enabled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<Notification[]>>("/notifications", {
        params: { unread_only: unreadOnly || undefined },
      });
      return resp.data;
    },
  });
}

// 구독 엔타이틀먼트(Track C, R52). 현재 티어와 기능/한도.
export function useEntitlements(enabled = true) {
  return useQuery({
    queryKey: ["entitlements"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<Entitlements>>("/me/entitlements");
      return resp.data.data;
    },
  });
}

// 온보딩 "시작하기" 체크리스트. 신규 사용자가 핵심 기능에 도달하도록 홈에서 안내.
export function useOnboarding(enabled = true) {
  return useQuery({
    queryKey: ["onboarding"],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<OnboardingStatus>>("/me/onboarding");
      return resp.data.data;
    },
  });
}

export function useDismissOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const resp = await api.post<Envelope<OnboardingStatus>>("/me/onboarding/dismiss");
      return resp.data.data;
    },
    onSuccess: (data) => qc.setQueryData(["onboarding"], data),
  });
}

// 알림 다이제스트(읽기 시점 요약). 자리를 비운 사이 온 알림을 분류별로 한눈에.
export function useNotificationDigest(windowHours = 24, enabled = true) {
  return useQuery({
    queryKey: ["notifications", "digest", windowHours],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<NotificationDigest>>("/notifications/digest", {
        params: { window: windowHours },
      });
      return resp.data.data;
    },
  });
}

export function useRecordWebPushDelivery() {
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/${id}/deliveries/web-push`);
    },
  });
}

export function useWebPushConfig() {
  return useQuery({
    queryKey: ["web-push-config"],
    queryFn: async () => {
      const resp = await api.get<Envelope<WebPushConfig>>("/notifications/web-push/config");
      return resp.data.data;
    },
  });
}

export function useSaveWebPushSubscription() {
  return useMutation({
    mutationFn: async (subscription: PushSubscriptionJSON & { user_agent?: string }) => {
      const resp = await api.put<Envelope<{ active: boolean }>>(
        "/notifications/web-push/subscription",
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys?.p256dh,
            auth: subscription.keys?.auth,
          },
          user_agent: subscription.user_agent,
        },
      );
      return resp.data.data;
    },
  });
}

export function useDeleteWebPushSubscription() {
  return useMutation({
    mutationFn: async (endpoint?: string | null) => {
      await api.delete("/notifications/web-push/subscription", {
        params: { endpoint: endpoint || undefined },
      });
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    refetchInterval: 30_000,
    // BottomTabs renders globally (incl. /login); don't poll when unauthenticated.
    enabled: Boolean(authBridge.getAccess() || authBridge.getRefresh()),
    queryFn: async () => {
      const resp = await api.get<Envelope<Notification[]>>("/notifications", {
        params: { unread_only: true },
      });
      return resp.data.meta?.unread_count ?? resp.data.data.length;
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const resp = await api.patch<Envelope<{ read_at: string }>>(
        `/notifications/${id}/read`,
      );
      return resp.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const resp = await api.post<Envelope<{ updated: number }>>("/notifications/read-all");
      return resp.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

// ============ alerts ============
export interface CreateAlertInput {
  instrument_id: string;
  signal_type: SignalType;
  timeframe: Timeframe;
  market: Market;
  cooldown_sec: number;
}

export function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAlertInput) => {
      const resp = await api.post<Envelope<{ alert_id: string; enabled: boolean }>>(
        "/alerts",
        { ...input, instrument_id: instrumentPathId(input.instrument_id) },
      );
      return resp.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useUpdateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; enabled?: boolean; cooldown_sec?: number }) => {
      const { id, ...rest } = input;
      const resp = await api.patch<Envelope<Alert>>(`/alerts/${id}`, rest);
      return resp.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | number) => {
      await api.delete(`/alerts/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["entitlements"] });
    },
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const resp = await api.get<Envelope<Alert[]>>("/alerts");
      return resp.data.data;
    },
  });
}

// ============ system status ============
export function useSystemStatus(enabled = true) {
  return useQuery({
    queryKey: ["system-status"],
    enabled,
    queryFn: async () => {
      const resp = await api.get<Envelope<SystemStatus>>("/system/status");
      return resp.data.data;
    },
  });
}

// 알림 환경설정 · 조용한 시간(R42)
export function useNotificationPrefs() {
  return useQuery({
    queryKey: ["notification-prefs"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<NotificationPrefs>>("/me/notification-prefs");
      return resp.data.data;
    },
  });
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: NotificationPrefs) => {
      const resp = await api.put<Envelope<NotificationPrefs>>("/me/notification-prefs", prefs);
      return resp.data.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(["notification-prefs"], data);
    },
  });
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin-overview"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<AdminOverview>>("/admin/overview");
      return resp.data.data;
    },
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<User[]>>("/admin/users");
      return resp.data.data;
    },
  });
}

export function useAdminAuditLogs() {
  return useQuery({
    queryKey: ["admin-audit-logs"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<AdminAuditLog[]>>("/admin/audit-logs");
      return resp.data.data;
    },
  });
}

export function useAdminNotifications() {
  return useQuery({
    queryKey: ["admin-notifications"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<AdminNotification[]>>("/admin/notifications");
      return resp.data.data;
    },
  });
}

export function useAdminFailedDeliveries() {
  return useQuery({
    queryKey: ["admin-failed-deliveries"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<AdminDeliveryAttempt[]>>("/admin/delivery-attempts/failed");
      return resp.data.data;
    },
  });
}

export function useAdminApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | number) => {
      const resp = await api.patch<Envelope<User>>(`/admin/users/${id}/approve`);
      return resp.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["admin-audit-logs"] });
    },
  });
}

export function useAdminLockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | number) => {
      const resp = await api.patch<Envelope<User>>(`/admin/users/${id}/lock`);
      return resp.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["admin-audit-logs"] });
    },
  });
}

// 구독 티어 설정(R56). admin이 사용자 FREE↔PRO 전환.
export function useAdminSetTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tier }: { id: string | number; tier: "FREE" | "PRO" }) => {
      const resp = await api.patch<Envelope<User>>(`/admin/users/${id}/tier`, { tier });
      return resp.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-audit-logs"] });
      qc.invalidateQueries({ queryKey: ["entitlements"] });
    },
  });
}

// ============ auth ============
export function useLogin() {
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const resp = await api.post<Envelope<AuthTokens>>("/auth/login", input);
      return resp.data.data;
    },
  });
}

// Public weekly performance report — no auth required (landing page).
export function useWeeklyReport(windowDays = 90) {
  return useQuery({
    queryKey: ["public-weekly-report", windowDays],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const resp = await api.get<Envelope<WeeklyReport>>("/public/reports/weekly", {
        params: { window_days: windowDays },
      });
      return resp.data.data;
    },
  });
}

// Macro / market regime snapshot (authenticated). Refreshes every 5 min.
export function useMacro() {
  return useQuery({
    queryKey: ["macro"],
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<MacroSnapshot>>("/macro");
      return resp.data.data;
    },
  });
}

// Economic calendar — upcoming high-impact macro events with D-day. Refreshes hourly.
export function useMacroCalendar(days = 14) {
  return useQuery({
    queryKey: ["macro-calendar", days],
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
    queryFn: async () => {
      const resp = await api.get<Envelope<MacroCalendar>>("/macro/calendar", { params: { days } });
      return resp.data.data;
    },
  });
}

// Public self-service signup. Returns tokens when auto-approved, else PENDING.
export function useSignup() {
  return useMutation({
    mutationFn: async (input: SignupInput) => {
      const resp = await api.post<Envelope<SignupResponse>>("/auth/signup", input);
      return resp.data.data;
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: async (refresh_token: string | null) => {
      if (refresh_token) {
        await api.post("/auth/logout", { refresh_token }).catch(() => undefined);
      }
    },
  });
}
