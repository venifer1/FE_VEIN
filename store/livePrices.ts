import { create } from "zustand";

export interface LivePrice {
  price: string;
  change_rate: string | null;
  ts: string | null;
}

interface LivePriceInput {
  symbol: string;
  price: string;
  change_rate?: string | null;
  ts?: string | null;
}

interface LivePricesState {
  // symbol -> latest tick. A plain Map kept in state; we replace the ref on
  // each batch so Zustand subscribers re-render.
  prices: Map<string, LivePrice>;
  connected: boolean;
  setConnected: (connected: boolean) => void;
  setMany: (rows: LivePriceInput[], ts?: string | null) => void;
}

export const useLivePricesStore = create<LivePricesState>((set) => ({
  prices: new Map(),
  connected: false,

  setConnected: (connected) => set({ connected }),

  setMany: (rows, ts) =>
    set((state) => {
      if (!rows || rows.length === 0) return state;
      const next = new Map(state.prices);
      for (const r of rows) {
        if (!r || !r.symbol || r.price == null || r.price === "") continue;
        next.set(r.symbol, {
          price: r.price,
          change_rate: r.change_rate ?? null,
          ts: r.ts ?? ts ?? null,
        });
      }
      return { prices: next };
    }),
}));

/** Read the latest live tick for a symbol, or undefined if none seen yet. */
export function useLivePrice(symbol?: string | null): LivePrice | undefined {
  return useLivePricesStore((s) => (symbol ? s.prices.get(symbol) : undefined));
}

/** Read the live-feed connected flag (for a LIVE indicator). */
export function useLiveConnected(): boolean {
  return useLivePricesStore((s) => s.connected);
}
