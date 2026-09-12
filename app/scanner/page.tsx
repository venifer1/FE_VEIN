"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { SignalFilterBar } from "@/components/signal-filter-bar";
import { SignalCard } from "@/components/signal-card";
import { BacktestPanel } from "@/components/backtest-panel";
import { ConditionScannerPanel } from "@/components/condition-scanner-panel";
import { FreshnessBadge, SIGNAL_TYPE_LABEL } from "@/components/badges";
import { EmptyState, ErrorState, StaleNotice, ComplianceFooter } from "@/components/states";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useSignals,
  useScalpRanking,
  useSignalPerformanceSummary,
  type SignalFilter,
} from "@/lib/queries";
import { formatPct, formatScore } from "@/lib/format";
import {
  timeframesForMarket,
  type Freshness,
  type Market,
  type SignalType,
} from "@/lib/types";

const FILTER_QUERY_KEYS = ["type", "market", "timeframe", "near_only", "all"] as const;
const SIGNAL_TYPES: SignalType[] = ["ABC", "TOP", "IMALOL"];
const MARKETS: Market[] = ["CRYPTO", "US", "KOSPI", "KOSDAQ"];

function filterFromSearchParams(searchParams: { get: (name: string) => string | null }): SignalFilter {
  const typeParam = searchParams.get("type");
  const marketParam = searchParams.get("market");
  const timeframeParam = searchParams.get("timeframe");
  const type = SIGNAL_TYPES.find((value) => value === typeParam);
  const market = MARKETS.find((value) => value === marketParam);
  const allowedTimeframes = timeframesForMarket(market).filter((value) => value !== "1M");
  const timeframe = allowedTimeframes.find((value) => value === timeframeParam);

  return {
    type,
    market,
    timeframe,
    near_only: searchParams.get("near_only") === "true" || undefined,
    // 기본은 활성 신호만(만료·무효 숨김). ?all=true면 전체 상태 노출. (R54)
    active_only: searchParams.get("all") === "true" ? false : true,
  };
}

function setFilterSearchParams(searchParams: URLSearchParams, filter: SignalFilter): URLSearchParams {
  for (const key of FILTER_QUERY_KEYS) searchParams.delete(key);
  if (filter.type) searchParams.set("type", filter.type);
  if (filter.market) searchParams.set("market", filter.market);
  if (filter.timeframe) searchParams.set("timeframe", filter.timeframe);
  if (filter.near_only) searchParams.set("near_only", "true");
  if (filter.active_only === false) searchParams.set("all", "true");
  return searchParams;
}

function PerformanceSummaryStrip({ filter }: { filter: SignalFilter }) {
  const { data } = useSignalPerformanceSummary({
    type: filter.type,
    market: filter.market,
    timeframe: filter.timeframe,
    horizon: "1d",
  });
  const rows = data ?? [];
  const row = rows
    .filter((r) => (r.sample_size ?? 0) > 0)
    .sort((a, b) => (b.sample_size ?? 0) - (a.sample_size ?? 0))[0];

  return (
    <div className="border-b border-border bg-background px-4 py-2">
      {!row ? (
        <p className="text-[11px] text-muted-foreground">성과 데이터 추적 중</p>
      ) : (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{SIGNAL_TYPE_LABEL[row.type as SignalType] ?? row.type}</span>
          <span aria-hidden>·</span>
          <span>{row.timeframe}</span>
          <span aria-hidden>·</span>
          <span>표본 {row.sample_size}</span>
          <span aria-hidden>·</span>
          <span>적중률 {row.hit_rate ?? "-"}%</span>
          <span aria-hidden>·</span>
          <span>평균 {formatPct(row.avg_return_pct)}</span>
          {(row.sample_size ?? 0) < 20 && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-600">
              표본 부족 · 참고만
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function PatternScanner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = useMemo(() => filterFromSearchParams(searchParams), [searchParams]);
  const [slow, setSlow] = useState(false);
  const query = useSignals(filter);
  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  const setFilter = useCallback(
    (nextFilter: SignalFilter) => {
      const params = setFilterSearchParams(new URLSearchParams(searchParams.toString()), nextFilter);
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (!isLoading) return setSlow(false);
    const t = setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(t);
  }, [isLoading]);

  const pages = data?.pages ?? [];
  const signals = pages.flatMap((p) => p.data);
  const freshness = (pages[0]?.meta?.freshness as Freshness | undefined) ?? undefined;
  const isStale = freshness === "DELAYED";
  const hasFilter = !!(filter.type || filter.market || filter.timeframe || filter.near_only);

  return (
    <div>
      <div className="flex items-center justify-end px-4 pt-2">
        <FreshnessBadge freshness={freshness} />
      </div>
      <SignalFilterBar filter={filter} onChange={setFilter} />
      <PerformanceSummaryStrip filter={filter} />
      <div className="space-y-2 p-4">
        {isStale && <StaleNotice onRefresh={() => refetch()} />}
        {isLoading ? (
          <>
            {slow && <p className="text-center text-sm text-muted-foreground">불러오는 중입니다...</p>}
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : signals.length === 0 ? (
          <EmptyState
            title="조건에 맞는 신호가 없습니다"
            description={hasFilter ? "필터 조건을 바꾸거나 초기화하세요." : "아직 탐지된 신호가 없습니다."}
            action={hasFilter ? { label: "필터 초기화", onClick: () => setFilter({}) } : undefined}
          />
        ) : (
          <>
            {signals.map((s) => (
              <SignalCard key={s.id} signal={s} />
            ))}
            {hasNextPage && (
              <Button variant="outline" className="w-full" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? "불러오는 중" : "더 보기"}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ScalpRanking() {
  const { data, isLoading, isError, error, refetch } = useScalpRanking();
  const rows = data?.data ?? [];

  return (
    <div className="space-y-2 p-4">
      <p className="text-xs text-muted-foreground">
        업비트 24시간 거래대금 상위 마켓의 실시간 스캘핑 점수입니다. 서버 수집값을 기준으로 표시합니다.
      </p>
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="스캘핑 데이터가 없습니다" />
      ) : (
        rows.map((r) => (
          <Link key={r.symbol} href={`/scalp/${encodeURIComponent(r.symbol)}`} className="block">
            <Card className="transition-colors hover:bg-accent/40">
              <CardContent className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.symbol}</span>
                    <span className="text-xs text-muted-foreground">{r.name}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
                    <span>스프레드 {r.spread_ticks}틱</span>
                    <span>TPS {r.tps}</span>
                    <span>마이크로변동 {r.micro_vol}</span>
                    <span>불균형 {r.ob_imbalance}</span>
                    <span>벽 {r.wall_state}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums text-primary">{formatScore(r.scalp_score)}</p>
                  <p className="text-[10px] text-muted-foreground">점수</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}

const TAB_LABEL: Record<"pattern" | "condition" | "scalp" | "backtest", string> = {
  pattern: "패턴 신호",
  condition: "조건검색",
  scalp: "틱띄기",
  backtest: "백테스트",
};

function ScannerInner() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<"pattern" | "condition" | "scalp" | "backtest">(
    initialTab === "condition" || initialTab === "scalp" || initialTab === "backtest" ? initialTab : "pattern",
  );
  return (
    <div>
      <div className="px-4 py-3">
        <h1 className="text-lg font-semibold">스캐너</h1>
      </div>
      <div className="flex gap-2 px-4">
        {(["pattern", "condition", "scalp", "backtest"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 border-b-2 pb-2 text-sm",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground",
            )}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      {tab === "pattern"
        ? <PatternScanner />
        : tab === "condition"
          ? <ConditionScannerPanel />
          : tab === "scalp"
            ? <ScalpRanking />
            : <BacktestPanel />}
      <ComplianceFooter />
    </div>
  );
}

export default function ScannerPage() {
  return (
    <RequireAuth>
      <ScannerInner />
    </RequireAuth>
  );
}
