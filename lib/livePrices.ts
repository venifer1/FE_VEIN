import { BASE, USE_MOCK } from "./api";

/**
 * Derive the WebSocket base from the REST API base.
 * e.g. "http://localhost:8080/api/v1" -> "http://localhost:8080".
 * An explicit NEXT_PUBLIC_WS_BASE overrides this entirely.
 */
export function wsBase(): string {
  const override = process.env.NEXT_PUBLIC_WS_BASE;
  if (override && override.trim() !== "") return override.replace(/\/+$/, "");
  // Strip a trailing /api/v1 (or any /api/...) segment from the REST base.
  return BASE.replace(/\/api(\/v\d+)?\/?$/, "").replace(/\/+$/, "");
}

/** Full SockJS endpoint URL, e.g. "http://localhost:8080/ws". */
export function wsEndpoint(): string {
  return `${wsBase()}/ws`;
}

/**
 * Whether the live WS feed should run. Requires:
 *  - a browser (no SSR),
 *  - mock mode OFF (mock data is static),
 *  - the realtime feed explicitly enabled.
 *
 * Realtime is opt-in because SockJS performs an XHR `/info` probe on connect;
 * if the `/ws` endpoint is unreachable or auth-gated the browser logs a
 * console error on every attempt (which CI/smoke treats as a failure). The
 * feed turns on when EITHER `NEXT_PUBLIC_LIVE_WS=true` is set, OR an explicit
 * `NEXT_PUBLIC_WS_BASE` override is provided (signalling the operator has a
 * reachable, public feed per the backend contract). When off, the UI simply
 * keeps rendering REST-polled data — the documented graceful-degradation path.
 */
export function liveEnabled(): boolean {
  if (typeof window === "undefined" || USE_MOCK) return false;
  const flag = process.env.NEXT_PUBLIC_LIVE_WS === "true";
  const override =
    !!process.env.NEXT_PUBLIC_WS_BASE &&
    process.env.NEXT_PUBLIC_WS_BASE.trim() !== "";
  return flag || override;
}

// Shape of a single price entry inside a /topic/prices message.
export interface LivePriceMessage {
  market?: string;
  ts?: string;
  prices?: Array<{
    symbol?: string;
    price?: string;
    change_rate?: string | null;
  }>;
}
