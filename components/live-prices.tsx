"use client";
import { useEffect } from "react";
import type { Client as StompClient, IMessage } from "@stomp/stompjs";
import { useLivePricesStore } from "@/store/livePrices";
import { liveEnabled, wsEndpoint, type LivePriceMessage } from "@/lib/livePrices";
import { authBridge } from "@/store/auth";

/**
 * Headless component: opens a STOMP-over-SockJS connection to the backend
 * price feed and pushes ticks into the live-prices store. Mounted once
 * globally (in Providers). Client-only and best-effort — if the backend WS
 * is unreachable it silently keeps retrying while the app falls back to the
 * REST polling data. Never throws.
 */
export function LivePrices() {
  const setMany = useLivePricesStore((s) => s.setMany);
  const setConnected = useLivePricesStore((s) => s.setConnected);

  useEffect(() => {
    if (!liveEnabled()) return;

    let client: StompClient | null = null;
    let cancelled = false;

    // Dynamically import the WS libs so they never run during SSR / mock mode
    // and stay out of the initial bundle.
    (async () => {
      try {
        const [{ Client }, sockjsMod] = await Promise.all([
          import("@stomp/stompjs"),
          import("sockjs-client"),
        ]);
        if (cancelled) return;
        const SockJS = sockjsMod.default;
        const base = wsEndpoint();
        // Public market data needs no auth per the contract, but if this
        // deployment gates /ws we forward the access token both on the SockJS
        // URL and the STOMP CONNECT frame so a configured backend can accept it.
        const token = authBridge.getAccess();
        const endpoint = token
          ? `${base}?access_token=${encodeURIComponent(token)}`
          : base;
        const connectHeaders: Record<string, string> = token
          ? { Authorization: `Bearer ${token}` }
          : {};

        client = new Client({
          webSocketFactory: () => new SockJS(endpoint) as unknown as WebSocket,
          connectHeaders,
          reconnectDelay: 4000,
          // Keep STOMP's own console noise out of the smoke logs.
          debug: () => {},
          onConnect: () => {
            setConnected(true);
            try {
              client?.subscribe("/topic/prices", (msg: IMessage) => {
                try {
                  const body = JSON.parse(msg.body) as LivePriceMessage;
                  const rows = (body.prices ?? [])
                    .filter((p) => p && p.symbol && p.price != null)
                    .map((p) => ({
                      symbol: p.symbol as string,
                      price: p.price as string,
                      change_rate: p.change_rate ?? null,
                      ts: body.ts ?? null,
                    }));
                  if (rows.length) setMany(rows, body.ts ?? null);
                } catch {
                  /* ignore malformed frame */
                }
              });
            } catch {
              /* ignore subscribe failure */
            }
          },
          onDisconnect: () => setConnected(false),
          onWebSocketClose: () => setConnected(false),
          // STOMP-level and socket-level errors must not bubble up.
          onStompError: () => setConnected(false),
          onWebSocketError: () => setConnected(false),
        });

        client.activate();
      } catch {
        // WS libs failed to load or construct — degrade silently.
        setConnected(false);
      }
    })();

    return () => {
      cancelled = true;
      setConnected(false);
      try {
        client?.deactivate();
      } catch {
        /* ignore teardown errors */
      }
    };
  }, [setMany, setConnected]);

  return null;
}
