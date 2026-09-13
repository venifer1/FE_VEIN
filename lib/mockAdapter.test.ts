import { describe, it, expect } from "vitest";
import { toCho, isChoQuery, num, trimNum } from "./mockAdapter";

// 데모(mock) 종목 검색·숫자 표기 순수 헬퍼 회귀 보호(R148).

describe("toCho (한글 초성 추출)", () => {
  it("maps Hangul syllables to their leading consonant", () => {
    expect(toCho("비트코인")).toBe("ㅂㅌㅋㅇ");
    expect(toCho("삼성전자")).toBe("ㅅㅅㅈㅈ");
  });

  it("passes non-Hangul characters through unchanged", () => {
    expect(toCho("BTC")).toBe("BTC");
    expect(toCho("btc 비트")).toBe("btc ㅂㅌ");
    expect(toCho("")).toBe("");
  });
});

describe("isChoQuery (초성만으로 된 검색어인가)", () => {
  it("true only when every char is a Hangul lead consonant", () => {
    expect(isChoQuery("ㅂㅌ")).toBe(true);
    expect(isChoQuery("ㅅㅅㅈㅈ")).toBe(true);
  });

  it("false for full syllables, latin, mixed, or empty", () => {
    expect(isChoQuery("비트")).toBe(false);
    expect(isChoQuery("BTC")).toBe(false);
    expect(isChoQuery("ㅂX")).toBe(false);
    expect(isChoQuery("")).toBe(false);
  });
});

describe("num (안전한 숫자 파싱)", () => {
  it("returns 0 for null/undefined, parses numeric strings", () => {
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num("")).toBe(0);
    expect(num("3.5")).toBe(3.5);
    expect(num("-2")).toBe(-2);
  });
});

describe("trimNum (불필요한 소수 0 제거)", () => {
  it("drops trailing zeros and dangling decimal point", () => {
    expect(trimNum(2)).toBe("2");
    expect(trimNum(1.5)).toBe("1.5");
    expect(trimNum(0.1)).toBe("0.1");
    expect(trimNum(100)).toBe("100");
    expect(trimNum(1.23456789)).toBe("1.23456789");
  });
});
