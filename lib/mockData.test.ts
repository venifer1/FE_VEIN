import { describe, it, expect } from "vitest";
import { getSignalPerformanceSummary } from "./mockData";

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
