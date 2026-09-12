"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, TypeBadge, MarketBadge } from "@/components/badges";
import { InstrumentLabel } from "@/components/instrument-label";
import type { Signal } from "@/lib/types";
import { signalPathId } from "@/lib/types";
import { formatPrice, formatRelative, formatScore } from "@/lib/format";

export function SignalCard({ signal }: { signal: Signal }) {
  const showCTarget = (signal.type === "ABC" || signal.type === "TOP") && signal.c_target;
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
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        </CardContent>
      </Card>
    </Link>
  );
}
