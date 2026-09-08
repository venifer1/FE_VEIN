"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { RegimeBanner } from "@/components/regime-banner";
import { EconomicCalendar } from "@/components/economic-calendar";
import { InstrumentSearch } from "@/components/instrument-search";
import { InstrumentLabel } from "@/components/instrument-label";
import { Sparkline } from "@/components/sparkline";
import { StatusBadge, TypeBadge, FreshnessBadge } from "@/components/badges";
import { EmptyState, ErrorState, StaleNotice, ComplianceFooter, PartialErrorNotice } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useMarketIndices, useKimchiPremium, useWatchlist, useFearGreedHistory, useIndexHistory, useMovers, useTrending, useGlobalMarket } from "@/lib/queries";
import { formatPrice } from "@/lib/format";
import { indicesByKey, instrumentPathId } from "@/lib/types";
import type { Freshness, Market, MoverType, WatchlistItem } from "@/lib/types";
import { useLivePrice, useLiveConnected } from "@/store/livePrices";

// Small realtime indicator: green dot + "LIVE" when the WS feed is connected.
function LiveDot() {
  const connected = useLiveConnected();
  if (!connected) return null;
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-[hsl(var(--success))]">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--success))]" />
      LIVE
    </span>
  );
}

// Color a fear & greed value: low = fear (red), high = greed (green).
function fgColor(v?: number): string {
  if (v == null || Number.isNaN(v)) return "hsl(var(--muted-foreground))";
  if (v <= 24) return "hsl(var(--destructive))";
  if (v <= 44) return "hsl(var(--warning))";
  if (v <= 55) return "hsl(var(--muted-foreground))";
  return "hsl(var(--success))";
}

function compactUsd(v?: string | null): string {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return "-";
  if (n >= 1e12) return `₩${(n / 1e12).toFixed(2)}조`;
  if (n >= 1e8) return `₩${(n / 1e8).toFixed(0)}억`;
  if (n >= 1e4) return `₩${(n / 1e4).toFixed(0)}만`;
  return `₩${n.toLocaleString("ko-KR")}`;
}

// Compact USD with a Korean 조(=1e12)/억(=1e8) scale, e.g. "$3.42조". Null-safe.
function compactUsdScaled(v?: string | null): string {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return "-";
  const neg = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e12) return `${neg}$${(a / 1e12).toFixed(2)}조`;
  if (a >= 1e8) return `${neg}$${(a / 1e8).toFixed(2)}억`;
  if (a >= 1e4) return `${neg}$${(a / 1e4).toFixed(0)}만`;
  return `${neg}$${a.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtNum(v?: string | null, frac = 2): string {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return n.toLocaleString("ko-KR", { maximumFractionDigits: frac });
}

function FearGreedMetric({ value, classification }: { value?: string | null; classification?: string | null }) {
  const { data } = useFearGreedHistory(30);
  const points = data?.data ?? [];
  const series = points.map((p) => Number(p.value)).filter((n) => Number.isFinite(n));
  const latest = series.at(-1) ?? (value != null && value !== "" ? Number(value) : undefined);
  const display = value != null && value !== "" ? fmtNum(value, 0) : latest != null ? String(Math.round(latest)) : "-";
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">공포·탐욕 (30일)</p>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold tabular-nums">{display}</p>
          <p className="truncate text-[11px] text-muted-foreground">{classification ?? "-"}</p>
        </div>
        {series.length > 0 && (
          <Sparkline values={series} width={60} height={26} color={fgColor(latest)} className="shrink-0" />
        )}
      </div>
    </div>
  );
}

// Compact global market line: 총 시가총액 (+24h 변동률) · 24h 거래량. Slow query;
// renders nothing while loading/erroring/empty so it never pushes the fold.
function GlobalMarketSection() {
  const { data } = useGlobalMarket();
  const g = data?.data;
  if (!g) return null;

  const chgStr = g.market_cap_change24h_pct;
  const chg = chgStr != null && chgStr !== "" ? Number(chgStr) : NaN;
  const hasChg = !Number.isNaN(chg);

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-muted-foreground">총 시가총액</span>
          <span className="font-semibold tabular-nums">{compactUsdScaled(g.total_market_cap_usd)}</span>
          {hasChg && (
            <span
              className={cn(
                "text-xs tabular-nums",
                chg >= 0 ? "text-[hsl(var(--success))]" : "text-destructive",
              )}
            >
              {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
            </span>
          )}
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-muted-foreground">24h 거래량</span>
          <span className="font-semibold tabular-nums">{compactUsdScaled(g.total_volume_usd)}</span>
        </span>
      </CardContent>
    </Card>
  );
}

// Generic index gauge with a sparkline drawn from its history series. Falls
// back to value-only (no chart) when history is unavailable/too short.
function IndexMetric({
  label,
  indexKey,
  value,
  fmt,
}: {
  label: string;
  indexKey: string;
  value?: string | null;
  fmt: (v?: string | null) => string;
}) {
  const { data } = useIndexHistory(indexKey);
  const series = (data?.data ?? []).map((p) => Number(p.value)).filter((n) => Number.isFinite(n));
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold tabular-nums">{fmt(value)}</p>
        {series.length > 1 && (
          <Sparkline values={series} width={56} height={24} color="hsl(var(--primary))" className="shrink-0" />
        )}
      </div>
    </div>
  );
}

function IndicesSection() {
  const { data, isLoading, isError, error, refetch } = useMarketIndices();
  const rows = data?.data;
  const freshness = (data?.meta?.freshness as Freshness | undefined) ?? undefined;

  if (isLoading) return <Skeleton className="h-44 w-full" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} title="시장지표 호출 실패" />;
  if (!rows) return null;

  // Build a lookup keyed by index `key` (array -> map).
  const idx = indicesByKey(rows);
  const fg = idx.FEAR_GREED;
  const collectedAt = fg?.collected_at ?? rows[0]?.collected_at ?? null;

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">시장지표</h2>
          <FreshnessBadge freshness={freshness} updatedAt={collectedAt} />
        </div>
        {freshness === "DELAYED" && <StaleNotice updatedAt={collectedAt} onRefresh={() => refetch()} />}
        <div className="grid grid-cols-2 gap-2">
          <FearGreedMetric value={fg?.value} classification={fg?.classification} />
          <IndexMetric label="알트코인 지수" indexKey="ALT_INDEX" value={idx.ALT_INDEX?.value} fmt={(v) => fmtNum(v, 0)} />
          <IndexMetric label="BTC 도미넌스" indexKey="BTC_DOMINANCE" value={idx.BTC_DOMINANCE?.value} fmt={(v) => `${fmtNum(v)}%`} />
          <IndexMetric label="USDT 도미넌스" indexKey="USDT_DOMINANCE" value={idx.USDT_DOMINANCE?.value} fmt={(v) => `${fmtNum(v)}%`} />
          <IndexMetric label="나스닥" indexKey="NASDAQ" value={idx.NASDAQ?.value} fmt={(v) => fmtNum(v)} />
          <IndexMetric label="코스피" indexKey="KOSPI" value={idx.KOSPI?.value} fmt={(v) => fmtNum(v)} />
          <IndexMetric label="코스닥" indexKey="KOSDAQ" value={idx.KOSDAQ?.value} fmt={(v) => fmtNum(v)} />
        </div>
      </CardContent>
    </Card>
  );
}

function KimchiRow({ r }: { r: import("@/lib/types").KimchiPremiumRow }) {
  // Overlay the live upbit price for this symbol when the WS feed has it.
  const live = useLivePrice(r.symbol);
  const price = live?.price ?? r.upbit_price;
  const prem = Number(r.premium_pct);
  const hasId = r.instrument_id != null && r.instrument_id !== "";
  const inner = (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <InstrumentLabel name={r.name} symbol={r.symbol} />
        {r.pinned && <span className="shrink-0 rounded bg-primary/15 px-1 text-[10px] text-primary">고정</span>}
      </span>
      <span className="flex items-center gap-3 tabular-nums">
        <span className="text-muted-foreground">{formatPrice(price)}</span>
        <span className={cn(prem >= 0 ? "text-[hsl(var(--success))]" : "text-destructive")}>
          {prem >= 0 ? "+" : ""}{prem.toFixed(2)}%
        </span>
      </span>
    </>
  );
  return (
    <li>
      {hasId ? (
        <Link
          href={`/instruments/${instrumentPathId(r.instrument_id)}`}
          className="flex items-center justify-between gap-2 py-2 hover:bg-accent/30"
        >
          {inner}
        </Link>
      ) : (
        <span className="flex items-center justify-between gap-2 py-2">{inner}</span>
      )}
    </li>
  );
}

const KIMCHI_PREVIEW = 20;

function KimchiSection() {
  const { data, isLoading, isError, error, refetch } = useKimchiPremium();
  const [expanded, setExpanded] = useState(false);
  const rows = data?.data ?? [];
  const shown = expanded ? rows : rows.slice(0, KIMCHI_PREVIEW);

  return (
    <Card>
      <CardContent className="space-y-2">
        <h2 className="text-sm font-semibold">김치프리미엄</h2>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} title="김프 호출 실패" />
        ) : rows.length === 0 ? (
          <EmptyState title="데이터가 없습니다" />
        ) : (
          <>
            <ul className="divide-y divide-border text-sm">
              {shown.map((r) => (
                <KimchiRow key={r.instrument_id} r={r} />
              ))}
            </ul>
            {rows.length > KIMCHI_PREVIEW && (
              <button
                className="w-full pt-1 text-center text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "접기" : `더 보기 (${rows.length - KIMCHI_PREVIEW}개)`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const MOVER_TABS: { value: MoverType; label: string }[] = [
  { value: "GAINERS", label: "급등" },
  { value: "LOSERS", label: "급락" },
  { value: "VOLUME", label: "거래량" },
];

const MOVER_MARKETS: { value: Market; label: string; note: string }[] = [
  { value: "CRYPTO", label: "코인", note: "거래대금 기준 · 업비트 KRW 마켓" },
  { value: "US", label: "미국", note: "거래대금 기준 · 미국 주식" },
  { value: "KOSPI", label: "코스피", note: "거래대금 기준 · 코스피" },
  { value: "KOSDAQ", label: "코스닥", note: "거래대금 기준 · 코스닥" },
];

function MoverRow({ r, i, live = true }: { r: import("@/lib/types").Mover; i: number; live?: boolean }) {
  // Overlay live price + change_rate for this symbol when present (crypto only).
  const liveData = useLivePrice(r.symbol);
  const price = (live ? liveData?.price : null) ?? r.price;
  const changeRate = (live ? liveData?.change_rate : null) ?? r.change_rate;
  const rate = Number(changeRate);
  const hasRate = changeRate != null && changeRate !== "" && !Number.isNaN(rate);
  const hasId = r.instrument_id != null;
  const inner = (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <InstrumentLabel name={r.name} symbol={r.symbol} />
      </span>
      <span className="flex shrink-0 items-center gap-3 tabular-nums">
        <span className="text-muted-foreground">{formatPrice(price)}</span>
        <span
          className={cn(
            "w-16 text-right",
            !hasRate
              ? "text-muted-foreground"
              : rate >= 0
                ? "text-[hsl(var(--success))]"
                : "text-destructive",
          )}
        >
          {hasRate ? `${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%` : "-"}
        </span>
      </span>
    </>
  );
  return (
    <li key={`${r.symbol}-${i}`}>
      {hasId ? (
        <Link
          href={`/instruments/${instrumentPathId(r.instrument_id)}`}
          className="flex items-center justify-between py-2 hover:bg-accent/30"
        >
          {inner}
        </Link>
      ) : (
        <span className="flex items-center justify-between py-2">{inner}</span>
      )}
    </li>
  );
}

function MoversSection() {
  const [tab, setTab] = useState<MoverType>("GAINERS");
  const [market, setMarket] = useState<Market>("CRYPTO");
  const { data, isLoading, isError, error, refetch } = useMovers(tab, market, 10);
  const rows = data?.data ?? [];
  const note = MOVER_MARKETS.find((m) => m.value === market)?.note ?? "거래대금 기준";
  // Live overlay is only meaningful for the crypto (Upbit WS) feed.
  const live = market === "CRYPTO";

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">급등락</h2>
            {live && <LiveDot />}
          </span>
          <div className="flex gap-1">
            {MOVER_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs",
                  tab === t.value ? "bg-primary/15 text-primary" : "text-muted-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {MOVER_MARKETS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMarket(m.value)}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px]",
                market === m.value
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} title="급등락 호출 실패" />
        ) : rows.length === 0 ? (
          <EmptyState title="데이터가 없습니다" />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {rows.map((r, i) => (
              <MoverRow key={`${r.symbol}-${i}`} r={r} i={i} live={live} />
            ))}
          </ul>
        )}
        {rows.length > 0 && (
          <p className="text-[10px] text-muted-foreground">{note}</p>
        )}
      </CardContent>
    </Card>
  );
}

const TRENDING_LIMIT = 7;

function TrendingSection() {
  // CoinGecko trending. Rows are non-navigable (trending carries no instrument
  // id). A live backend without this endpoint yet 404s -> show EmptyState.
  const { data, isLoading, isError, error, refetch } = useTrending();
  const rows = (data?.data ?? []).slice(0, TRENDING_LIMIT);

  return (
    <Card>
      <CardContent className="space-y-2">
        <h2 className="text-sm font-semibold">트렌딩 (Trending)</h2>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} title="트렌딩 호출 실패" />
        ) : rows.length === 0 ? (
          <EmptyState title="데이터가 없습니다" />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {rows.map((t) => (
              <li key={t.coingecko_id} className="flex items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {t.rank}
                  </span>
                  {t.thumb ? (
                    // Remote CoinGecko thumbs; plain lazy <img> avoids next/image
                    // remote-host config and degrades gracefully if it 404s.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.thumb}
                      alt=""
                      width={20}
                      height={20}
                      loading="lazy"
                      className="h-5 w-5 shrink-0 rounded-full bg-muted"
                    />
                  ) : (
                    <span className="h-5 w-5 shrink-0 rounded-full bg-muted" />
                  )}
                  <InstrumentLabel name={t.name} symbol={t.symbol} inline />
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {t.market_cap_rank != null ? `#${t.market_cap_rank}` : "-"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 && (
          <p className="text-[10px] text-muted-foreground">CoinGecko 트렌딩 · 시총 순위 #</p>
        )}
      </CardContent>
    </Card>
  );
}

function WatchRow({ item }: { item: WatchlistItem }) {
  // Overlay the live WS price for crypto symbols when present; otherwise the
  // enriched last_price. Null-safe: missing price renders "-".
  const live = useLivePrice(item.instrument?.market === "CRYPTO" ? item.instrument?.symbol : undefined);
  const price = live?.price ?? item.last_price;
  const sig = item.recent_signal;
  return (
    <li>
      <Link
        href={`/instruments/${instrumentPathId(item.instrument?.id)}`}
        className="flex items-center justify-between gap-2 py-2 hover:bg-accent/30"
      >
        <span className="flex min-w-0 items-center gap-2">
          <InstrumentLabel name={item.instrument.name} symbol={item.instrument.symbol} />
          {sig && (
            <span className="flex shrink-0 items-center gap-1">
              <TypeBadge type={sig.type} subtype={sig.subtype} />
              <StatusBadge status={sig.status} />
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="font-mono text-sm tabular-nums">
            {item.price_error ? "시세 실패" : price != null ? formatPrice(price) : "-"}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </span>
      </Link>
    </li>
  );
}

function WatchlistMini() {
  const { data, isLoading } = useWatchlist();
  const items = data?.items ?? [];
  const anyError = items.some((i) => i.price_error);

  return (
    <Card>
      <CardContent className="space-y-2">
        <h2 className="text-sm font-semibold">관심종목</h2>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : items.length === 0 ? (
          <EmptyState title="관심종목이 없습니다" description="종목 상세에서 관심 등록하세요." />
        ) : (
          <>
            {anyError && <PartialErrorNotice />}
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <WatchRow key={String(item.instrument?.id)} item={item} />
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HomeInner() {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">터미널</h1>
      <RegimeBanner />
      <EconomicCalendar />
      <InstrumentSearch />
      <GlobalMarketSection />
      <IndicesSection />
      <MoversSection />
      <TrendingSection />
      <KimchiSection />
      <WatchlistMini />
      <ComplianceFooter />
    </div>
  );
}

export default function HomePage() {
  return (
    <RequireAuth>
      <HomeInner />
    </RequireAuth>
  );
}
