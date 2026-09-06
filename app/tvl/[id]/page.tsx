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
import { toChartTime } from "@/lib/format";
import { useTvlHistory } from "@/lib/queries";
import type { TvlHistoryPoint } from "@/lib/types";

function TvlLineChart({ points }: { points: TvlHistoryPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || points.length === 0) return;
    const el = ref.current;
    const chart = createChart(el, {
      height: 280,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#9aa4b2", fontSize: 11 },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: false },
    });
    const series = chart.addAreaSeries({
      lineColor: "#7dd3fc",
      topColor: "rgba(125,211,252,0.35)",
      bottomColor: "rgba(125,211,252,0.02)",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
    });

    series.setData(points.map((point) => ({ time: toChartTime(point.t) as UTCTimestamp, value: Number(point.tvl) })));
    chart.timeScale().fitContent();
    const resizeObserver = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    resizeObserver.observe(el);
    chart.applyOptions({ width: el.clientWidth });

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [points]);

  return <div ref={ref} className="w-full" style={{ height: 280 }} />;
}

function TvlDetailInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useTvlHistory(params.id);

  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="뒤로">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold">TVL 히스토리</h1>
      </div>
      <div className="space-y-4 px-4 pb-4">
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !data || data.points.length === 0 ? (
          <EmptyState title="히스토리가 없습니다" />
        ) : (
          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-sm font-semibold">{data.name}</h2>
              <TvlLineChart points={data.points} />
            </CardContent>
          </Card>
        )}
      </div>
      <ComplianceFooter />
    </div>
  );
}

export default function TvlDetailPage() {
  return (
    <RequireAuth>
      <TvlDetailInner />
    </RequireAuth>
  );
}
