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
