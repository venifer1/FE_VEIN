"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MarketBadge } from "@/components/badges";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ErrorState, ComplianceFooter } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatTime } from "@/lib/format";
import {
  useDerivatives,
  useFundingArb,
  useLiquidationSummary,
  useLiquidations,
  useSupply,
  useThemes,
  useTvl,
} from "@/lib/queries";
import type { Market, TvlMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type SubTab = "tvl" | "supply" | "theme" | "funding" | "deriv" | "liquidation";

function compactUsd(value?: string | null): string {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function Pct({ value }: { value?: string | null }) {
  if (value == null || value === "") return <span className="text-muted-foreground">-</span>;
  const n = Number(value);
  if (!Number.isFinite(n)) return <span className="text-muted-foreground">-</span>;

  return (
    <span className={cn("tabular-nums", n >= 0 ? "text-[hsl(var(--success))]" : "text-destructive")}>
      {n >= 0 ? "+" : ""}
      {n.toFixed(2)}%
    </span>
  );
}

function TvlTab() {
  const [mode, setMode] = useState<TvlMode>("PROTOCOL");
  const [sort, setSort] = useState<"TVL" | "CHANGE_7D">("TVL");
  const { data, isLoading, isError, error, refetch } = useTvl(mode, sort);
  const rows = data?.data ?? [];

  return (
    <div className="space-y-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {(["PROTOCOL", "CHAIN"] as TvlMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={cn(
                "rounded-md px-2 py-1 text-xs",
                mode === item ? "bg-primary/15 text-primary" : "text-muted-foreground",
              )}
            >
              {item === "PROTOCOL" ? "프로토콜" : "체인"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["TVL", "CHANGE_7D"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSort(item)}
              className={cn(
                "rounded-md px-2 py-1 text-xs",
                sort === item ? "bg-primary/15 text-primary" : "text-muted-foreground",
              )}
            >
              {item === "TVL" ? "TVL순" : "7일 변동순"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="데이터가 없습니다" />
      ) : (
        rows.map((row) => (
          <Link key={row.id} href={`/tvl/${row.id}`} className="block">
            <Card className="transition-colors hover:bg-accent/40">
              <CardContent className="flex items-center gap-3">
                <span className="w-5 text-center text-sm text-muted-foreground">{row.rank}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{row.name}</span>
                    {row.category && <span className="text-[11px] text-muted-foreground">{row.category}</span>}
                  </div>
                  {row.chains && <p className="truncate text-[11px] text-muted-foreground">{row.chains}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{compactUsd(row.tvl)}</p>
                  <p className="text-[11px]">
                    <Pct value={row.change7d} />
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}

function SupplyTab() {
  const [sort, setSort] = useState<"market_cap" | "circulating_pct" | "fdv">("market_cap");
  const { data, isLoading, isError, error, refetch } = useSupply(sort);
  const rows = data?.data ?? [];

  return (
    <div className="space-y-2 p-4">
      <div className="flex flex-wrap gap-1">
        {([
          ["market_cap", "시총순"],
          ["circulating_pct", "유통률순"],
          ["fdv", "FDV순"],
        ] as const).map(([item, label]) => (
          <button
            key={item}
            type="button"
            onClick={() => setSort(item)}
            className={cn(
              "rounded-md px-2 py-1 text-xs",
              sort === item ? "bg-primary/15 text-primary" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="데이터가 없습니다" />
      ) : (
        rows.map((row) => {
          const pct = Number(row.circulating_pct);
          const safePct = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;

          return (
            <Card key={row.coingecko_id}>
              <CardContent className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-center text-sm text-muted-foreground">{row.rank}</span>
                    <span className="font-medium">{row.symbol}</span>
                    <span className="truncate text-xs text-muted-foreground">{row.name}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{compactUsd(row.market_cap)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${safePct}%` }} />
                  </div>
                  <span className="w-12 text-right text-[11px] tabular-nums text-muted-foreground">
                    {Number.isFinite(pct) ? pct.toFixed(1) : "-"}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  FDV {compactUsd(row.fdv)} · 유통량 {Number(row.circulating).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

const THEME_MARKETS: { value: (Market | "KR") | undefined; label: string }[] = [
  { value: undefined, label: "전체" },
  { value: "CRYPTO", label: "코인" },
  { value: "US", label: "미국" },
  { value: "KR", label: "한국" },
];

function ThemeTab() {
  const [market, setMarket] = useState<(Market | "KR") | undefined>(undefined);
  const [unclassified, setUnclassified] = useState(false);
  const [lowConf, setLowConf] = useState(false);
  const { data, isLoading, isError, error, refetch } = useThemes({
    market,
    unclassified_only: unclassified,
    low_confidence_only: lowConf,
  });
  const rows = data?.data ?? [];

  return (
    <div className="space-y-2 p-4">
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
        {THEME_MARKETS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setMarket(item.value)}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-0.5 text-xs",
              market === item.value ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => setUnclassified((value) => !value)}
          className={cn(
            "rounded-full border px-2.5 py-0.5",
            unclassified ? "border-primary text-primary" : "border-border text-muted-foreground",
          )}
        >
          미분류만
        </button>
        <button
          type="button"
          onClick={() => setLowConf((value) => !value)}
          className={cn(
            "rounded-full border px-2.5 py-0.5",
            lowConf ? "border-primary text-primary" : "border-border text-muted-foreground",
          )}
        >
          저신뢰만
        </button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="테마가 없습니다" />
      ) : (
        rows.map((theme) => (
          <Link key={theme.id} href={`/themes/${theme.id}`} className="block">
            <Card className="transition-colors hover:bg-accent/40">
              <CardContent className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{theme.name}</span>
                    {theme.market !== "KR" && <MarketBadge market={theme.market as Market} />}
                    {(theme.low_confidence_count ?? 0) > 0 && (
                      <span className="rounded bg-[hsl(var(--warning))]/15 px-1 text-[10px] text-[hsl(var(--warning))]">
                        저신뢰
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    구성종목 {theme.constituent_count}개
                    {(theme.unclassified_count ?? 0) > 0 ? ` · 미분류 ${theme.unclassified_count}개` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}

function FundingTab() {
  const [sort, setSort] = useState<"funding" | "expected">("funding");
  const { data, isLoading, isError, error, refetch } = useFundingArb(sort);
  const rows = data?.data ?? [];

  return (
    <div className="space-y-2 p-4">
      <p className="text-[11px] text-muted-foreground">
        업비트 현물 vs Bybit 선물 · 수수료(왕복) 반영 기대수익
      </p>
      <div className="flex gap-1">
        {([
          ["funding", "펀딩비순"],
          ["expected", "기대수익순"],
        ] as const).map(([item, label]) => (
          <button
            key={item}
            type="button"
            onClick={() => setSort(item)}
            className={cn(
              "rounded-md px-2 py-1 text-xs",
              sort === item ? "bg-primary/15 text-primary" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="데이터가 없습니다" />
      ) : (
        rows.map((row) => (
          <Card key={row.symbol}>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{row.symbol}</span>
                <span className="text-sm">
                  펀딩비 <Pct value={row.funding_pct} />
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>
                  업비트 {formatPrice(row.upbit_price)} · Bybit {formatPrice(row.bybit_price)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>
                  기대 1회 <Pct value={row.expected1x_pct} />
                </span>
                <span>
                  기대 2회 <Pct value={row.expected2x_pct} />
                </span>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function FundingPct({ value }: { value?: string | null }) {
  if (value == null || value === "") return <span className="text-muted-foreground">-</span>;
  const n = Number(value);
  if (!Number.isFinite(n)) return <span className="text-muted-foreground">-</span>;
  const pct = n * 100;

  return (
    <span className={cn("tabular-nums", pct >= 0 ? "text-[hsl(var(--success))]" : "text-destructive")}>
      {pct >= 0 ? "+" : ""}
      {pct.toFixed(4)}%
    </span>
  );
}

function LongShortBar({ ratio }: { ratio?: string | null }) {
  const value = Number(ratio);
  if (ratio == null || ratio === "" || !Number.isFinite(value) || value <= 0) {
    return <span className="text-[11px] text-muted-foreground">L/S -</span>;
  }

  const longPct = (value / (value + 1)) * 100;
  return (
    <div className="space-y-0.5">
      <div className="flex h-2 overflow-hidden rounded-full">
        <div className="bg-[hsl(var(--success))]" style={{ width: `${longPct}%` }} />
        <div className="bg-destructive" style={{ width: `${100 - longPct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span className="text-[hsl(var(--success))]">롱 {longPct.toFixed(0)}%</span>
        <span>L/S {value.toFixed(2)}</span>
        <span className="text-destructive">숏 {(100 - longPct).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function DerivativesTab() {
  const { data, isLoading, isError, error, refetch } = useDerivatives(20);
  const rows = data?.data ?? [];

  return (
    <div className="space-y-2 p-4">
      <p className="text-[11px] text-muted-foreground">무기한 선물 · 펀딩비 / 미결제약정 / 롱숏 비율</p>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="데이터가 없습니다" />
      ) : (
        rows.map((row) => (
          <Link key={row.symbol} href={`/derivatives/${encodeURIComponent(row.symbol)}`} className="block">
            <Card className="transition-colors hover:bg-accent/40">
              <CardContent className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{row.symbol}</span>
                    {row.perp && <span className="text-[11px] text-muted-foreground">{row.perp}</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-sm font-semibold tabular-nums">{formatPrice(row.mark_price)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>
                    펀딩 <FundingPct value={row.funding_rate} />
                  </span>
                  <span className="text-muted-foreground tabular-nums">OI {compactUsd(row.oi_value_usd)}</span>
                </div>
                {row.next_funding_at && (
                  <p className="text-[10px] text-muted-foreground">다음 펀딩 {formatTime(row.next_funding_at)}</p>
                )}
                <LongShortBar ratio={row.long_short_ratio} />
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}

const LIQUIDATION_THRESHOLDS = [
  { value: 10_000, label: "$10K+" },
  { value: 100_000, label: "$100K+" },
  { value: 1_000_000, label: "$1M+" },
];

function spikeLabel(level?: string) {
  if (level === "HIGH") return "급증 HIGH";
  if (level === "MEDIUM") return "증가 MEDIUM";
  return "정상";
}

function LiquidationsTab() {
  const [minNotional, setMinNotional] = useState(100_000);
  const { data, isLoading, isError, error, refetch } = useLiquidations(minNotional, 100);
  const { data: summaryData } = useLiquidationSummary();
  const snapshot = data?.data;
  const summary = summaryData?.data;
  const rows = snapshot?.events ?? [];

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">Binance USD-M 강제청산 · 최근 이벤트</p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px]",
            snapshot?.connected
              ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]"
              : "bg-secondary text-muted-foreground",
          )}
        >
          {snapshot?.connected ? "LIVE" : "연결 대기"}
        </span>
      </div>

      <div className="flex gap-1">
        {LIQUIDATION_THRESHOLDS.map((threshold) => (
          <button
            key={threshold.value}
            type="button"
            onClick={() => setMinNotional(threshold.value)}
            className={cn(
              "rounded-md px-2 py-1 text-xs",
              minNotional === threshold.value ? "bg-primary/15 text-primary" : "text-muted-foreground",
            )}
          >
            {threshold.label}
          </button>
        ))}
      </div>

      {summary && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">시간대별 전체 청산</p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                summary.spike.level === "HIGH"
                  ? "bg-destructive/15 text-destructive"
                  : summary.spike.level === "MEDIUM"
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-secondary text-muted-foreground",
              )}
            >
              {spikeLabel(summary.spike.level)} · 5분 {compactUsd(summary.spike.recent5m_usd)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {summary.windows.map((item) => (
              <Card key={item.window}>
                <CardContent className="space-y-1 p-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{item.window} 합계</span>
                    <span>
                      {item.count}건{item.partial ? " · 일부" : ""}
                    </span>
                  </div>
                  <p className="font-semibold tabular-nums">{compactUsd(item.total_notional_usd)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    롱 {compactUsd(item.long_liquidation_usd)} · 숏 {compactUsd(item.short_liquidation_usd)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {snapshot && (
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="space-y-0.5 p-3">
              <p className="text-[11px] text-muted-foreground">롱 청산</p>
              <p className="font-semibold tabular-nums text-destructive">
                {compactUsd(snapshot.long_liquidation_usd)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-0.5 p-3">
              <p className="text-[11px] text-muted-foreground">숏 청산</p>
              <p className="font-semibold tabular-nums text-[hsl(var(--success))]">
                {compactUsd(snapshot.short_liquidation_usd)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="조건에 맞는 최근 청산이 없습니다" />
      ) : (
        rows.map((row, index) => {
          const isLong = row.position_side === "LONG";

          return (
            <Card key={`${row.symbol}-${row.event_at}-${index}`}>
              <CardContent className="flex items-center gap-3 p-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    isLong
                      ? "bg-destructive/15 text-destructive"
                      : "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
                  )}
                >
                  {isLong ? "LONG" : "SHORT"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{row.base}</span>
                    <span className="font-semibold tabular-nums">{compactUsd(row.notional_usd)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {formatPrice(row.price)} · {Number(row.quantity).toLocaleString()}개
                    </span>
                    <span>{formatTime(row.event_at, "HH:mm:ss")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

const TABS: { value: SubTab; label: string }[] = [
  { value: "tvl", label: "TVL" },
  { value: "supply", label: "유통량" },
  { value: "theme", label: "테마/섹터" },
  { value: "funding", label: "펀비차익" },
  { value: "deriv", label: "파생" },
  { value: "liquidation", label: "청산" },
];

function DataInner() {
  const [tab, setTab] = useState<SubTab>("tvl");

  return (
    <div>
      <div className="px-4 py-3">
        <h1 className="text-lg font-semibold">데이터</h1>
      </div>
      <div className="no-scrollbar flex gap-1 overflow-x-auto px-4">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={cn(
              "shrink-0 border-b-2 px-3 pb-2 text-sm",
              tab === item.value ? "border-primary text-primary" : "border-transparent text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "tvl" && <TvlTab />}
      {tab === "supply" && <SupplyTab />}
      {tab === "theme" && <ThemeTab />}
      {tab === "funding" && <FundingTab />}
      {tab === "deriv" && <DerivativesTab />}
      {tab === "liquidation" && <LiquidationsTab />}
      <ComplianceFooter />
    </div>
  );
}

export default function DataPage() {
  return (
    <RequireAuth>
      <DataInner />
    </RequireAuth>
  );
}
