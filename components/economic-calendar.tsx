"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMacroCalendar } from "@/lib/queries";
import type { EconomicEvent, EconomicEventType } from "@/lib/types";

// 경제 캘린더(§15.1). 홈 상단에서 임박한 고위험 매크로 이벤트(FOMC·CPI·고용)를 D-day와
// 함께 보여줘, 이벤트 전후 변동성 구간을 미리 인지하게 한다. 미가용/오류 시 조용히 숨김.
const TYPE_LABEL: Record<EconomicEventType, string> = {
  FOMC: "FOMC",
  CPI: "CPI",
  EMPLOYMENT: "고용",
  EARNINGS: "실적",
};

function ddayLabel(dday: number): string {
  if (dday === 0) return "D-DAY";
  return dday > 0 ? `D-${dday}` : `D+${-dday}`;
}

function ddayStyle(dday: number): string {
  const a = Math.abs(dday);
  if (a <= 1) return "border-destructive/30 bg-destructive/15 text-destructive";
  if (a <= 3) return "border-amber-500/30 bg-amber-500/15 text-amber-600";
  return "border-border bg-secondary text-muted-foreground";
}

export function EconomicCalendar() {
  const { data, isLoading, isError } = useMacroCalendar(14);
  if (isLoading) return <Skeleton className="h-12 w-full" />;
  if (isError || !data) return null;

  const events = (data.events ?? []).filter((e: EconomicEvent) => e.dday >= 0).slice(0, 5);
  if (events.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">다가오는 경제 이벤트</span>
          <span className="text-[11px] text-muted-foreground">2주 · 미국</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {events.map((e) => (
            <div key={`${e.type}-${e.date}`} className="flex items-center gap-2 text-sm">
              <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${ddayStyle(e.dday)}`}>
                {ddayLabel(e.dday)}
              </span>
              <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {TYPE_LABEL[e.type] ?? e.type}
              </span>
              <span className="truncate text-muted-foreground">{e.title}</span>
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">{e.date}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
