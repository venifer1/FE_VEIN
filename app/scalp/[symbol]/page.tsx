"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { ComplianceFooter, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatScore } from "@/lib/format";
import { useScalpDetail } from "@/lib/queries";

function pct(value?: string | null): number {
  const n = Number(value ?? 0) * 100;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function ScalpDetailInner() {
  const params = useParams<{ symbol: string }>();
  const router = useRouter();
  const symbol = decodeURIComponent(params.symbol);
  const { data, isLoading, isError, error, refetch } = useScalpDetail(symbol);
  const detail = data?.data;

  const buyPct = pct(detail?.buy_ratio);
  const levels = detail?.top_levels ?? [];

  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="뒤로">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold">스캘핑 상세 · {symbol}</h1>
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
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{detail.symbol}</p>
                  <p className="text-xs text-muted-foreground">벽 상태 {detail.wall_state}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary tabular-nums">{formatScore(detail.scalp_score)}</p>
                  <p className="text-[10px] text-muted-foreground">스캘핑 점수</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2">
                <h2 className="text-sm font-semibold">체결 흐름</h2>
                <div className="flex h-3 overflow-hidden rounded-full">
                  <div className="bg-[hsl(var(--success))]" style={{ width: `${buyPct}%` }} />
                  <div className="bg-destructive" style={{ width: `${100 - buyPct}%` }} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[hsl(var(--success))]">매수 {buyPct.toFixed(0)}%</span>
                  <span className="text-destructive">매도 {(100 - buyPct).toFixed(0)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">호가 상위 레벨</h2>
                  {detail.wall_cancel_warning && (
                    <span className="rounded bg-[hsl(var(--warning))]/15 px-2 py-0.5 text-[10px] text-[hsl(var(--warning))]">
                      벽 취소 위험
                    </span>
                  )}
                </div>
                {levels.length === 0 ? (
                  <EmptyState title="호가 데이터가 없습니다" />
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 text-xs">
                    <div>
                      <p className="mb-0.5 text-[10px] text-muted-foreground">매도호가</p>
                      <ul>
                        {levels.map((level, index) => (
                          <li key={`ask-${index}`} className="flex items-center justify-between py-0.5">
                            <span className="font-mono tabular-nums">{formatPrice(level.ask_price)}</span>
                            <span className="font-mono tabular-nums text-destructive">{level.ask_size}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[10px] text-muted-foreground">매수호가</p>
                      <ul>
                        {levels.map((level, index) => (
                          <li key={`bid-${index}`} className="flex items-center justify-between py-0.5">
                            <span className="font-mono tabular-nums">{formatPrice(level.bid_price)}</span>
                            <span className="font-mono tabular-nums text-[hsl(var(--success))]">{level.bid_size}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
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

export default function ScalpDetailPage() {
  return (
    <RequireAuth>
      <ScalpDetailInner />
    </RequireAuth>
  );
}
