import { describe, it, expect, beforeEach } from "vitest";
import { useLivePricesStore } from "./livePrices";

// 라이브 WS 가격 스토어의 병합/필터 로직 회귀 보호(R140). 프로덕션 실시간 피드에서 동작.

function reset() {
  useLivePricesStore.setState({ prices: new Map(), connected: false });
}

describe("livePrices store", () => {
  beforeEach(reset);

  it("setMany stores valid rows", () => {
    useLivePricesStore.getState().setMany([{ symbol: "KRW-BTC", price: "100", change_rate: "1.5" }]);
    const p = useLivePricesStore.getState().prices.get("KRW-BTC");
    expect(p?.price).toBe("100");
    expect(p?.change_rate).toBe("1.5");
  });

  it("skips rows with no symbol or null/empty price", () => {
    // 런타임 방어(무효 행 스킵)를 검증 — TS상 불가한 null/빈 price를 의도적으로 주입.
    const invalidRows = [
      { symbol: "", price: "1" },
      { symbol: "KRW-ETH", price: null },
      { symbol: "KRW-SOL", price: "" },
      { symbol: "KRW-XRP", price: "3" },
    ] as unknown as Array<{ symbol: string; price: string }>;
    useLivePricesStore.getState().setMany(invalidRows);
    const prices = useLivePricesStore.getState().prices;
    expect(prices.has("KRW-ETH")).toBe(false);
    expect(prices.has("KRW-SOL")).toBe(false);
    expect(prices.get("KRW-XRP")?.price).toBe("3");
  });

  it("merges into existing map (other symbols preserved)", () => {
    const s = useLivePricesStore.getState();
    s.setMany([{ symbol: "KRW-BTC", price: "100" }]);
    s.setMany([{ symbol: "KRW-ETH", price: "50" }]);
    const prices = useLivePricesStore.getState().prices;
    expect(prices.get("KRW-BTC")?.price).toBe("100");
    expect(prices.get("KRW-ETH")?.price).toBe("50");
  });

  it("ts falls back row.ts -> batch ts -> null; change_rate defaults null", () => {
    useLivePricesStore.getState().setMany(
      [
        { symbol: "A", price: "1", ts: "2026-01-01T00:00:00Z" },
        { symbol: "B", price: "2" },
      ],
      "2026-06-01T00:00:00Z",
    );
    const prices = useLivePricesStore.getState().prices;
    expect(prices.get("A")?.ts).toBe("2026-01-01T00:00:00Z");
    expect(prices.get("B")?.ts).toBe("2026-06-01T00:00:00Z");
    expect(prices.get("B")?.change_rate).toBeNull();
  });

  it("empty rows is a no-op", () => {
    useLivePricesStore.getState().setMany([{ symbol: "A", price: "1" }]);
    const before = useLivePricesStore.getState().prices;
    useLivePricesStore.getState().setMany([]);
    expect(useLivePricesStore.getState().prices).toBe(before);
  });

  it("setConnected toggles flag", () => {
    useLivePricesStore.getState().setConnected(true);
    expect(useLivePricesStore.getState().connected).toBe(true);
  });
});
