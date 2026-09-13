import { describe, it, expect } from "vitest";
import {
  toCho,
  isChoQuery,
  num,
  trimNum,
  idMatches,
  parseUrl,
  body,
  buildNotificationDigest,
  upcomingMacroEvents,
} from "./mockAdapter";
import type { InternalAxiosRequestConfig } from "axios";
import type { Notification } from "./types";

const cfg = (url?: string, params?: unknown, data?: unknown) =>
  ({ url, params, data }) as unknown as InternalAxiosRequestConfig;

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

describe("idMatches (딥링크 경로 id 매칭)", () => {
  it("matches exact ids (string or number)", () => {
    expect(idMatches("2", "2")).toBe(true);
    expect(idMatches(2, "2")).toBe(true);
    expect(idMatches("usr_2", "usr_2")).toBe(true);
  });

  it("matches when a single leading alpha prefix is stripped", () => {
    expect(idMatches("usr_2", "2")).toBe(true);
    expect(idMatches("paper_1", "1")).toBe(true);
  });

  it("does not match a different id", () => {
    expect(idMatches("usr_2", "3")).toBe(false);
  });

  it("strips only the first alpha_ segment, not nested ones", () => {
    expect(idMatches("abc_def_2", "2")).toBe(false); // → "def_2" ≠ "2"
  });

  it("requires an underscore to strip; matching is case-sensitive", () => {
    expect(idMatches("BTC", "btc")).toBe(false);
    expect(idMatches("BTC", "BTC")).toBe(true);
  });
});

describe("buildNotificationDigest (알림 다이제스트 R45)", () => {
  let seq = 0;
  const notif = (o: Partial<Notification>): Notification => ({
    id: ++seq,
    status: "SENT",
    created_at: new Date(Date.now() - 60_000).toISOString(), // 1분 전(창 안)
    ...o,
  });

  it("categorizes by signal_id and title prefix, counts unread", () => {
    const d = buildNotificationDigest(
      [
        notif({ signal_id: 5 }), // SIGNAL (unread)
        notif({ title: "Scanner match: RSI<30", read_at: new Date().toISOString() }), // SCANNER (read)
        notif({ title: "Liquidation spike on BTC" }), // LIQUIDATION (unread)
        notif({ title: "안내 메시지", status: "READ" }), // SYSTEM (read via status)
      ],
      24,
    );
    expect(d.total).toBe(4);
    expect(d.unread).toBe(2); // signal + liquidation
    const byCat = Object.fromEntries(d.categories.map((c) => [c.category, c]));
    expect(byCat.SIGNAL.total).toBe(1);
    expect(byCat.SCANNER.total).toBe(1);
    expect(byCat.LIQUIDATION.total).toBe(1);
    expect(byCat.SYSTEM.total).toBe(1);
    expect(byCat.SIGNAL.unread).toBe(1);
    expect(byCat.SCANNER.unread).toBe(0);
  });

  it("excludes notifications older than the window", () => {
    const d = buildNotificationDigest(
      [
        notif({ created_at: new Date(Date.now() - 60_000).toISOString() }), // 1분 전 → 포함
        notif({ created_at: new Date(Date.now() - 5 * 3_600_000).toISOString() }), // 5시간 전 → 제외
      ],
      1, // 창 1시간
    );
    expect(d.total).toBe(1);
  });

  it("empty window yields a zero digest", () => {
    const d = buildNotificationDigest([], 24);
    expect(d.total).toBe(0);
    expect(d.unread).toBe(0);
    expect(d.categories).toEqual([]);
  });
});

describe("upcomingMacroEvents (경제 캘린더 R39)", () => {
  it("filters seeds by the day window and reports dday", () => {
    expect(upcomingMacroEvents(1).map((e) => e.dday)).toEqual([1]);
    expect(upcomingMacroEvents(10).map((e) => e.dday)).toEqual([1, 4, 9]);
  });

  it("clamps the window into [1,90]", () => {
    // 0 이하는 1로, 90 초과는 90으로
    expect(upcomingMacroEvents(0).map((e) => e.dday)).toEqual([1]);
    expect(upcomingMacroEvents(1000).map((e) => e.dday)).toEqual([1, 4, 9, 22]);
  });

  it("date equals today + dday (UTC yyyy-MM-dd)", () => {
    const first = upcomingMacroEvents(30)[0];
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + first.dday);
    expect(first.date).toBe(d.toISOString().slice(0, 10));
    expect(first.region).toBe("US");
  });
});

describe("parseUrl (경로/쿼리 파싱)", () => {
  it("splits path and query string, strips trailing slashes", () => {
    const { path, params } = parseUrl(cfg("/signals/top?limit=5"));
    expect(path).toBe("/signals/top");
    expect(params.get("limit")).toBe("5");
    expect(parseUrl(cfg("/signals/")).path).toBe("/signals");
    expect(parseUrl(cfg("/a/b///")).path).toBe("/a/b");
  });

  it("merges config.params, skipping undefined/null/empty and stringifying", () => {
    const { params } = parseUrl(cfg("/x", { a: 1, b: "", c: null, d: undefined, e: "z" }));
    expect(params.get("a")).toBe("1");
    expect(params.get("e")).toBe("z");
    expect(params.has("b")).toBe(false);
    expect(params.has("c")).toBe(false);
    expect(params.has("d")).toBe(false);
  });

  it("config.params overrides a query value with the same key", () => {
    expect(parseUrl(cfg("/x?a=1", { a: 2 })).params.get("a")).toBe("2");
  });

  it("handles missing url and empty query", () => {
    expect(parseUrl(cfg(undefined)).path).toBe("");
    expect([...parseUrl(cfg("/x")).params.keys()]).toEqual([]);
  });
});

describe("body (요청 본문 파싱)", () => {
  it("parses JSON string data", () => {
    expect(body(cfg("/x", undefined, '{"a":1}'))).toEqual({ a: 1 });
  });

  it("returns {} for invalid JSON string or no data", () => {
    expect(body(cfg("/x", undefined, "not json"))).toEqual({});
    expect(body(cfg("/x"))).toEqual({});
    expect(body(cfg("/x", undefined, ""))).toEqual({});
  });

  it("passes an object body through unchanged", () => {
    const obj = { a: 1, nested: { b: 2 } };
    expect(body(cfg("/x", undefined, obj))).toBe(obj);
  });
});
