import { describe, it, expect } from "vitest";
import {
  stripIdPrefix,
  signalPathId,
  instrumentPathId,
  timeframesForMarket,
  COIN_TIMEFRAMES,
  STOCK_TIMEFRAMES,
} from "./types";

// 순수 헬퍼 회귀 보호(R122).

describe("stripIdPrefix", () => {
  it("strips a leading letter prefix + underscore", () => {
    expect(stripIdPrefix("sig_275")).toBe("275");
    expect(stripIdPrefix("ins_btc")).toBe("btc");
    expect(stripIdPrefix("pord_12")).toBe("12");
  });
  it("returns as-is when no prefix, and handles numbers/null", () => {
    expect(stripIdPrefix("275")).toBe("275");
    expect(stripIdPrefix(42)).toBe("42");
    expect(stripIdPrefix(null)).toBe("");
    expect(stripIdPrefix(undefined)).toBe("");
  });
  it("signalPathId/instrumentPathId are the same stripper", () => {
    expect(signalPathId("sig_9")).toBe("9");
    expect(instrumentPathId("ins_9")).toBe("9");
  });
});

describe("timeframesForMarket", () => {
  it("crypto/undefined -> full intraday set", () => {
    expect(timeframesForMarket("CRYPTO")).toEqual(COIN_TIMEFRAMES);
    expect(timeframesForMarket(undefined)).toEqual(COIN_TIMEFRAMES);
    expect(timeframesForMarket("CRYPTO")).toContain("15m");
  });
  it("equities -> day/3d/week only", () => {
    for (const m of ["US", "KOSPI", "KOSDAQ"] as const) {
      expect(timeframesForMarket(m)).toEqual(STOCK_TIMEFRAMES);
      expect(timeframesForMarket(m)).not.toContain("15m");
    }
  });
});
