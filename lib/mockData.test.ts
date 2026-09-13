import { describe, it, expect } from "vitest";
import {
  getSignalPerformanceSummary,
  classifyFg,
  metricsFromTrades,
  getMovers,
  getFearGreedHistory,
  runBacktest,
  getStrategyHistory,
  strategies,
  getThemeConstituents,
  getTvlHistory,
  tvlProtocols,
  getDerivativeDetail,
  derivatives,
  getScalpDetail,
  scalpRanking,
  getSignalPerformance,
  signals,
  getSignalDetail,
  genCandles,
  getIndicators,
} from "./mockData";
import type { BacktestTrade } from "./types";

// 등락 순위(movers) 시장·타입 라우팅 + 거래대금 정렬 회귀 보호(R147).
const isSortedDesc = (rows: { trade_value24h?: string | null }[]) =>
  rows.every(
    (r, i) => i === 0 || Number(rows[i - 1].trade_value24h ?? 0) >= Number(r.trade_value24h ?? 0),
  );

describe("getMovers", () => {
  it("GAINERS rows are all non-negative, LOSERS all negative (CRYPTO default)", () => {
    expect(getMovers("GAINERS").every((r) => Number(r.change_rate) >= 0)).toBe(true);
    expect(getMovers("LOSERS").every((r) => Number(r.change_rate) < 0)).toBe(true);
  });

  it("VOLUME is sorted by trade_value24h descending across markets", () => {
    expect(isSortedDesc(getMovers("VOLUME", "CRYPTO"))).toBe(true);
    expect(isSortedDesc(getMovers("VOLUME", "US"))).toBe(true);
    expect(isSortedDesc(getMovers("VOLUME", "KOSPI"))).toBe(true);
  });

  it("defaults to CRYPTO market when none is given", () => {
    expect(getMovers("GAINERS")).toEqual(getMovers("GAINERS", "CRYPTO"));
    expect(getMovers("LOSERS")).toEqual(getMovers("LOSERS", "CRYPTO"));
  });

  it("US VOLUME merges gainers and losers", () => {
    const merged = getMovers("VOLUME", "US").length;
    expect(merged).toBe(getMovers("GAINERS", "US").length + getMovers("LOSERS", "US").length);
  });
});

describe("getFearGreedHistory", () => {
  it("returns `days` points, defaulting to 30", () => {
    expect(getFearGreedHistory()).toHaveLength(30);
    expect(getFearGreedHistory(7)).toHaveLength(7);
  });

  it("clamps every value into [5,95]", () => {
    for (const p of getFearGreedHistory(60)) {
      const v = Number(p.value);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(95);
    }
  });

  it("is deterministic (seeded) — same values across calls", () => {
    const a = getFearGreedHistory(20).map((p) => p.value);
    const b = getFearGreedHistory(20).map((p) => p.value);
    expect(a).toEqual(b);
  });

  it("orders points oldest→newest by date", () => {
    const dates = getFearGreedHistory(10).map((p) => p.date);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe("runBacktest", () => {
  const input = { type: "ABC", market: "CRYPTO", timeframe: "1d", target_pct: 5, stop_pct: 3 };

  it("is deterministic for identical params (seeded metrics + returns)", () => {
    const a = runBacktest(input);
    const b = runBacktest(input);
    expect(a.metrics).toEqual(b.metrics); // metrics carry no timestamps
    expect(a.trades.map((t) => t.return_pct)).toEqual(b.trades.map((t) => t.return_pct));
  });

  it("holds structural invariants (trade count, equity length, best≥worst)", () => {
    const r = runBacktest(input);
    expect(r.trades.length).toBeGreaterThanOrEqual(28);
    expect(r.trades.length).toBeLessThanOrEqual(35);
    expect(r.metrics.trade_count).toBe(r.trades.length);
    expect(r.equity_curve).toHaveLength(r.trades.length + 1); // 1.0 seed + one per trade
    expect(Number(r.metrics.best_pct)).toBeGreaterThanOrEqual(Number(r.metrics.worst_pct));
  });

  it("echoes params with defaults and no walk-forward unless requested", () => {
    const r = runBacktest({ type: "TOP" });
    expect(r.params.type).toBe("TOP");
    expect(r.params.target_pct).toBe(5); // default
    expect(r.params.stop_pct).toBe(3); // default
    expect(r.params.fee_pct).toBe(0.1); // default
    expect(r.walk_forward).toBeNull();
  });

  it("produces a walk-forward block with clamped is_ratio when requested", () => {
    const def = runBacktest({ ...input, walk_forward: true });
    expect(def.walk_forward?.is_ratio).toBe("0.70"); // default
    expect(def.walk_forward?.in_sample).toBeTruthy();
    expect(def.walk_forward?.out_of_sample).toBeTruthy();
    expect(typeof def.walk_forward?.overfit_warning).toBe("boolean");
    // is_ratio clamped into [0.5, 0.9]
    expect(runBacktest({ ...input, walk_forward: true, is_ratio: 0.2 }).walk_forward?.is_ratio).toBe(
      "0.50",
    );
    expect(runBacktest({ ...input, walk_forward: true, is_ratio: 0.99 }).walk_forward?.is_ratio).toBe(
      "0.90",
    );
  });
});

describe("getStrategyHistory", () => {
  const id = String(strategies[0].id); // 시드 전략(런 히스토리 존재)

  it("returns seeded runs newest-first by run_at", () => {
    const h = getStrategyHistory(id);
    expect(h.length).toBeGreaterThanOrEqual(2);
    // run_at 내림차순
    const times = h.map((r) => new Date(r.run_at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    // 시드 최신은 total_return_pct 38.7, 가장 오래된 것은 21.4
    expect(h[0].total_return_pct).toBe("38.7");
    expect(h[h.length - 1].total_return_pct).toBe("21.4");
  });

  it("caps to the requested limit (keeping newest)", () => {
    const full = getStrategyHistory(id);
    const two = getStrategyHistory(id, 2);
    expect(two).toHaveLength(2);
    expect(two).toEqual(full.slice(0, 2));
  });

  it("returns empty for an unknown strategy id", () => {
    expect(getStrategyHistory("nope_999")).toEqual([]);
  });
});

describe("getThemeConstituents", () => {
  it("returns theme detail with its constituents", () => {
    const d = getThemeConstituents("301");
    expect(d).not.toBeNull();
    expect(d!.theme_id).toBe(301);
    expect(d!.name).toBe("AI / 반도체");
    expect(d!.items).toHaveLength(2);
    expect(d!.items[0].instrument_ref).toBe("NVDA");
  });

  it("returns an empty item list for a theme with no mapped constituents", () => {
    const d = getThemeConstituents("305"); // 미분류: 항목 없음
    expect(d).not.toBeNull();
    expect(d!.items).toEqual([]);
  });

  it("returns null for an unknown theme id", () => {
    expect(getThemeConstituents("999")).toBeNull();
  });
});

describe("getTvlHistory", () => {
  const id = String(tvlProtocols[0].id);

  it("returns null for an unknown entity id", () => {
    expect(getTvlHistory("999999")).toBeNull();
  });

  it("returns a 90-point series for a known entity, dates ascending", () => {
    const h = getTvlHistory(id);
    expect(h).not.toBeNull();
    expect(h!.name).toBe(tvlProtocols[0].name);
    expect(h!.points).toHaveLength(90);
    const times = h!.points.map((p) => new Date(p.t).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("is deterministic (seeded) for the same id", () => {
    const a = getTvlHistory(id)!.points.map((p) => p.tvl);
    const b = getTvlHistory(id)!.points.map((p) => p.tvl);
    expect(a).toEqual(b);
  });
});

describe("getDerivativeDetail", () => {
  const sym = derivatives[0].symbol; // e.g. "BTC"

  it("returns null for an unknown symbol", () => {
    expect(getDerivativeDetail("NOPE")).toBeNull();
  });

  it("returns 48-point long/short + OI histories, case-insensitive", () => {
    const d = getDerivativeDetail(sym.toLowerCase());
    expect(d).not.toBeNull();
    expect(d!.symbol).toBe(sym);
    expect(d!.long_short_history).toHaveLength(48);
    expect(d!.oi_history).toHaveLength(48);
    // 롱숏비는 0.4 하한
    expect(d!.long_short_history.every((p) => Number(p.ratio) >= 0.4)).toBe(true);
  });

  it("is deterministic (seeded) for the same symbol", () => {
    const a = getDerivativeDetail(sym)!.long_short_history.map((p) => p.ratio);
    const b = getDerivativeDetail(sym)!.long_short_history.map((p) => p.ratio);
    expect(a).toEqual(b);
  });
});

describe("getScalpDetail", () => {
  const sym = scalpRanking[0].symbol; // "KRW-BTC"

  it("returns null for an unknown symbol", () => {
    expect(getScalpDetail("KRW-NOPE")).toBeNull();
  });

  it("returns a 5-level orderbook with ask>bid and correct ordering", () => {
    const d = getScalpDetail(sym);
    expect(d).not.toBeNull();
    expect(d!.symbol).toBe(sym);
    expect(d!.top_levels).toHaveLength(5);
    const lv = d!.top_levels;
    // 각 레벨 매도호가 > 매수호가
    expect(lv.every((l) => Number(l.ask_price) > Number(l.bid_price))).toBe(true);
    // 매도호가 오름차순, 매수호가 내림차순 (base에서 tick 만큼 벌어짐)
    for (let i = 1; i < lv.length; i++) {
      expect(Number(lv[i].ask_price)).toBeGreaterThan(Number(lv[i - 1].ask_price));
      expect(Number(lv[i].bid_price)).toBeLessThan(Number(lv[i - 1].bid_price));
    }
  });
});

describe("getSignalPerformance", () => {
  it("returns null for an unknown signal id", () => {
    expect(getSignalPerformance("zzz_nope")).toBeNull();
  });

  it("finds a signal by full id or its numeric suffix", () => {
    const s0 = signals[0];
    const byFull = getSignalPerformance(s0.id);
    expect(byFull).not.toBeNull();
    expect(byFull!.signal_id).toBe(s0.id);
    // 접두사 제거 숫자만으로도 매칭(예: "sig_001" ↔ "001")
    const numeric = s0.id.replace(/^[a-zA-Z]+_/, "");
    expect(getSignalPerformance(numeric)?.signal_id).toBe(s0.id);
  });

  it("evaluated signals expose the full horizon ladder", () => {
    // NEAR_COMPLETION 등 비-fresh 신호는 5개 지평(1h~7d) 평가
    const evaluated = signals.find((s) => s.status === "NEAR_COMPLETION");
    if (evaluated) {
      expect(getSignalPerformance(evaluated.id)!.horizons).toHaveLength(5);
    }
  });

  it("too-fresh DETECTED signals have no evaluated horizons yet", () => {
    const fresh = signals.find(
      (s) => s.status === "DETECTED" && Number(s.id.replace(/\D/g, "")) % 2 === 0,
    );
    if (fresh) {
      expect(getSignalPerformance(fresh.id)!.horizons).toEqual([]);
    }
  });
});

describe("getSignalDetail", () => {
  const algoByType: Record<string, string> = {
    ABC: "abc-java-1.0.0",
    TOP: "top-java-1.0.0",
    IMALOL: "imalol-java-1.0.0",
  };

  it("returns null for an unknown signal id", () => {
    expect(getSignalDetail("zzz_nope")).toBeNull();
  });

  it("finds by full id or numeric suffix and sets 30-day expiry", () => {
    const s0 = signals[0];
    const d = getSignalDetail(s0.id);
    expect(d).not.toBeNull();
    expect(d!.id).toBe(s0.id);
    // 유효기간(R85): 탐지시각 + 30일, 결정적
    const expected = new Date(new Date(s0.detected_at).getTime() + 30 * 86_400_000).toISOString();
    expect(d!.expires_at).toBe(expected);
    // 접두사 제거 숫자 조회도 동일 신호
    expect(getSignalDetail(s0.id.replace(/^[a-zA-Z]+_/, ""))?.id).toBe(s0.id);
  });

  it("stamps algorithm_version matching the pattern type", () => {
    for (const type of ["ABC", "TOP", "IMALOL"]) {
      const s = signals.find((x) => x.type === type);
      if (s) {
        expect(getSignalDetail(s.id)!.algorithm_version).toBe(algoByType[type]);
      }
    }
  });
});

describe("genCandles", () => {
  it("returns `count` candles (default 200)", () => {
    expect(genCandles("ins_btc", "1d", 50)).toHaveLength(50);
    expect(genCandles("ins_btc", "1d")).toHaveLength(200);
  });

  it("every candle is OHLC-valid (high≥open/close≥low)", () => {
    for (const c of genCandles("ins_eth", "4h", 60)) {
      const [o, h, l, cl] = [c.open, c.high, c.low, c.close].map(Number);
      expect(h).toBeGreaterThanOrEqual(Math.max(o, cl));
      expect(l).toBeLessThanOrEqual(Math.min(o, cl));
      expect(h).toBeGreaterThanOrEqual(l);
      expect(Number(c.volume)).toBeGreaterThan(0);
    }
  });

  it("is contiguous: each open equals the previous close, times step evenly", () => {
    const cs = genCandles("ins_sol", "1h", 40);
    for (let i = 1; i < cs.length; i++) {
      expect(cs[i].open).toBe(cs[i - 1].close); // 가격 연속성
    }
    const step = new Date(cs[1].open_time).getTime() - new Date(cs[0].open_time).getTime();
    for (let i = 1; i < cs.length; i++) {
      const gap = new Date(cs[i].open_time).getTime() - new Date(cs[i - 1].open_time).getTime();
      expect(gap).toBe(step); // 균등 간격
    }
  });

  it("is deterministic (seeded) for the same instrument+timeframe", () => {
    const a = genCandles("ins_btc", "1d", 30).map((c) => c.close);
    const b = genCandles("ins_btc", "1d", 30).map((c) => c.close);
    expect(a).toEqual(b);
  });
});

describe("getIndicators", () => {
  it("echoes timeframe and keeps bollinger bands ordered around the middle", () => {
    const ind = getIndicators("ins_btc", "1d");
    expect(ind.timeframe).toBe("1d");
    expect(ind.boll_middle).toBe(ind.ma20); // 중앙선 = MA20
    expect(Number(ind.boll_upper)).toBeGreaterThanOrEqual(Number(ind.boll_middle));
    expect(Number(ind.boll_middle)).toBeGreaterThanOrEqual(Number(ind.boll_lower));
  });

  it("rsi stays in the demo band [45,65) and macd histogram = macd - signal", () => {
    const ind = getIndicators("ins_eth", "4h");
    const rsi = Number(ind.rsi14);
    expect(rsi).toBeGreaterThanOrEqual(45);
    expect(rsi).toBeLessThan(65);
    expect(Number(ind.macd) - Number(ind.macd_signal)).toBeCloseTo(Number(ind.macd_histogram), 1);
  });
});

// 데모 백테스트 지표 집계(승률·손익비·복리수익·MDD) 회귀 보호(R146).
const trade = (return_pct: string | null): BacktestTrade => ({ symbol: "X", return_pct });

describe("metricsFromTrades", () => {
  it("computes win rate, profit factor, compounded return and drawdown", () => {
    const m = metricsFromTrades([trade("10"), trade("-5"), trade("20")]);
    expect(m.trade_count).toBe(3);
    expect(m.win_rate).toBe("66.7"); // 2/3
    expect(m.avg_return_pct).toBe("8.33"); // 25/3
    expect(m.total_return_pct).toBe("25.4"); // 1.1*0.95*1.2 -1
    expect(m.profit_factor).toBe("6.00"); // 30/5
    expect(m.max_drawdown_pct).toBe("-5.0"); // -5% dip after peak 1.1
    expect(m.best_pct).toBe("20.00");
    expect(m.worst_pct).toBe("-5.00");
  });

  it("drops NaN returns but counts null as 0% (Number(null)===0)", () => {
    // "abc"→NaN 제외, null→0(유한)으로 계수 → returns=[10,0,-5], n=3
    const m = metricsFromTrades([trade("10"), trade("abc"), trade(null), trade("-5")]);
    expect(m.trade_count).toBe(3);
    expect(m.win_rate).toBe("66.7"); // 10과 0이 승 → 2/3
    expect(m.profit_factor).toBe("2.00"); // 10/5
  });

  it("caps profit factor at 99 when there are wins but no losses", () => {
    const m = metricsFromTrades([trade("5"), trade("5")]);
    expect(m.win_rate).toBe("100.0");
    expect(m.profit_factor).toBe("99.00");
  });

  it("returns zeros and null best/worst for an empty trade list", () => {
    const m = metricsFromTrades([]);
    expect(m.trade_count).toBe(0);
    expect(m.win_rate).toBe("0.0");
    expect(m.total_return_pct).toBe("0.0");
    expect(m.profit_factor).toBe("0.00");
    expect(m.best_pct).toBeNull();
    expect(m.worst_pct).toBeNull();
  });
});

// 공포·탐욕 지수(Fear & Greed) 라벨 분류 경계값 회귀 보호(R145). 데모 F&G 히스토리 칩 색·문구.
describe("classifyFg", () => {
  it("maps values to labels at each boundary", () => {
    expect(classifyFg(0)).toBe("Extreme Fear");
    expect(classifyFg(24)).toBe("Extreme Fear");
    expect(classifyFg(25)).toBe("Fear");
    expect(classifyFg(44)).toBe("Fear");
    expect(classifyFg(45)).toBe("Neutral");
    expect(classifyFg(55)).toBe("Neutral");
    expect(classifyFg(56)).toBe("Greed");
    expect(classifyFg(74)).toBe("Greed");
    expect(classifyFg(75)).toBe("Extreme Greed");
    expect(classifyFg(100)).toBe("Extreme Greed");
  });
});

// 오프라인 데모(mock) 성과 요약 필터 회귀 보호(R128). 실서버 /signals/performance/summary와
// 같은 형태를 mockAdapter가 이 함수로 흉내낸다.

describe("getSignalPerformanceSummary", () => {
  it("defaults to 1d horizon and returns all 1d rows when unfiltered", () => {
    const rows = getSignalPerformanceSummary({});
    expect(rows.length).toBe(4);
    expect(rows.every((r) => r.horizon === "1d")).toBe(true);
  });

  it("filters by type", () => {
    const rows = getSignalPerformanceSummary({ type: "ABC" });
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.type === "ABC")).toBe(true);
  });

  it("filters by type + timeframe (exact match)", () => {
    const rows = getSignalPerformanceSummary({ type: "ABC", timeframe: "4h" });
    expect(rows.length).toBe(1);
    expect(rows[0].sample_size).toBe(42);
  });

  it("filters by market", () => {
    expect(getSignalPerformanceSummary({ market: "US" }).map((r) => r.type)).toEqual(["TOP"]);
    expect(getSignalPerformanceSummary({ market: "KOSPI" }).map((r) => r.type)).toEqual(["IMALOL"]);
  });

  it("returns empty for a horizon with no rows or an unknown type", () => {
    expect(getSignalPerformanceSummary({ horizon: "7d" })).toEqual([]);
    expect(getSignalPerformanceSummary({ type: "NOPE" })).toEqual([]);
  });
});
