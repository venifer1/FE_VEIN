// Lightweight axios adapter that serves the contract envelope from mockData.
// Activated when NEXT_PUBLIC_USE_MOCK === "true".
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import {
  MOCK_PASSWORD,
  alerts as mockAlerts,
  derivatives as mockDerivatives,
  fundingArb as mockFundingArb,
  liquidations as mockLiquidations,
  getCandles,
  getDerivativeDetail,
  getFearGreedHistory,
  globalMarket as mockGlobalMarket,
  getMovers,
  getIndicators,
  getScalpDetail,
  getSignalDetail,
  getSignalPerformance,
  getSignalPerformanceSummary,
  getThemeConstituents,
  getTrending,
  getTvlHistory,
  instruments as mockInstruments,
  kimchiPremium as mockKimchi,
  marketIndices as mockIndices,
  newsItems as mockNews,
  notifications as mockNotifications,
  runBacktest,
  scalpRanking as mockScalp,
  signals as mockSignals,
  createStrategy,
  deleteStrategy,
  getStrategy,
  getStrategyHistory,
  listStrategies,
  runStrategy,
  supplyRows as mockSupply,
  systemStatus,
  themes as mockThemes,
  tvlChains as mockTvlChains,
  tvlProtocols as mockTvlProtocols,
  watchlist as mockWatchlist,
  BUILD_VERSION,
} from "./mockData";
import type {
  Market,
  MoverType,
  Notification,
  NotificationDigest,
  ScannerRule,
  Timeframe,
  TvlRow,
  User,
} from "./types";
import { timeframesForMarket } from "./types";

// 온보딩(R48): 목 상태에서 스텝 완료를 파생. dismiss는 모듈 플래그로 유지.
let mockOnboardingDismissed = false;
function buildOnboarding() {
  const steps = [
    { key: "WATCHLIST", label: "관심종목 추가", done: mockWatchlist.items.length > 0, href: "/" },
    { key: "ALERT", label: "신호 알림 만들기", done: mockAlerts.length > 0, href: "/scanner" },
    { key: "PAPER", label: "모의투자 시작", done: Boolean(mockPaperAccount), href: "/paper" },
    { key: "SCANNER", label: "조건검색식 저장", done: scannerRules.length > 0, href: "/scanner" },
  ];
  const completed = steps.filter((s) => s.done).length;
  return {
    steps,
    completed,
    total: steps.length,
    all_done: completed === steps.length,
    dismissed: mockOnboardingDismissed,
  };
}

// 백엔드 NotificationDigest.summarize와 동일 계약을 목으로 재현한다(읽기 시점 요약).
function buildNotificationDigest(all: Notification[], windowHours: number): NotificationDigest {
  const since = Date.now() - windowHours * 3_600_000;
  const rows = all
    .filter((n) => new Date(n.created_at).getTime() >= since)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const isUnread = (n: Notification) => n.read_at == null && n.status !== "READ";
  const category = (n: Notification) => {
    if (n.signal_id != null) return "SIGNAL";
    const t = n.title ?? "";
    if (t.startsWith("Scanner match:")) return "SCANNER";
    if (t.startsWith("Liquidation spike")) return "LIQUIDATION";
    return "SYSTEM";
  };
  const order: Array<[string, string]> = [
    ["SIGNAL", "패턴 신호"],
    ["SCANNER", "조건검색"],
    ["LIQUIDATION", "청산 급증"],
    ["SYSTEM", "시스템"],
  ];
  const acc = new Map<string, { total: number; unread: number }>();
  for (const n of rows) {
    const key = category(n);
    const c = acc.get(key) ?? { total: 0, unread: 0 };
    c.total += 1;
    if (isUnread(n)) c.unread += 1;
    acc.set(key, c);
  }
  const categories = order
    .filter(([key]) => (acc.get(key)?.total ?? 0) > 0)
    .map(([key, label]) => ({ category: key, label, total: acc.get(key)!.total, unread: acc.get(key)!.unread }));
  const total = rows.length;
  const unread = rows.filter(isUnread).length;
  const released = 0; // 목업엔 조용한 시간 보류 데이터가 없음(스풀링은 라이브 전용 흐름)
  const recent = rows.filter(isUnread).slice(0, 5);
  const summary =
    total === 0
      ? `최근 ${windowHours}시간 새 알림이 없습니다.`
      : `최근 ${windowHours}시간 알림 ${total}건 (안읽음 ${unread}건)` +
        (categories.length ? " · " + categories.map((c) => `${c.label} ${c.total}`).join(" · ") : "");
  return {
    window_hours: windowHours,
    generated_at: new Date().toISOString(),
    total,
    unread,
    released,
    categories,
    recent,
    summary,
  };
}

const trace = () => `mock-${Math.random().toString(36).slice(2, 10)}`;
const explainFeedback = new Map<string, { helpful: boolean; reason?: string }>();
const scannerRules: ScannerRule[] = [];
const mockUsers: User[] = [
  { id: "usr_1", email: "tester@vein.test", role: "SUPER_ADMIN", status: "APPROVED" },
  { id: "usr_2", email: "pending@vein.test", role: "TESTER", status: "PENDING" },
  { id: "usr_3", email: "locked@vein.test", role: "TESTER", status: "LOCKED" },
];
const mockAuditLogs: any[] = [];
let paperAccountSeq = 1;
let paperOrderSeq = 1;
let paperFillSeq = 1;
let mockPaperAccount: any = {
  id: "paper_1",
  base_currency: "KRW",
  initial_balance: "10000000",
  cash_balance: "10000000",
  status: "ACTIVE",
  simulation_run: 1,
};
let mockPaperPositions: any[] = [];
let mockPaperOrders: any[] = [];

function ok<T>(config: InternalAxiosRequestConfig, data: T, meta: Record<string, unknown> = {}): AxiosResponse {
  return {
    data: { data, meta: { trace_id: trace(), ...meta } },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
}

function fail(config: InternalAxiosRequestConfig, status: number, code: string, message: string): never {
  const err: any = new Error(message);
  err.isAxiosError = true;
  err.config = config;
  err.response = {
    data: { error: { code, message, trace_id: trace() } },
    status,
    statusText: code,
    headers: {},
    config,
  };
  throw err;
}

function parseUrl(config: InternalAxiosRequestConfig): { path: string; params: URLSearchParams } {
  const raw = config.url ?? "";
  const [p, q] = raw.split("?");
  const params = new URLSearchParams(q ?? "");
  if (config.params) {
    Object.entries(config.params as Record<string, unknown>).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    });
  }
  return { path: p.replace(/\/+$/, ""), params };
}

function body(config: InternalAxiosRequestConfig): any {
  if (!config.data) return {};
  if (typeof config.data === "string") {
    try {
      return JSON.parse(config.data);
    } catch {
      return {};
    }
  }
  return config.data;
}

// Korean initial-consonant (초성) search support, e.g. "ㅂㅌ" → 비트코인.
const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
function toCho(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = ch.charCodeAt(0) - 0xac00;
    if (code >= 0 && code <= 11171) out += CHO[Math.floor(code / 588)];
    else out += ch;
  }
  return out;
}
function isChoQuery(q: string): boolean {
  return q.length > 0 && q.split("").every((c) => CHO.includes(c));
}

function num(v: string | null | undefined): number {
  return v == null ? 0 : Number(v);
}

function trimNum(value: number): string {
  return value.toFixed(8).replace(/\.?0+$/, "");
}

function paperPortfolio() {
  const positions = mockPaperPositions
    .filter((p) => Number(p.quantity) > 0)
    .map((p) => {
      const inst = mockInstruments.find((i) => idMatches(i.id, String(p.instrument_id)));
      const mark = Number(getCandles(String(inst?.id ?? p.instrument_id), "1d").at(-1)?.close ?? p.avg_price);
      const qty = Number(p.quantity);
      const avg = Number(p.avg_price);
      const direction = p.position_side === "SHORT" ? -1 : 1;
      const marketValue = mark * qty;
      return {
        instrument_id: Number(String(p.instrument_id).replace(/\D/g, "")) || p.instrument_id,
        symbol: inst?.symbol ?? String(p.instrument_id),
        name: inst?.name ?? null,
        quantity: trimNum(qty),
        investment_type: p.investment_type ?? "SPOT",
        position_side: p.position_side ?? null,
        avg_price: trimNum(avg),
        mark_price: trimNum(mark),
        market_value: trimNum(marketValue),
        margin: String(p.margin ?? "0"),
        leverage: String(p.leverage ?? "1"),
        unrealized_pnl: trimNum((mark - avg) * qty * direction),
        realized_pnl: String(p.realized_pnl ?? "0"),
      };
    });
  const equity = Number(mockPaperAccount.cash_balance) + positions.reduce((sum, p) => sum + Number(p.market_value), 0);
  const unrealized = positions.reduce((sum, p) => sum + Number(p.unrealized_pnl), 0);
  const realized = mockPaperPositions.reduce((sum, p) => sum + Number(p.realized_pnl ?? 0), 0);
  return {
    account: mockPaperAccount,
    equity: trimNum(equity),
    unrealized_pnl: trimNum(unrealized),
    realized_pnl: trimNum(realized),
    positions,
    recent_orders: mockPaperOrders.slice(0, 20),
  };
}

// Match a mock entity by id whether the caller passed the prefixed id
// ("ins_btc", "sig_001") or the bare/stripped form ("btc", "001").
function idMatches(entityId: string | number, pathId: string): boolean {
  const eid = String(entityId);
  if (eid === pathId) return true;
  const stripped = eid.replace(/^[a-zA-Z]+_/, "");
  return stripped === pathId;
}

// R39: 경제 캘린더 목업. 실 백엔드는 큐레이션 고정일+NFP 규칙이지만, 목업은 "오늘"부터
// 상대적으로 배치해 항상 임박 이벤트가 보이도록 합성한다(계약 형태만 동일).
function upcomingMacroEvents(days: number) {
  const seeds: Array<{ inDays: number; type: "FOMC" | "CPI" | "EMPLOYMENT"; title: string }> = [
    { inDays: 1, type: "CPI", title: "미국 소비자물가(CPI)" },
    { inDays: 4, type: "EMPLOYMENT", title: "미국 고용보고서(비농업)" },
    { inDays: 9, type: "FOMC", title: "미국 FOMC 금리결정" },
    { inDays: 22, type: "CPI", title: "미국 소비자물가(CPI)" },
  ];
  const now = new Date();
  const cap = Math.max(1, Math.min(days, 90));
  return seeds
    .filter((s) => s.inDays <= cap)
    .map((s) => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() + s.inDays);
      return {
        date: d.toISOString().slice(0, 10),
        dday: s.inDays,
        type: s.type,
        title: s.title,
        region: "US",
        impact: "HIGH",
      };
    });
}

// 조용한 시간(R42) 목업 상태 — PUT으로 갱신, GET으로 반환(세션 내 유지).
let mockNotificationPrefs = { quiet_enabled: false, quiet_start_hour: 22, quiet_end_hour: 8 };

export const mockAdapter: AxiosAdapter = async (config) => {
  await new Promise((r) => setTimeout(r, 220)); // simulate latency
  const method = (config.method ?? "get").toLowerCase();
  const { path, params } = parseUrl(config);

  // ----- auth -----
  if (path === "/auth/login" && method === "post") {
    const { email, password } = body(config);
    if (!email || !password) fail(config, 400, "AUTH_INVALID", "이메일과 비밀번호를 입력하세요.");
    if (email === "locked@vein.test") fail(config, 403, "USER_LOCKED", "계정이 잠겼습니다.");
    if (email === "pending@vein.test") fail(config, 403, "USER_NOT_APPROVED", "승인 대기 중인 계정입니다.");
    if (password !== MOCK_PASSWORD) fail(config, 401, "AUTH_INVALID", "이메일 또는 비밀번호가 올바르지 않습니다.");
    return ok(config, {
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_in: 900,
      user: { id: "usr_1", email, role: "TESTER", status: "APPROVED" },
    });
  }
  if (path === "/auth/refresh" && method === "post") {
    return ok(config, {
      access_token: "mock-access-token-rotated",
      refresh_token: "mock-refresh-token-rotated",
      expires_in: 900,
      user: { id: "usr_1", email: "tester@vein.test", role: "TESTER", status: "APPROVED" },
    });
  }
  if (path === "/auth/logout" && method === "post") {
    return { data: null, status: 204, statusText: "No Content", headers: {}, config };
  }
  if (path === "/me" && method === "get") {
    return ok(config, { id: "usr_1", email: "tester@vein.test", role: "TESTER", status: "APPROVED" });
  }
  // 알림 환경설정 · 조용한 시간(R42)
  if (path === "/me/notification-prefs" && method === "get") {
    return ok(config, mockNotificationPrefs);
  }
  if (path === "/me/notification-prefs" && method === "put") {
    const b = body(config);
    mockNotificationPrefs = {
      quiet_enabled: !!b.quiet_enabled,
      quiet_start_hour: Number(b.quiet_start_hour ?? 22),
      quiet_end_hour: Number(b.quiet_end_hour ?? 8),
    };
    return ok(config, mockNotificationPrefs);
  }
  if (path === "/me/entitlements" && method === "get") {
    return ok(config, {
      tier: "FREE",
      pro: false,
      features: [
        { key: "SAVED_SCANNER_RULES", label: "저장 조건검색식", limit: 3 },
        { key: "ALERTS", label: "신호 알림 규칙", limit: 10 },
      ],
    });
  }
  if (path === "/me/onboarding" && method === "get") {
    return ok(config, buildOnboarding());
  }
  if (path === "/me/onboarding/dismiss" && method === "post") {
    mockOnboardingDismissed = true;
    return ok(config, buildOnboarding());
  }

  // ----- market terminal -----
  if (path === "/market/indices" && method === "get") {
    return ok(config, mockIndices, { freshness: "FRESH" });
  }
  if (path === "/market/global" && method === "get") {
    return ok(config, mockGlobalMarket, { freshness: "FRESH" });
  }
  if (path === "/market/fear-greed/history" && method === "get") {
    const days = Number(params.get("days") ?? 30);
    return ok(config, getFearGreedHistory(days), { freshness: "FRESH" });
  }
  if (path === "/market/movers" && method === "get") {
    const type = (params.get("type") ?? "GAINERS") as MoverType;
    const market = (params.get("market") ?? "CRYPTO") as Market;
    const limit = Number(params.get("limit") ?? 20);
    return ok(config, getMovers(type, market).slice(0, limit), { freshness: "FRESH" });
  }
  if (path === "/market/trending" && method === "get") {
    return ok(config, getTrending(), { freshness: "FRESH" });
  }
  if (path === "/market/kimchi-premium" && method === "get") {
    const sort = params.get("sort");
    const pinned = mockKimchi.filter((k) => k.pinned);
    let rest = mockKimchi.filter((k) => !k.pinned);
    if (sort === "premium") rest = [...rest].sort((a, b) => num(b.premium_pct) - num(a.premium_pct));
    return ok(config, [...pinned, ...rest], { freshness: "FRESH" });
  }

  // ----- instruments / candles / indicators -----
  if (path === "/instruments" && method === "get") {
    const rawQ = (params.get("q") ?? "").trim();
    const q = rawQ.toLowerCase();
    const market = params.get("market") as Market | null;
    let data = mockInstruments.filter((i) => !market || i.market === market);
    if (rawQ) {
      if (isChoQuery(rawQ)) {
        data = data.filter((i) => toCho(i.name ?? "").includes(rawQ));
      } else {
        data = data.filter(
          (i) => i.symbol.toLowerCase().includes(q) || (i.name ?? "").toLowerCase().includes(q),
        );
      }
    }
    return ok(config, data.slice(0, 30));
  }
  const instMatch = path.match(/^\/instruments\/([^/]+)$/);
  if (instMatch && method === "get") {
    const inst = mockInstruments.find((i) => idMatches(i.id, instMatch[1]));
    if (!inst) fail(config, 404, "NOT_FOUND", "종목을 찾을 수 없습니다.");
    return ok(config, inst);
  }
  const candleMatch = path.match(/^\/instruments\/([^/]+)\/candles$/);
  if (candleMatch && method === "get") {
    const inst = mockInstruments.find((i) => idMatches(i.id, candleMatch[1]));
    if (!inst) fail(config, 404, "NOT_FOUND", "종목을 찾을 수 없습니다.");
    const tf = (params.get("timeframe") ?? "1h") as Timeframe;
    if (!timeframesForMarket(inst.market).includes(tf))
      fail(config, 400, "UNSUPPORTED_TIMEFRAME", "지원하지 않는 주기입니다.");
    const candles = getCandles(String(inst.id), tf);
    const provider = inst.market === "CRYPTO" ? "UPBIT" : inst.market === "US" ? "YFINANCE" : "PYKRX";
    // Real shape: data = { candles, provider, freshness } (no nested instrument/timeframe).
    return ok(config, { candles, provider, freshness: "FRESH" }, { freshness: "FRESH" });
  }
  const indMatch = path.match(/^\/instruments\/([^/]+)\/indicators$/);
  if (indMatch && method === "get") {
    const inst = mockInstruments.find((i) => idMatches(i.id, indMatch[1]));
    if (!inst) fail(config, 404, "NOT_FOUND", "종목을 찾을 수 없습니다.");
    const tf = (params.get("timeframe") ?? "1h") as Timeframe;
    return ok(config, getIndicators(String(inst.id), tf), { freshness: "FRESH" });
  }

  // ----- condition scanner -----
  if (path === "/scanner/run" && method === "post") {
    const request = body(config);
    const universe = mockInstruments.filter((item) => item.market === request.market).slice(0, 30);
    const items = universe.slice(0, 8).map((item) => {
      const indicators = getIndicators(String(item.id), request.timeframe);
      const price = getCandles(String(item.id), request.timeframe).at(-1)?.close ?? "0";
      return {
        instrument_id: Number(String(item.id).replace(/\D/g, "")) || 1,
        symbol: item.symbol,
        name: item.name,
        market: item.market,
        price,
        rsi14: indicators.rsi14 ?? "50",
        volume_ratio: "1.75",
        ma5: indicators.ma5 ?? price,
        ma20: indicators.ma20 ?? price,
        macd_histogram: indicators.macd_histogram ?? "0.5",
        matched_conditions: request.conditions.map(
          (condition: any) => `${condition.indicator} ${condition.operator} ${condition.target ?? condition.value}`,
        ),
      };
    });
    return ok(config, {
      evaluated_count: universe.length,
      matched_count: items.length,
      items,
    });
  }
  if (path === "/scanner/rules" && method === "get") {
    return ok(config, scannerRules);
  }
  if (path === "/scanner/rules" && method === "post") {
    const request = body(config);
    const rule: ScannerRule = {
      id: scannerRules.length + 1,
      name: request.name,
      market: request.market,
      timeframe: request.timeframe,
      logic: request.logic,
      conditions: request.conditions,
      enabled: true,
      created_at: new Date().toISOString(),
    };
    scannerRules.unshift(rule);
    return ok(config, rule);
  }
  const scannerRulePatch = path.match(/^\/scanner\/rules\/(\d+)$/);
  if (scannerRulePatch && method === "patch") {
    const rule = scannerRules.find((item) => item.id === Number(scannerRulePatch[1]));
    if (!rule) fail(config, 404, "NOT_FOUND", "Scanner rule not found.");
    const request = body(config);
    if (typeof request.enabled === "boolean") rule.enabled = request.enabled;
    return ok(config, rule);
  }
  const scannerRuleDelete = path.match(/^\/scanner\/rules\/(\d+)$/);
  if (scannerRuleDelete && method === "delete") {
    const index = scannerRules.findIndex((rule) => rule.id === Number(scannerRuleDelete[1]));
    if (index >= 0) scannerRules.splice(index, 1);
    return ok(config, null);
  }
  const scannerRuleSimulate = path.match(/^\/scanner\/rules\/(\d+)\/simulate$/);
  if (scannerRuleSimulate && method === "post") {
    const rule = scannerRules.find((item) => item.id === Number(scannerRuleSimulate[1]));
    if (!rule) fail(config, 404, "NOT_FOUND", "Scanner rule not found.");
    return ok(config, {
      rule_id: rule.id,
      evaluated_count: 30,
      matched_count: 3,
      match_rate: "10",
      frequency_grade: "HIGH",
      sample_items: [],
    });
  }
  const scannerRuleHistory = path.match(/^\/scanner\/rules\/(\d+)\/history$/);
  if (scannerRuleHistory && method === "get") {
    return ok(config, [
      {
        id: 1,
        evaluated_count: 30,
        matched_count: 3,
        match_rate: "10",
        frequency_grade: "HIGH",
        notification_count: 1,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  // ----- signals -----
  if (path === "/signals" && method === "get") {
    const type = params.get("type");
    const market = params.get("market");
    const timeframe = params.get("timeframe");
    const status = params.get("status");
    const instrumentId = params.get("instrument_id");
    const watchlistOnly = params.get("watchlist_only") === "true";
    const nearOnly = params.get("near_only") === "true";
    const cursor = params.get("cursor");
    let list = [...mockSignals];
    if (type) list = list.filter((s) => s.type === type);
    if (market) list = list.filter((s) => s.market === market);
    if (timeframe) list = list.filter((s) => s.timeframe === timeframe);
    if (status) list = list.filter((s) => s.status === status);
    if (instrumentId) list = list.filter((s) => idMatches(s.instrument.id, instrumentId));
    if (nearOnly) list = list.filter((s) => s.status === "NEAR_COMPLETION");
    if (watchlistOnly) {
      const ids = new Set(mockWatchlist.items.map((i) => i.instrument.id));
      list = list.filter((s) => ids.has(s.instrument.id));
    }
    if (cursor) return ok(config, [], { next_cursor: null });
    return ok(config, list, { next_cursor: null, freshness: "FRESH" });
  }
  // top signals by score (R41) — must precede the /signals/{id} matcher.
  if (path === "/signals/top" && method === "get") {
    const market = params.get("market");
    const limit = Number(params.get("limit") ?? 10);
    let list = mockSignals.filter((s) => s.status === "DETECTED" || s.status === "NEAR_COMPLETION");
    if (market) list = list.filter((s) => s.market === market);
    list = [...list].sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0)).slice(0, limit);
    return ok(config, list, { freshness: "FRESH" });
  }
  // performance summary (aggregate) — must precede the /signals/{id} matcher.
  if (path === "/signals/performance/summary" && method === "get") {
    const rows = getSignalPerformanceSummary({
      type: params.get("type") ?? undefined,
      market: params.get("market") ?? undefined,
      timeframe: params.get("timeframe") ?? undefined,
      horizon: params.get("horizon") ?? undefined,
    });
    return ok(config, rows, { freshness: "FRESH" });
  }
  // per-signal performance (horizons) — must precede the /signals/{id} matcher.
  const sigPerfMatch = path.match(/^\/signals\/([^/]+)\/performance$/);
  if (sigPerfMatch && method === "get") {
    const perf = getSignalPerformance(sigPerfMatch[1]);
    if (!perf) fail(config, 404, "SIGNAL_NOT_FOUND", "신호를 찾을 수 없습니다.");
    return ok(config, perf, { freshness: "FRESH" });
  }
  const sigExplainMatch = path.match(/^\/signals\/([^/]+)\/explain$/);
  if (sigExplainMatch && method === "get") {
    const detail = getSignalDetail(sigExplainMatch[1]);
    if (!detail) fail(config, 404, "SIGNAL_NOT_FOUND", "Signal not found.");
    const completion = Math.round((Number(detail.score ?? 50) / 100) * 30);
    const factors = [
      { key: "COMPLETION", label: "패턴 완성도", score: completion, max_score: 30, detail: `탐지기 구조 점수 ${detail.score ?? "-"}점` },
      { key: "VOLUME", label: "거래량 증가", score: 15, max_score: 20, detail: "최근 거래량/20봉 평균 2.0배" },
      { key: "TREND", label: "추세 강도", score: 15, max_score: 20, detail: "현재가 MA20 상단 · MACD 양수 · RSI 48" },
      { key: "VOLATILITY", label: "변동성 적정성", score: 10, max_score: 10, detail: "최근 평균 고저폭 3.2%" },
      { key: "NEWS", label: "뉴스 모멘텀", score: 10, max_score: 20, detail: "관련 긍정 0건 · 부정 0건" },
    ];
    return ok(config, {
      signal_id: detail.id,
      pattern_score: factors.reduce((sum, factor) => sum + factor.score, 0),
      risk_guard: detail.status === "INVALIDATED" ? "BLOCK" : detail.status === "EXPIRED" ? "WARN" : "PASS",
      factors,
      reasons: [
        `${detail.type} 패턴 구조가 탐지 규칙을 충족했습니다.`,
        "최근 거래량과 추세 지표가 후보 방향을 보조합니다.",
      ],
      risks: [
        "확정 수익 신호가 아니며 시장 상황에 따라 패턴이 무효화될 수 있습니다.",
      ],
      next_checks: [
        "다음 확정봉의 종가와 거래량이 패턴 방향을 유지하는지 확인하세요.",
        "무효화 가격과 최근 저점 이탈 여부를 함께 확인하세요.",
      ],
      confidence: { grade: "LOW", sample_size: 18, hit_rate: "55.6", avg_return_pct: "0.72", horizon: "1d" },
      template_version: "rules-ko-v1",
    });
  }
  const explainFeedbackMatch = path.match(/^\/explain\/([^/]+)\/feedback$/);
  if (explainFeedbackMatch && method === "get") {
    const mine = explainFeedback.get(explainFeedbackMatch[1]);
    return ok(config, {
      total_count: mine ? 1 : 0,
      helpful_count: mine?.helpful ? 1 : 0,
      helpful_rate: mine ? (mine.helpful ? "100.0" : "0.0") : null,
      my_helpful: mine?.helpful ?? null,
      my_reason: mine?.reason ?? null,
    });
  }
  if (explainFeedbackMatch && method === "post") {
    const request = body(config);
    explainFeedback.set(explainFeedbackMatch[1], {
      helpful: Boolean(request.helpful),
      reason: request.reason,
    });
    const mine = explainFeedback.get(explainFeedbackMatch[1])!;
    return ok(config, {
      total_count: 1,
      helpful_count: mine.helpful ? 1 : 0,
      helpful_rate: mine.helpful ? "100.0" : "0.0",
      my_helpful: mine.helpful,
      my_reason: mine.reason ?? null,
    });
  }
  const sigMatch = path.match(/^\/signals\/([^/]+)$/);
  if (sigMatch && method === "get") {
    const detail = getSignalDetail(sigMatch[1]);
    if (!detail) fail(config, 404, "SIGNAL_NOT_FOUND", "신호를 찾을 수 없습니다.");
    const freshness = detail.status === "EXPIRED" ? "DELAYED" : "FRESH";
    // R39: 이벤트 리스크 라벨 계약 parity — 임박한 매크로 이벤트 예시 1건.
    const nextEvent = upcomingMacroEvents(14).find((e) => e.dday >= 0 && e.dday <= 3);
    const withRisk = nextEvent
      ? {
          ...detail,
          event_risk: {
            active: true,
            level: nextEvent.dday <= 1 ? "HIGH" : "MEDIUM",
            confidence_delta: nextEvent.dday <= 1 ? -10 : -5,
            note: `${nextEvent.dday === 0 ? "D-DAY" : `D-${nextEvent.dday}`} ${nextEvent.title} — 이벤트 전후 변동성 확대, 신호 신뢰도 하향 참고(${nextEvent.dday <= 1 ? -10 : -5})`,
            events: [{ date: nextEvent.date, dday: nextEvent.dday, type: nextEvent.type, title: nextEvent.title }],
          },
        }
      : detail;
    return ok(config, withRisk, { freshness });
  }

  // ----- macro / market regime + economic calendar -----
  if (path === "/macro" && method === "get") {
    return ok(config, {
      regime: {
        label: "RANGE",
        score: 0,
        summary: "뚜렷한 방향 없음 — 횡보 국면",
        signals: [
          { key: "EQUITY_TREND", direction: "NEUTRAL", detail: "나스닥 횡보 (+0.3%)" },
          { key: "SENTIMENT", direction: "NEUTRAL", detail: "중립 · 공포탐욕 52" },
        ],
      },
      yield_curve: null,
      m2: null,
      dxy: null,
      generated_at: new Date().toISOString(),
      sources: ["NASDAQ", "FEAR_GREED"],
    });
  }
  if (path === "/macro/calendar" && method === "get") {
    const days = Number(params.get("days") ?? 14);
    return ok(config, { events: upcomingMacroEvents(days), generated_at: new Date().toISOString() });
  }

  // ----- backtest (백테스트) -----
  if (path === "/backtests/run" && method === "post") {
    const b = body(config);
    if (!b.type) fail(config, 400, "INVALID_PARAMS", "패턴 유형을 선택하세요.");
    const result = runBacktest({
      type: b.type,
      market: b.market,
      timeframe: b.timeframe,
      target_pct: b.target_pct != null ? Number(b.target_pct) : undefined,
      stop_pct: b.stop_pct != null ? Number(b.stop_pct) : undefined,
      horizon: b.horizon,
      period_days: b.period_days != null ? Number(b.period_days) : undefined,
      fee_pct: b.fee_pct != null ? Number(b.fee_pct) : undefined,
      walk_forward: Boolean(b.walk_forward),
      is_ratio: b.is_ratio != null ? Number(b.is_ratio) : undefined,
    });
    return ok(config, result, { freshness: "FRESH" });
  }

  // ----- paper trading -----
  if (path === "/paper/accounts" && method === "post") {
    const b = body(config);
    const initial = Number(b.initial_balance || 10000000);
    mockPaperAccount = {
      id: `paper_${++paperAccountSeq}`,
      base_currency: b.base_currency || "KRW",
      initial_balance: String(initial),
      cash_balance: String(initial),
      status: "ACTIVE",
      simulation_run: paperAccountSeq,
    };
    mockPaperPositions = [];
    mockPaperOrders = [];
    return ok(config, mockPaperAccount);
  }
  if (path === "/paper/portfolio" && method === "get") {
    return ok(config, paperPortfolio(), { freshness: "FRESH" });
  }
  if (path === "/paper/performance" && method === "get") {
    const p = paperPortfolio();
    const initial = Number(p.account.initial_balance || 0);
    const totalReturn = initial ? ((Number(p.equity) - initial) / initial) * 100 : 0;
    return ok(config, {
      account_id: p.account.id,
      total_return_pct: totalReturn.toFixed(4),
      equity: p.equity,
      realized_pnl: p.realized_pnl,
      unrealized_pnl: p.unrealized_pnl,
      open_positions: p.positions.length,
    });
  }
  if (path === "/paper/orders" && method === "post") {
    const b = body(config);
    const inst = mockInstruments.find((i) => idMatches(i.id, String(b.instrument_id)));
    if (!inst) fail(config, 404, "NOT_FOUND", "Instrument not found.");
    const instId = Number(String(b.instrument_id).replace(/\D/g, "")) || b.instrument_id;
    const investmentType = b.investment_type || "SPOT";
    const positionSide = investmentType === "FUTURES" ? (b.position_side || (b.side === "SELL" ? "SHORT" : "LONG")) : null;
    const leverage = investmentType === "FUTURES" ? Number(b.leverage || 1) : 1;
    const reduceOnly = Boolean(b.reduce_only);
    const qty = Number(b.quantity || 0);
    if (qty <= 0) fail(config, 400, "INVALID_QUERY", "Invalid quantity.");
    const price = Number(b.price || getCandles(String(inst!.id), (b.timeframe || "1d") as Timeframe).at(-1)?.close || 0);
    const notional = price * qty;
    const fee = notional * 0.0005;
    let pos = mockPaperPositions.find((p) => String(p.instrument_id) === String(instId) && (p.investment_type ?? "SPOT") === investmentType && (p.position_side ?? null) === positionSide);
    if (investmentType === "FUTURES") {
      if (reduceOnly) {
        if (!pos || Number(pos.quantity) < qty) fail(config, 400, "INVALID_QUERY", "Close quantity exceeds futures position.");
        const direction = positionSide === "SHORT" ? -1 : 1;
        const releasedMargin = Number(pos.margin ?? 0) * (qty / Number(pos.quantity));
        const pnl = (price - Number(pos.avg_price)) * qty * direction - fee;
        pos.quantity = String(Number(pos.quantity) - qty);
        pos.margin = String(Number(pos.margin ?? 0) - releasedMargin);
        pos.realized_pnl = String(Number(pos.realized_pnl ?? 0) + pnl);
        mockPaperAccount.cash_balance = String(Number(mockPaperAccount.cash_balance) + releasedMargin + pnl);
      } else {
        const margin = notional / leverage;
        if (Number(mockPaperAccount.cash_balance) < margin + fee) fail(config, 400, "INVALID_QUERY", "Insufficient paper margin.");
        mockPaperAccount.cash_balance = String(Number(mockPaperAccount.cash_balance) - margin - fee);
        if (!pos) {
          pos = { instrument_id: instId, investment_type: "FUTURES", position_side: positionSide, quantity: "0", avg_price: String(price), margin: "0", leverage: String(leverage), realized_pnl: "0" };
          mockPaperPositions.push(pos);
        }
        const oldQty = Number(pos.quantity);
        const newQty = oldQty + qty;
        pos.avg_price = String(((Number(pos.avg_price) * oldQty) + notional) / newQty);
        pos.quantity = String(newQty);
        pos.margin = String(Number(pos.margin ?? 0) + margin);
        pos.leverage = String(leverage);
      }
    } else if (b.side === "SELL") {
      if (!pos || Number(pos.quantity) < qty) fail(config, 400, "INVALID_QUERY", "Sell quantity exceeds open paper position.");
      pos.quantity = String(Number(pos.quantity) - qty);
      pos.realized_pnl = String(Number(pos.realized_pnl ?? 0) + (price - Number(pos.avg_price)) * qty - fee);
      mockPaperAccount.cash_balance = String(Number(mockPaperAccount.cash_balance) + notional - fee);
    } else {
      if (Number(mockPaperAccount.cash_balance) < notional + fee) fail(config, 400, "INVALID_QUERY", "Insufficient paper cash.");
      mockPaperAccount.cash_balance = String(Number(mockPaperAccount.cash_balance) - notional - fee);
      if (!pos) {
        pos = { instrument_id: instId, investment_type: "SPOT", position_side: null, quantity: "0", avg_price: String(price), margin: "0", leverage: "1", realized_pnl: "0" };
        mockPaperPositions.push(pos);
      }
      const oldQty = Number(pos.quantity);
      const newQty = oldQty + qty;
      pos.avg_price = String(((Number(pos.avg_price) * oldQty) + notional) / newQty);
      pos.quantity = String(newQty);
    }
    const fill = {
      id: `pfill_${++paperFillSeq}`,
      price: String(price),
      quantity: String(qty),
      fee: trimNum(fee),
      slippage: "0",
      liquidity_source: b.price ? "REQUEST_PRICE" : "LATEST_CANDLE",
      filled_at: new Date().toISOString(),
    };
    const order = {
      id: `pord_${++paperOrderSeq}`,
      account_id: mockPaperAccount.id,
      instrument_id: instId,
      signal_id: b.signal_id ?? null,
      investment_type: investmentType,
      position_side: positionSide,
      side: b.side || "BUY",
      type: b.type || "MARKET",
      price: String(price),
      quantity: String(qty),
      leverage: String(leverage),
      reduce_only: reduceOnly,
      status: "FILLED",
      fill,
    };
    mockPaperOrders.unshift(order);
    return ok(config, order);
  }

  // ----- saved strategies (전략 저장/불러오기) -----
  if (path === "/strategies" && method === "get") {
    return ok(config, listStrategies());
  }
  if (path === "/strategies" && method === "post") {
    const b = body(config);
    if (!b.name || !String(b.name).trim()) fail(config, 400, "INVALID_PARAMS", "전략 이름을 입력하세요.");
    if (!b.params?.type) fail(config, 400, "INVALID_PARAMS", "패턴 유형이 필요합니다.");
    const strat = createStrategy({ name: b.name, params: b.params, metrics: b.metrics });
    return ok(config, strat);
  }
  // run history — must precede the /strategies/{id} matcher.
  const strategyHistoryMatch = path.match(/^\/strategies\/([^/]+)\/history$/);
  if (strategyHistoryMatch && method === "get") {
    if (!getStrategy(strategyHistoryMatch[1])) fail(config, 404, "STRATEGY_NOT_FOUND", "전략을 찾을 수 없습니다.");
    const limit = Number(params.get("limit") ?? 30);
    return ok(config, getStrategyHistory(strategyHistoryMatch[1], limit), { freshness: "FRESH" });
  }
  const strategyRunMatch = path.match(/^\/strategies\/([^/]+)\/run$/);
  if (strategyRunMatch && method === "post") {
    const run = runStrategy(strategyRunMatch[1]);
    if (!run) fail(config, 404, "STRATEGY_NOT_FOUND", "전략을 찾을 수 없습니다.");
    return ok(config, run, { freshness: "FRESH" });
  }
  const strategyMatch = path.match(/^\/strategies\/([^/]+)$/);
  if (strategyMatch && method === "get") {
    const strat = getStrategy(strategyMatch[1]);
    if (!strat) fail(config, 404, "STRATEGY_NOT_FOUND", "전략을 찾을 수 없습니다.");
    return ok(config, strat);
  }
  if (strategyMatch && method === "delete") {
    if (!deleteStrategy(strategyMatch[1])) fail(config, 404, "STRATEGY_NOT_FOUND", "전략을 찾을 수 없습니다.");
    return { data: null, status: 204, statusText: "No Content", headers: {}, config };
  }

  // ----- scalp (틱띄기) -----
  if (path === "/scalp/ranking" && method === "get") {
    const limit = Number(params.get("limit") ?? 30);
    return ok(config, mockScalp.slice(0, limit), { freshness: "FRESH" });
  }
  const scalpMatch = path.match(/^\/scalp\/([^/]+)$/);
  if (scalpMatch && method === "get" && scalpMatch[1] !== "ranking") {
    const detail = getScalpDetail(decodeURIComponent(scalpMatch[1]));
    if (!detail) fail(config, 404, "SCALP_NOT_FOUND", "스캘핑 데이터를 찾을 수 없습니다.");
    return ok(config, detail, { freshness: "FRESH" });
  }

  // ----- news (속보) -----
  if (path === "/news" && method === "get") {
    const source = params.get("source");
    const symbol = params.get("symbol");
    const cursor = params.get("cursor");
    const pageSize = Number(params.get("page_size") ?? 20);
    let list = [...mockNews];
    if (source) list = list.filter((n) => n.source === source);
    // Symbol filter: keep items tagged with that symbol (case-insensitive),
    // mirroring the backend's computed tagged_symbols filter. Empty if none.
    if (symbol) {
      const sym = symbol.toUpperCase();
      list = list.filter((n) => (n.tagged_symbols ?? []).some((s) => s.toUpperCase() === sym));
    }
    if (cursor) return ok(config, [], { next_cursor: null });
    return ok(config, list.slice(0, pageSize), { next_cursor: null, freshness: "FRESH" });
  }

  // ----- data: tvl -----
  if (path === "/tvl" && method === "get") {
    const mode = params.get("mode") ?? "PROTOCOL";
    const sort = params.get("sort");
    const q = (params.get("q") ?? "").toLowerCase();
    let list: TvlRow[] = mode === "CHAIN" ? [...mockTvlChains] : [...mockTvlProtocols];
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q));
    if (sort === "CHANGE_7D") list = [...list].sort((a, b) => num(b.change7d) - num(a.change7d));
    else list = [...list].sort((a, b) => num(b.tvl) - num(a.tvl));
    return ok(config, list, { freshness: "FRESH" });
  }
  const tvlHist = path.match(/^\/tvl\/([^/]+)\/history$/);
  if (tvlHist && method === "get") {
    const h = getTvlHistory(tvlHist[1]);
    if (!h) fail(config, 404, "NOT_FOUND", "프로토콜을 찾을 수 없습니다.");
    return ok(config, h, { freshness: "FRESH" });
  }

  // ----- data: supply -----
  if (path === "/supply" && method === "get") {
    const sort = params.get("sort");
    const q = (params.get("q") ?? "").toLowerCase();
    let list = [...mockSupply];
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q) || r.symbol.toLowerCase().includes(q));
    if (sort === "circulating_pct") list = [...list].sort((a, b) => num(b.circulating_pct) - num(a.circulating_pct));
    else if (sort === "fdv") list = [...list].sort((a, b) => num(b.fdv) - num(a.fdv));
    else list = [...list].sort((a, b) => num(b.market_cap) - num(a.market_cap));
    return ok(config, list, { freshness: "FRESH" });
  }

  // ----- data: themes -----
  if (path === "/themes" && method === "get") {
    const market = params.get("market");
    const q = (params.get("q") ?? "").toLowerCase();
    const unclassifiedOnly = params.get("unclassified_only") === "true";
    const lowConfOnly = params.get("low_confidence_only") === "true";
    let list = [...mockThemes];
    if (market) list = list.filter((t) => t.market === market);
    if (q) list = list.filter((t) => t.name.toLowerCase().includes(q));
    if (unclassifiedOnly) list = list.filter((t) => (t.unclassified_count ?? 0) > 0);
    if (lowConfOnly) list = list.filter((t) => (t.low_confidence_count ?? 0) > 0);
    return ok(config, list, { freshness: "FRESH" });
  }
  const themeCons = path.match(/^\/themes\/([^/]+)\/constituents$/);
  if (themeCons && method === "get") {
    const t = getThemeConstituents(themeCons[1]);
    if (!t) fail(config, 404, "NOT_FOUND", "테마를 찾을 수 없습니다.");
    return ok(config, t, { freshness: "FRESH" });
  }

  // ----- data: funding arb -----
  if (path === "/funding-arb" && method === "get") {
    const sort = params.get("sort");
    let list = [...mockFundingArb];
    if (sort === "expected") list = [...list].sort((a, b) => num(b.expected2x_pct) - num(a.expected2x_pct));
    else list = [...list].sort((a, b) => num(b.funding_pct) - num(a.funding_pct));
    return ok(config, list, { freshness: "FRESH" });
  }

  // ----- derivatives (파생) -----
  if (path === "/derivatives" && method === "get") {
    const limit = Number(params.get("limit") ?? 20);
    return ok(config, mockDerivatives.slice(0, limit), { freshness: "FRESH" });
  }
  const derivMatch = path.match(/^\/derivatives\/([^/]+)$/);
  if (derivMatch && method === "get") {
    const detail = getDerivativeDetail(decodeURIComponent(derivMatch[1]));
    if (!detail) fail(config, 404, "NOT_FOUND", "파생 데이터를 찾을 수 없습니다.");
    return ok(config, detail, { freshness: "FRESH" });
  }
  if (path === "/liquidations" && method === "get") {
    const limit = Number(params.get("limit") ?? 100);
    const minNotional = Number(params.get("min_notional") ?? 0);
    const events = mockLiquidations.events
      .filter((event) => Number(event.notional_usd) >= minNotional)
      .slice(0, limit);
    const longUsd = events
      .filter((event) => event.position_side === "LONG")
      .reduce((sum, event) => sum + Number(event.notional_usd), 0);
    const shortUsd = events
      .filter((event) => event.position_side === "SHORT")
      .reduce((sum, event) => sum + Number(event.notional_usd), 0);
    return ok(config, {
      ...mockLiquidations,
      count: events.length,
      total_notional_usd: String(longUsd + shortUsd),
      long_liquidation_usd: String(longUsd),
      short_liquidation_usd: String(shortUsd),
      events,
    });
  }
  if (path === "/liquidations/summary" && method === "get") {
    const total = mockLiquidations.events.reduce(
      (sum, event) => sum + Number(event.notional_usd),
      0,
    );
    const longs = mockLiquidations.events
      .filter((event) => event.position_side === "LONG")
      .reduce((sum, event) => sum + Number(event.notional_usd), 0);
    return ok(config, {
      connected: true,
      last_event_at: mockLiquidations.last_event_at,
      windows: ["1h", "24h"].map((window) => ({
        window,
        count: mockLiquidations.events.length,
        total_notional_usd: String(total),
        long_liquidation_usd: String(longs),
        short_liquidation_usd: String(total - longs),
        max_event_usd: String(Math.max(...mockLiquidations.events.map((event) => Number(event.notional_usd)))),
        partial: true,
      })),
      spike: {
        level: "HIGH",
        recent5m_usd: String(total),
        baseline5m_usd: "250000",
        ratio: (total / 250000).toFixed(2),
      },
    });
  }

  // ----- watchlist -----
  if (path === "/watchlists/default" && method === "get") {
    return ok(config, mockWatchlist);
  }
  if (path === "/watchlists/default/items" && method === "post") {
    const { instrument_id } = body(config);
    const inst = mockInstruments.find((i) => idMatches(i.id, String(instrument_id)));
    if (!inst) fail(config, 404, "INSTRUMENT_INACTIVE", "유효하지 않은 종목입니다.");
    if (mockWatchlist.items.some((i) => idMatches(i.instrument.id, String(instrument_id))))
      fail(config, 409, "ALREADY_EXISTS", "이미 관심종목에 있습니다.");
    const item = { instrument: inst, created_at: new Date().toISOString(), last_price: null, last_price_at: null };
    mockWatchlist.items.push(item);
    return ok(config, item);
  }
  const wlDel = path.match(/^\/watchlists\/default\/items\/([^/]+)$/);
  if (wlDel && method === "delete") {
    const idx = mockWatchlist.items.findIndex((i) => idMatches(i.instrument.id, wlDel[1]));
    if (idx < 0) fail(config, 404, "ITEM_NOT_FOUND", "관심종목 항목을 찾을 수 없습니다.");
    mockWatchlist.items.splice(idx, 1);
    return { data: null, status: 204, statusText: "No Content", headers: {}, config };
  }

  // ----- alerts -----
  if (path === "/alerts" && method === "get") {
    return ok(config, mockAlerts);
  }
  if (path === "/alerts" && method === "post") {
    const b = body(config);
    if (!b.cooldown_sec || b.cooldown_sec <= 0) fail(config, 400, "INVALID_COOLDOWN", "쿨다운 값이 올바르지 않습니다.");
    const inst = mockInstruments.find((i) => idMatches(i.id, String(b.instrument_id)));
    if (mockAlerts.some((a) => String(a.instrument_id) === String(b.instrument_id) && a.signal_type === b.signal_type && a.timeframe === b.timeframe))
      fail(config, 409, "DUPLICATE_ALERT", "이미 동일한 알림 규칙이 있습니다.");
    const alert = {
      alert_id: String(Date.now()),
      instrument_id: Number(b.instrument_id),
      symbol: inst?.symbol ?? String(b.instrument_id),
      signal_type: b.signal_type,
      timeframe: b.timeframe,
      market: b.market ?? inst?.market ?? "CRYPTO",
      enabled: true,
      cooldown_sec: b.cooldown_sec,
    };
    mockAlerts.push(alert);
    return ok(config, { alert_id: alert.alert_id, enabled: true });
  }
  const alertPatch = path.match(/^\/alerts\/([^/]+)$/);
  if (alertPatch && method === "patch") {
    const a = mockAlerts.find((x) => x.alert_id === alertPatch[1]);
    if (!a) fail(config, 404, "ALERT_NOT_FOUND", "알림 규칙을 찾을 수 없습니다.");
    const b = body(config);
    if (b.cooldown_sec != null) {
      if (b.cooldown_sec <= 0) fail(config, 400, "INVALID_COOLDOWN", "쿨다운 값이 올바르지 않습니다.");
      a.cooldown_sec = b.cooldown_sec;
    }
    if (b.enabled != null) a.enabled = b.enabled;
    return ok(config, a);
  }

  // ----- notifications -----
  if (path === "/notifications" && method === "get") {
    const unreadOnly = params.get("unread_only") === "true";
    let list = [...mockNotifications];
    if (unreadOnly) list = list.filter((n) => n.read_at == null && n.status !== "READ");
    const unread = mockNotifications.filter((n) => n.read_at == null && n.status !== "READ").length;
    return ok(config, list, { next_cursor: null, unread_count: unread });
  }
  if (path === "/notifications/digest" && method === "get") {
    const requested = Number(params.get("window") ?? 24);
    const window = Math.max(1, Math.min(Number.isFinite(requested) ? requested : 24, 168));
    return ok(config, buildNotificationDigest(mockNotifications, window));
  }
  const notifRead = path.match(/^\/notifications\/([^/]+)\/read$/);
  if (notifRead && method === "patch") {
    const n = mockNotifications.find((x) => x.id === notifRead[1]);
    if (!n) fail(config, 404, "NOTIFICATION_NOT_FOUND", "알림을 찾을 수 없습니다.");
    n.read_at = new Date().toISOString();
    n.status = "READ";
    return ok(config, { read_at: n.read_at });
  }
  const notifWebPush = path.match(/^\/notifications\/([^/]+)\/deliveries\/web-push$/);
  if (notifWebPush && method === "post") {
    const n = mockNotifications.find((x) => String(x.id) === notifWebPush[1]);
    if (!n) fail(config, 404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
    return ok(config, null);
  }
  if (path === "/notifications/web-push/config" && method === "get") {
    return ok(config, {
      enabled: true,
      // 목 전용 더미 VAPID 공개키(형식만 유효). 실서버 키는 GET /notifications/web-push/config 로 받는다.
      public_key: "BJUfp6h08nhCJG-p32LzDpMe3uG56Zpozis2DzEwChCGH3YCIUw8dyz03YakGbnb4ez4gMEEUAOS2-KI7K39W9U",
    });
  }
  if (path === "/notifications/web-push/subscription" && method === "put") {
    return ok(config, { active: true });
  }
  if (path === "/notifications/web-push/subscription" && method === "delete") {
    return ok(config, null);
  }

  // ----- admin -----
  if (path === "/admin/overview" && method === "get") {
    const countBy = <T,>(items: T[], keyFn: (item: T) => string) =>
      items.reduce<Record<string, number>>((acc, item) => {
        const key = keyFn(item) || "UNKNOWN";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});
    const helpful = Array.from(explainFeedback.values()).filter((v) => v.helpful).length;
    const feedbackTotal = explainFeedback.size;
    return ok(config, {
      generated_at: new Date().toISOString(),
      users: { total: mockUsers.length, by_status: countBy(mockUsers, (u) => u.status) },
      alerts: {
        total: mockAlerts.length,
        enabled: mockAlerts.filter((a) => a.enabled).length,
        disabled: mockAlerts.filter((a) => !a.enabled).length,
      },
      notifications: {
        total: mockNotifications.length,
        unread: mockNotifications.filter((n) => n.status !== "READ").length,
        by_status: countBy(mockNotifications, (n) => n.status),
        delivery_attempts24h: 4,
        failed_deliveries: 1,
        failed_web_push: 1,
        active_web_push_subscriptions: 2,
        inactive_web_push_subscriptions: 1,
      },
      explain: {
        total: feedbackTotal,
        helpful,
        helpful_rate: feedbackTotal ? ((helpful / feedbackTotal) * 100).toFixed(2) : null,
      },
      scanner_rules: {
        total: scannerRules.length,
        enabled: scannerRules.filter((r) => r.enabled).length,
        disabled: scannerRules.filter((r) => !r.enabled).length,
        active_matches: scannerRules.length ? 3 : 0,
        runs24h: scannerRules.length ? 1 : 0,
      },
      signals: { total: mockSignals.length, by_status: countBy(mockSignals, (s) => s.status) },
      instruments: { total: mockInstruments.length, by_market: countBy(mockInstruments, (i) => i.market) },
    });
  }
  if (path === "/admin/users" && method === "get") {
    return ok(config, mockUsers);
  }
  const adminApprove = path.match(/^\/admin\/users\/([^/]+)\/approve$/);
  if (adminApprove && method === "patch") {
    const user = mockUsers.find((u) => String(u.id) === adminApprove[1]);
    if (!user) fail(config, 404, "NOT_FOUND", "User not found.");
    const from = user.status;
    user.status = "APPROVED";
    mockAuditLogs.unshift({
      id: mockAuditLogs.length + 1,
      actor_id: 1,
      action: "USER_STATUS_UPDATE",
      target: `user:${user.id}`,
      ip: "127.0.0.1",
      detail: JSON.stringify({ email: user.email, from, to: user.status }),
      created_at: new Date().toISOString(),
    });
    return ok(config, user);
  }
  const adminLock = path.match(/^\/admin\/users\/([^/]+)\/lock$/);
  if (adminLock && method === "patch") {
    const user = mockUsers.find((u) => String(u.id) === adminLock[1]);
    if (!user) fail(config, 404, "NOT_FOUND", "User not found.");
    const from = user.status;
    user.status = "LOCKED";
    mockAuditLogs.unshift({
      id: mockAuditLogs.length + 1,
      actor_id: 1,
      action: "USER_STATUS_UPDATE",
      target: `user:${user.id}`,
      ip: "127.0.0.1",
      detail: JSON.stringify({ email: user.email, from, to: user.status }),
      created_at: new Date().toISOString(),
    });
    return ok(config, user);
  }
  if (path === "/admin/audit-logs" && method === "get") {
    return ok(config, mockAuditLogs.slice(0, 30));
  }
  if (path === "/admin/notifications" && method === "get") {
    return ok(config, mockNotifications.slice(0, 30).map((item) => ({
      id: Number(String(item.id).replace(/\D/g, "")) || 1,
      user_id: 1,
      signal_id: item.signal_id ? Number(String(item.signal_id).replace(/\D/g, "")) || null : null,
      alert_id: item.alert_id ? Number(String(item.alert_id).replace(/\D/g, "")) || null : null,
      status: item.status,
      title: item.title ?? "Notification",
      body: item.body ?? null,
      created_at: item.created_at,
      read_at: item.read_at ?? null,
    })));
  }
  if (path === "/admin/delivery-attempts/failed" && method === "get") {
    return ok(config, [{
      id: 1,
      notification_id: 1,
      channel: "WEB_PUSH",
      status: "FAILED",
      attempt_no: 1,
      error_code: "410",
      attempted_at: new Date(Date.now() - 18 * 60_000).toISOString(),
    }]);
  }

  // ----- system -----
  if (path === "/system/status" && method === "get") {
    return ok(config, { ...systemStatus, build_version: BUILD_VERSION });
  }

  fail(config, 404, "NOT_FOUND", `mock: unhandled ${method.toUpperCase()} ${path}`);
};
