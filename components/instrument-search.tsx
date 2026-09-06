"use client";
import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MarketBadge } from "@/components/badges";
import { InstrumentLabel } from "@/components/instrument-label";
import { useInstruments } from "@/lib/queries";
import { MARKET_LABEL } from "@/components/badges";
import { instrumentPathId } from "@/lib/types";

// Unified 4-market instrument search. Typing searches ALL markets at once
// (초성 가능, server-side); each result shows its market badge so no filter
// chips are needed.
export function InstrumentSearch() {
  const [q, setQ] = useState("");
  const { data: results = [], isFetching } = useInstruments(q.trim() || undefined);
  const showResults = q.trim().length > 0;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="종목 검색 (4시장 전체 · 초성 가능)"
          className="pl-9"
          aria-label="종목 검색"
        />
      </div>

      {showResults && (
        <div className="overflow-hidden rounded-md border border-border">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {isFetching ? "검색 중..." : `'${q}' 결과가 없습니다.`}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/instruments/${instrumentPathId(i.id)}`}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-accent/40"
                  >
                    <InstrumentLabel name={i.name} symbol={i.symbol} className="flex-1" />
                    <span className="flex shrink-0 items-center gap-2">
                      <MarketBadge market={i.market} />
                      <span className="text-xs text-muted-foreground">{MARKET_LABEL[i.market]}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
