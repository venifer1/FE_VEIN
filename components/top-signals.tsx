"use client";
import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SignalCard } from "@/components/signal-card";
import { useTopSignals } from "@/lib/queries";
import type { Market } from "@/lib/types";

// 오늘의 주목 신호(R41, 신호 과다 완화). 활성 신호를 Pattern Score 순으로 상위만 홈에 올려,
// 400여 개 피드를 뒤지지 않고 후보를 먼저 본다. 데이터 없으면 조용히 숨김.
const MARKET_TABS: Array<{ key: Market | "ALL"; label: string }> = [
  { key: "ALL", label: "전체" },
  { key: "CRYPTO", label: "코인" },
  { key: "US", label: "미국" },
  { key: "KOSPI", label: "코스피" },
  { key: "KOSDAQ", label: "코스닥" },
];

export function TopSignalsSection() {
  const [tab, setTab] = useState<Market | "ALL">("ALL");
  const market = tab === "ALL" ? undefined : tab;
  const { data, isLoading, isError } = useTopSignals(market, 6);

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">오늘의 주목 신호</h2>
          </div>
          <Link href="/scanner" className="text-[11px] text-muted-foreground underline-offset-2 hover:underline">
            스캐너 전체 →
          </Link>
        </div>
        <div className="flex gap-1">
          {MARKET_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded px-2 py-0.5 text-xs ${
                tab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : isError || !data || data.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">표시할 활성 신호가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {data.map((s) => (
              <SignalCard key={s.id} signal={s} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
