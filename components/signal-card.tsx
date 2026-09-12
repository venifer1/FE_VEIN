"use client";
import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, TypeBadge, MarketBadge } from "@/components/badges";
import { InstrumentLabel } from "@/components/instrument-label";
import type { Signal } from "@/lib/types";
import { signalPathId, instrumentPathId } from "@/lib/types";
import { formatPrice, formatRelative, formatScore } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useWatchlist, useAddWatchItem, useRemoveWatchItem } from "@/lib/queries";

export function SignalCard({ signal }: { signal: Signal }) {
  // 카드에서 바로 관심 등록/해제(R83). 상세를 열지 않고 후보를 담는 마찰을 줄인다.
  // 카드가 <Link>라 별 클릭이 네비게이션을 타지 않도록 prevent/stopPropagation 한다.
  const navId = instrumentPathId(signal.instrument?.id);
  const { data: watchlist } = useWatchlist();
  const addItem = useAddWatchItem();
  const removeItem = useRemoveWatchItem();
  const inWatchlist = !!watchlist?.items?.some(
    (i) => instrumentPathId(i.instrument?.id) === navId,
  );
  const watchBusy = addItem.isPending || removeItem.isPending;
  const toggleWatch = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (watchBusy) return;
    if (inWatchlist) removeItem.mutate(navId);
    else addItem.mutate(navId);
  };
  // ABC/TOP은 C 목표가(c100), IMALOL은 C 예상가(projectedClose=박스 투영가). 셋 다 전방 목표라
  // 카드에 거리(%)를 노출한다. (R66=ABC/TOP, R80=IMALOL 확장)
  const showCTarget =
    (signal.type === "ABC" || signal.type === "TOP" || signal.type === "IMALOL") && signal.c_target;
  // 현재가 대비 C 목표까지 거리(%). 한눈에 남은 상승/하락폭을 본다. (R66)
  const cur = Number(signal.current_price);
  const cTargetPct =
    showCTarget && Number.isFinite(cur) && cur !== 0
      ? ((Number(signal.c_target) - cur) / cur) * 100
      : null;
  return (
    <Link href={`/signals/${signalPathId(signal.id)}`} className="block">
      <Card className="transition-colors hover:bg-accent/40">
        <CardContent className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <InstrumentLabel
                name={signal.instrument.name}
                symbol={signal.instrument.symbol}
                inline
                nameClassName="font-semibold"
              />
              <MarketBadge market={signal.market} />
              <TypeBadge type={signal.type} subtype={signal.subtype} />
              <StatusBadge status={signal.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="rounded bg-secondary px-1.5 py-0.5">{signal.timeframe}</span>
              <span>구조 점수 {formatScore(signal.score)}</span>
              <span>·</span>
              <span>현재가 {formatPrice(signal.current_price)}</span>
              {showCTarget && (
                <>
                  <span>·</span>
                  <span className="text-[hsl(var(--success))]">
                    C {formatPrice(signal.c_target)}
                    {cTargetPct != null && Number.isFinite(cTargetPct)
                      ? ` (${cTargetPct >= 0 ? "+" : ""}${cTargetPct.toFixed(1)}%)`
                      : ""}
                  </span>
                </>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
              <span>{formatRelative(signal.detected_at)}</span>
            </div>
          </div>
          <button
            type="button"
            aria-label={inWatchlist ? "관심 해제" : "관심 등록"}
            aria-pressed={inWatchlist}
            disabled={watchBusy}
            onClick={toggleWatch}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <Star
              className={cn(
                "h-4 w-4",
                inWatchlist && "fill-[hsl(var(--warning))] text-[hsl(var(--warning))]",
              )}
              aria-hidden
            />
          </button>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        </CardContent>
      </Card>
    </Link>
  );
}
