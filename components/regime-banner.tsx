"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMacro } from "@/lib/queries";

// 시장 국면 배너(§39). 개별 신호를 볼 때마다 "지금 시장이 어떤 국면인지"를 매번 따로
// 확인하던 것을 홈 상단에서 한눈에. 데이터 미가용/오류 시 조용히 숨겨 홈 나머지를 막지 않는다.
const LABEL_STYLE: Record<string, { text: string; cls: string }> = {
  BULL: { text: "상승 국면", cls: "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]" },
  BEAR: { text: "하락 국면", cls: "border-destructive/30 bg-destructive/15 text-destructive" },
  RANGE: { text: "횡보 국면", cls: "border-border bg-secondary text-muted-foreground" },
  TRANSITION: { text: "전환 국면", cls: "border-amber-500/30 bg-amber-500/15 text-amber-600" },
};

export function RegimeBanner() {
  const { data, isLoading, isError } = useMacro();
  if (isLoading) return <Skeleton className="h-14 w-full" />;
  if (isError || !data?.regime) return null;

  const r = data.regime;
  const style = LABEL_STYLE[r.label] ?? LABEL_STYLE.RANGE;
  const yc = data.yield_curve;

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold ${style.cls}`}>
              {style.text}
            </span>
            <span className="truncate text-sm text-muted-foreground">{r.summary}</span>
          </div>
          {yc?.spread10y2y != null && (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              10Y-2Y {yc.spread10y2y}%p{yc.inverted ? " ⚠역전" : ""}
            </span>
          )}
        </div>
        {r.signals.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.signals.map((sig) => (
              <span key={sig.key} className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {sig.detail}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
