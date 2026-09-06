"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ColorType, createChart, LineStyle, type UTCTimestamp } from "lightweight-charts";
import { RequireAuth } from "@/components/require-auth";
import { ComplianceFooter, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatTime, toChartTime } from "@/lib/format";
import { useDerivative } from "@/lib/queries";
import { cn } from "@/lib/utils";

function compactUsd(value?: string | null): string {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function HistoryChart({
  points,
  color,
  area,
}: {
  points: { t: string; value: number }[];
  color: string;
  area: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || points.length === 0) return;
    const el = ref.current;
    const chart = createChart(el, {
      height: 200,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#9aa4b2", fontSize: 11 },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: true },
    });
    const series = chart.addAreaSeries({
      lineColor: color,
      topColor: area,
      bottomColor: "rgba(0,0,0,0)",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
    });

    series.setData(points.map((point) => ({ time: toChartTime(point.t) as UTCTimestamp, value: point.value })));
    chart.timeScale().fitContent();
    const resizeObserver = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    resizeObserver.observe(el);
    chart.applyOptions({ width: el.clientWidth });

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [points, color, area]);

  return <div ref={ref} className="w-full" style={{ height: 200 }} />;
}

function DerivativeDetailInner() {
  const params = useParams<{ symbol: string }>();
  const router = useRouter();
  const symbol = decodeURIComponent(params.symbol);
  const { data, isLoading, isError, error, refetch } = useDerivative(symbol);
  const detail = data?.data;

  const longShortPoints = (detail?.long_short_history ?? [])
    .map((point) => ({ t: point.t, value: Number(point.ratio) }))
    .filter((point) => Number.isFinite(point.value));
  const oiPoints = (detail?.oi_history ?? [])
    .map((point) => ({ t: point.t, value: Number(point.oi) }))
    .filter((point) => Number.isFinite(point.value));

  const fundingRate = Number(detail?.funding_rate);
  const hasFundingRate = detail?.funding_rate != null && detail.funding_rate !== "" && Number.isFinite(fundingRate);

  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="뒤로">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold">파생 상세 · {symbol}</h1>
      </div>
      <div className="space-y-4 px-4 pb-4">
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !detail ? (
          <EmptyState title="데이터가 없습니다" />
        ) : (
          <>
            <Card>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{detail.symbol}</p>
                    {detail.perp && <p className="text-xs text-muted-foreground">{detail.perp}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums">{formatPrice(detail.mark_price)}</p>
                    <p className="text-[10px] text-muted-foreground">마크 가격</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-border px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">펀딩비</p>
                    <p
                      className={cn(
                        "font-semibold tabular-nums",
                        !hasFundingRate ? "" : fundingRate >= 0 ? "text-[hsl(var(--success))]" : "text-destructive",
                      )}
                    >
                      {hasFundingRate ? `${fundingRate >= 0 ? "+" : ""}${(fundingRate * 100).toFixed(4)}%` : "-"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">미결제약정</p>
                    <p className="font-semibold tabular-nums">{compactUsd(detail.oi_value_usd)}</p>
                  </div>
                </div>
                {detail.next_funding_at && (
                  <p className="text-[11px] text-muted-foreground">다음 펀딩 {formatTime(detail.next_funding_at)}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2">
                <h2 className="text-sm font-semibold">롱/숏 비율 추이</h2>
                {longShortPoints.length === 0 ? (
                  <EmptyState title="히스토리가 없습니다" />
                ) : (
                  <HistoryChart points={longShortPoints} color="#7dd3fc" area="rgba(125,211,252,0.35)" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2">
                <h2 className="text-sm font-semibold">미결제약정(OI) 추이</h2>
                {oiPoints.length === 0 ? (
                  <EmptyState title="히스토리가 없습니다" />
                ) : (
                  <HistoryChart points={oiPoints} color="#a78bfa" area="rgba(167,139,250,0.35)" />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
      <ComplianceFooter />
    </div>
  );
}

export default function DerivativeDetailPage() {
  return (
    <RequireAuth>
      <DerivativeDetailInner />
    </RequireAuth>
  );
}
