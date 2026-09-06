"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { ChartView } from "@/components/chart-view";
import { SignalCard } from "@/components/signal-card";
import { FreshnessBadge, MarketBadge, SentimentBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { ErrorState, EmptyState, StaleNotice, ComplianceFooter } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useInstrument,
  useInstrumentCandles,
  useInstrumentIndicators,
  useInstrumentNews,
  useDerivative,
  useSignals,
  useWatchlist,
  useAddWatchItem,
  useRemoveWatchItem,
} from "@/lib/queries";
import { formatPrice, formatTime, formatRelative } from "@/lib/format";
import { timeframesForMarket, instrumentPathId } from "@/lib/types";
import type { Freshness, Timeframe } from "@/lib/types";
import { extractError } from "@/lib/api";
import { useLivePrice } from "@/store/livePrices";

// Compact USD for open interest, e.g. 7625000000 -> "$7.63B".
function compactUsd(v?: string | null): string {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return "-";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function InstrumentInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data: instrument } = useInstrument(id);
  // Live tick for this instrument's symbol (overlays the candle close below).
  const live = useLivePrice(instrument?.symbol);
  const tfs = timeframesForMarket(instrument?.market);
  const [tf, setTf] = useState<Timeframe>("1d");
  const [showInd, setShowInd] = useState(false);
  // client-computed line overlays (default: clean candles)
  const [showMA, setShowMA] = useState(false);
  const [showBB, setShowBB] = useState(false);

  // when market loads, snap timeframe into the supported set
  useEffect(() => {
    if (instrument && !tfs.includes(tf)) setTf(instrument.market === "CRYPTO" ? "1h" : "1d");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument?.market]);

  const candlesQuery = useInstrumentCandles(id, tf);
  const data = candlesQuery.data?.data;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = candlesQuery;
  const loadOlderCandles = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const freshness =
    (candlesQuery.data?.meta?.freshness as Freshness | undefined) ?? data?.freshness ?? undefined;
  const last = data?.candles?.at(-1);

  const indicatorsQuery = useInstrumentIndicators(id, tf, showInd);

  const signalsQuery = useSignals({ instrument_id: id });
  const recentSignals = signalsQuery.data?.pages.flatMap((p) => p.data) ?? [];

  // Derivatives mini-panel: CRYPTO only. base = symbol without "KRW-" (KRW-BTC→BTC).
  // No perp (404/empty) → panel hidden. useDerivative is disabled for non-crypto.
  const isCrypto = instrument?.market === "CRYPTO" && instrument.symbol?.startsWith("KRW-");
  const derivBase = isCrypto ? instrument!.symbol.slice("KRW-".length) : undefined;
  const derivQuery = useDerivative(derivBase);
  const deriv = derivQuery.data?.data;

  // Related news tagged with this instrument's symbol.
  const newsQuery = useInstrumentNews(instrument?.symbol, 5);
  const relatedNews = newsQuery.data ?? [];

  const { data: watchlist } = useWatchlist();
  const addItem = useAddWatchItem();
  const removeItem = useRemoveWatchItem();
  const inWatchlist = !!watchlist?.items?.some(
    (i) => instrumentPathId(i.instrument?.id) === instrumentPathId(id),
  );

  const err = candlesQuery.error ? extractError(candlesQuery.error) : null;
  const unsupported = err?.code === "UNSUPPORTED_TIMEFRAME";
  const delisted = err?.code === "NOT_FOUND";

  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="뒤로">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold">종목 상세</h1>
      </div>

      <div className="space-y-4 px-4 pb-4">
        {/* price header */}
        <Card>
          <CardContent className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-lg font-semibold">
                  {instrument?.name || instrument?.symbol || id}
                </p>
                {instrument && <MarketBadge market={instrument.market} />}
              </div>
              {instrument?.name && (
                <p className="text-sm text-muted-foreground">{instrument.symbol}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xl font-bold tabular-nums">{formatPrice(live?.price ?? last?.close)}</p>
              <FreshnessBadge freshness={freshness} updatedAt={last?.open_time} />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button
            variant={inWatchlist ? "secondary" : "outline"}
            size="sm"
            disabled={addItem.isPending || removeItem.isPending}
            onClick={() => (inWatchlist ? removeItem.mutate(id) : addItem.mutate(id))}
          >
            {inWatchlist ? "관심 해제" : "관심 등록"}
          </Button>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            지표 오버레이
            <Switch checked={showInd} onCheckedChange={setShowInd} aria-label="지표 오버레이" />
          </label>
        </div>

        {/* timeframe tabs (market-aware) */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {tfs.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={cn(
                "shrink-0 rounded-md border px-3 py-2 text-sm transition-colors",
                tf === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* overlay toggles (client-computed indicator lines) */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowMA((v) => !v)}
            aria-pressed={showMA}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              showMA ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
            )}
          >
            MA
          </button>
          <button
            type="button"
            onClick={() => setShowBB((v) => !v)}
            aria-pressed={showBB}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              showBB ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
            )}
          >
            볼린저
          </button>
        </div>

        {freshness === "DELAYED" && <StaleNotice updatedAt={last?.open_time} onRefresh={() => candlesQuery.refetch()} />}

        {/* chart */}
        <Card>
          <CardContent>
            {candlesQuery.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : unsupported ? (
              <EmptyState title="미지원 주기" description="이 종목은 해당 주기를 지원하지 않습니다." />
            ) : delisted ? (
              <EmptyState title="상장폐지/미지원 종목" description="조회할 수 없는 종목입니다." />
            ) : candlesQuery.isError ? (
              <ErrorState error={candlesQuery.error} onRetry={() => candlesQuery.refetch()} />
            ) : (
              <ChartView
                candles={data?.candles ?? []}
                indicators={indicatorsQuery.data}
                showIndicators={showInd}
                overlays={{ ma: showMA, bollinger: showBB }}
                onLoadOlder={loadOlderCandles}
                hasOlder={!!hasNextPage}
                isLoadingOlder={isFetchingNextPage}
              />
            )}
          </CardContent>
        </Card>

        {/* indicators summary */}
        {showInd && indicatorsQuery.data && (
          <Card>
            <CardContent className="space-y-1 text-sm">
              <h2 className="text-sm font-semibold">지표 요약 ({tf})</h2>
              <div className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground tabular-nums">
                <span>RSI {indicatorsQuery.data.rsi14 ?? "-"}</span>
                <span>MA20 {formatPrice(indicatorsQuery.data.ma20)}</span>
                <span>MA60 {formatPrice(indicatorsQuery.data.ma60)}</span>
                <span>볼린저↑ {formatPrice(indicatorsQuery.data.boll_upper)}</span>
                <span>볼린저↓ {formatPrice(indicatorsQuery.data.boll_lower)}</span>
                <span>MACD {indicatorsQuery.data.macd}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* derivatives mini-panel (CRYPTO only; hidden when the coin has no perp) */}
        {isCrypto && deriv && (() => {
          const fr = Number(deriv.funding_rate);
          const hasFr = deriv.funding_rate != null && deriv.funding_rate !== "" && !Number.isNaN(fr);
          const lsr = Number(deriv.long_short_ratio);
          const hasLsr = deriv.long_short_ratio != null && deriv.long_short_ratio !== "" && !Number.isNaN(lsr);
          // Long share for the bar: ratio = long/short, so long% = r/(1+r).
          const longPct = hasLsr ? Math.max(0, Math.min(100, (lsr / (1 + lsr)) * 100)) : 50;
          return (
            <Card>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">파생</h2>
                  <Link
                    href={`/derivatives/${derivBase}`}
                    className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    상세 →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-border px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">펀딩비</p>
                    <p className={cn("font-semibold tabular-nums", !hasFr ? "" : fr >= 0 ? "text-[hsl(var(--success))]" : "text-destructive")}>
                      {hasFr ? `${fr >= 0 ? "+" : ""}${(fr * 100).toFixed(4)}%` : "-"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">미결제약정</p>
                    <p className="font-semibold tabular-nums">{compactUsd(deriv.oi_value_usd)}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>롱/숏 {hasLsr ? lsr.toFixed(2) : "-"}</span>
                    <span className="tabular-nums">{hasLsr ? `${longPct.toFixed(0)}% 롱` : ""}</span>
                  </div>
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-destructive/40">
                    <div
                      className="h-full bg-[hsl(var(--success))]"
                      style={{ width: `${longPct}%` }}
                      aria-hidden
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* recent signals */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">최근 신호</h2>
          {signalsQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : recentSignals.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">최근 신호가 없습니다.</p>
          ) : (
            recentSignals.map((s) => <SignalCard key={s.id} signal={s} />)
          )}
        </div>

        {/* 관련 속보 — latest news tagged with this instrument's symbol */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">관련 속보</h2>
          {newsQuery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : relatedNews.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">관련 속보 없음</p>
          ) : (
            relatedNews.map((n) => (
              <Link key={n.id} href={`/news/${n.id}`} className="block">
                <Card className="transition-colors hover:bg-accent/40">
                  <CardContent className="space-y-1 py-2.5">
                    <div className="flex items-center gap-2">
                      <SentimentBadge sentiment={n.sentiment} />
                      {n.is_new && <Badge variant="success">NEW</Badge>}
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {formatRelative(n.published_at)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm font-medium">
                      {n.title || n.body || "(제목 없음)"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          데이터 출처 {data?.provider ?? "-"} · {formatTime(last?.open_time)}
        </p>
      </div>
      <ComplianceFooter />
    </div>
  );
}

export default function InstrumentPage() {
  return (
    <RequireAuth>
      <InstrumentInner />
    </RequireAuth>
  );
}
