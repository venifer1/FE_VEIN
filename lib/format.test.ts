import { describe, it, expect } from "vitest";
import {
  formatPct,
  pctSign,
  formatScore,
  formatPrice,
  formatRelative,
  compactUsd,
  formatTime,
  toChartTime,
  koreanMoney,
} from "./format";

// FE 순수 표시 헬퍼 회귀 보호(R122). 값은 문자열 소수로 들어와 표시 시점에만 포맷된다.

describe("formatPct", () => {
  it("adds + for positive, keeps - for negative, fixes fraction", () => {
    expect(formatPct("3.2")).toBe("+3.20%");
    expect(formatPct("-0.8")).toBe("-0.80%");
    expect(formatPct("0")).toBe("0.00%");
  });
  it("is null/blank-safe and passes garbage through", () => {
    expect(formatPct(null)).toBe("-");
    expect(formatPct("")).toBe("-");
    expect(formatPct("abc")).toBe("abc");
  });
});

describe("pctSign", () => {
  it("returns 1/-1/0", () => {
    expect(pctSign("1.5")).toBe(1);
    expect(pctSign("-1.5")).toBe(-1);
    expect(pctSign("0")).toBe(0);
    expect(pctSign(null)).toBe(0);
    expect(pctSign("garbage")).toBe(0);
  });
});

describe("formatScore", () => {
  it("fixes to one decimal, null-safe", () => {
    expect(formatScore("82.5")).toBe("82.5");
    expect(formatScore("76")).toBe("76.0");
    expect(formatScore(null)).toBe("-");
  });
});

describe("formatPrice", () => {
  it("uses 0 fraction + thousands separator for >=1000", () => {
    expect(formatPrice("145599287")).toBe("145,599,287");
  });
  it("uses more fraction for sub-1 values", () => {
    expect(formatPrice("0.00123456")).toBe("0.00123456");
  });
  it("null/blank -> dash, garbage passthrough", () => {
    expect(formatPrice(null)).toBe("-");
    expect(formatPrice("")).toBe("-");
    expect(formatPrice("x")).toBe("x");
  });
});

describe("compactUsd", () => {
  it("scales to T/B/M", () => {
    expect(compactUsd("1500000000000")).toBe("$1.50T");
    expect(compactUsd("7625000000")).toBe("$7.63B");
    expect(compactUsd("2100000")).toBe("$2.10M");
  });
  it("below 1M uses locale grouping", () => {
    expect(compactUsd("12345")).toBe("$12,345");
  });
  it("handles negatives and null/garbage", () => {
    expect(compactUsd("-1500000000")).toBe("$-1.50B");
    expect(compactUsd(null)).toBe("-");
    expect(compactUsd("x")).toBe("-");
  });
});

describe("koreanMoney", () => {
  it("formats 억/만원", () => {
    expect(koreanMoney(10000000)).toBe("1,000만원");
    expect(koreanMoney(150000000)).toBe("1억 5,000만원");
    expect(koreanMoney(100000000)).toBe("1억원");
  });
  it("returns empty below 1만 or non-finite", () => {
    expect(koreanMoney(9999)).toBe("");
    expect(koreanMoney(0)).toBe("");
    expect(koreanMoney(NaN)).toBe("");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-06-12T15:00:00Z");
  it("buckets seconds/minutes/hours/days ago", () => {
    expect(formatRelative(new Date("2026-06-12T14:59:30Z").toISOString(), now)).toBe("30초 전");
    expect(formatRelative(new Date("2026-06-12T14:30:00Z").toISOString(), now)).toBe("30분 전");
    expect(formatRelative(new Date("2026-06-12T12:00:00Z").toISOString(), now)).toBe("3시간 전");
    expect(formatRelative(new Date("2026-06-10T15:00:00Z").toISOString(), now)).toBe("2일 전");
  });
  it("null-safe", () => {
    expect(formatRelative(null, now)).toBe("-");
  });
});

describe("toChartTime", () => {
  it("converts ISO to epoch seconds", () => {
    // 독립 구성(Date.UTC)으로 교차검증 — 구현 자기참조 회피.
    expect(toChartTime("2026-06-12T15:00:00Z")).toBe(Date.UTC(2026, 5, 12, 15, 0, 0) / 1000);
  });
});

describe("formatTime", () => {
  it("null -> dash, invalid iso -> passthrough", () => {
    expect(formatTime(null)).toBe("-");
    expect(formatTime("")).toBe("-");
    expect(formatTime("not-a-date")).toBe("not-a-date");
  });
});
