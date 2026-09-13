import { describe, it, expect } from "vitest";
import { formatPct, pctSign, formatScore, formatPrice, formatRelative } from "./format";

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
