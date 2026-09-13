import { describe, it, expect } from "vitest";
import { sma, bollinger } from "./indicators";

// 차트 오버레이(chart-view.tsx)가 캔들 종가로 그리는 SMA/볼린저밴드 순수 계산 회귀 보호(R144).

describe("sma", () => {
  it("aligns to input with leading nulls until window fills", () => {
    // 창 3: index 0,1은 null, 이후 이동평균
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it("returns all null when closes shorter than window", () => {
    expect(sma([1, 2], 3)).toEqual([null, null]);
  });

  it("returns all null for non-positive window", () => {
    expect(sma([1, 2, 3], 0)).toEqual([null, null, null]);
  });

  it("window of 1 echoes each close", () => {
    expect(sma([7, 8, 9], 1)).toEqual([7, 8, 9]);
  });

  it("empty input yields empty output", () => {
    expect(sma([], 5)).toEqual([]);
  });
});

describe("bollinger", () => {
  it("middle equals SMA and bands collapse to it for a constant series (sd=0)", () => {
    const { upper, middle, lower } = bollinger([5, 5, 5, 5], 2, 2);
    expect(middle).toEqual([null, 5, 5, 5]);
    expect(upper).toEqual([null, 5, 5, 5]);
    expect(lower).toEqual([null, 5, 5, 5]);
  });

  it("bands are middle ± mult * population stddev", () => {
    // [2,4,6,8], n=2, mult=1: index 1에서 평균 3, 편차 ±1 → sd=1
    const { upper, middle, lower } = bollinger([2, 4, 6, 8], 2, 1);
    expect(middle[1]).toBe(3);
    expect(upper[1]).toBeCloseTo(4, 10);
    expect(lower[1]).toBeCloseTo(2, 10);
    // index 3: 창 {6,8} → 평균 7, 편차 ±1 → sd=1
    expect(middle[3]).toBe(7);
    expect(upper[3]).toBeCloseTo(8, 10);
    expect(lower[3]).toBeCloseTo(6, 10);
  });

  it("leading entries below window are null", () => {
    const { upper, middle, lower } = bollinger([1, 2, 3], 3, 2);
    expect([middle[0], middle[1]]).toEqual([null, null]);
    expect([upper[0], upper[1]]).toEqual([null, null]);
    expect([lower[0], lower[1]]).toEqual([null, null]);
    expect(middle[2]).toBe(2); // (1+2+3)/3
  });
});
