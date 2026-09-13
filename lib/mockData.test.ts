import { describe, it, expect } from "vitest";
import { getSignalPerformanceSummary, classifyFg, metricsFromTrades } from "./mockData";
import type { BacktestTrade } from "./types";

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
