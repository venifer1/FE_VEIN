"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SignalFilter } from "@/lib/queries";
import type { Market, SignalType, Timeframe } from "@/lib/types";
import { timeframesForMarket } from "@/lib/types";

const TYPES: { value: SignalType | undefined; label: string }[] = [
  { value: undefined, label: "전체" },
  { value: "ABC", label: "ABC" },
  { value: "TOP", label: "고점되돌림" },
  { value: "IMALOL", label: "이말올" },
];
const MARKETS: { value: Market | undefined; label: string }[] = [
  { value: undefined, label: "전체" },
  { value: "CRYPTO", label: "코인" },
  { value: "US", label: "미국" },
  { value: "KOSPI", label: "코스피" },
  { value: "KOSDAQ", label: "코스닥" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function SignalFilterBar({
  filter,
  onChange,
}: {
  filter: SignalFilter;
  onChange: (f: SignalFilter) => void;
}) {
  const tfs: (Timeframe | undefined)[] = [
    undefined,
    ...timeframesForMarket(filter.market).filter((t) => t !== "1M"),
  ];
  return (
    <div className="space-y-2 border-b border-border bg-background px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs text-muted-foreground">패턴</span>
        {TYPES.map((t) => (
          <Chip key={t.label} active={filter.type === t.value} onClick={() => onChange({ ...filter, type: t.value })}>
            {t.label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs text-muted-foreground">시장</span>
        {MARKETS.map((m) => (
          <Chip
            key={m.label}
            active={filter.market === m.value}
            onClick={() => onChange({ ...filter, market: m.value, timeframe: undefined })}
          >
            {m.label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs text-muted-foreground">주기</span>
        {tfs.map((t) => (
          <Chip
            key={t ?? "all"}
            active={filter.timeframe === t}
            onClick={() => onChange({ ...filter, timeframe: t })}
          >
            {t ?? "전체"}
          </Chip>
        ))}
        <span className="ml-1 shrink-0" />
        <Chip active={!!filter.near_only} onClick={() => onChange({ ...filter, near_only: !filter.near_only })}>
          완성 임박만
        </Chip>
        <Chip
          active={filter.active_only === false}
          onClick={() => onChange({ ...filter, active_only: filter.active_only === false ? true : false })}
        >
          만료 포함
        </Chip>
      </div>
    </div>
  );
}
