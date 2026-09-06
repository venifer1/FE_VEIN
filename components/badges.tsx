import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Freshness, Market, NewsSentiment, SignalStatus, SignalType } from "@/lib/types";
import { formatRelative } from "@/lib/format";

const STATUS_LABEL: Record<SignalStatus, string> = {
  DETECTED: "탐지",
  NEAR_COMPLETION: "완성 임박",
  INVALIDATED: "무효",
  EXPIRED: "만료",
  CLOSED: "종료",
};

const STATUS_VARIANT: Record<SignalStatus, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  DETECTED: "default",
  NEAR_COMPLETION: "success",
  INVALIDATED: "destructive",
  EXPIRED: "secondary",
  CLOSED: "secondary",
};

export function StatusBadge({ status }: { status: SignalStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function FreshnessBadge({
  freshness,
  updatedAt,
}: {
  freshness?: Freshness;
  updatedAt?: string | null;
}) {
  if (!freshness) return null;
  if (freshness === "FRESH") {
    return (
      <Badge variant="success" className="gap-1">
        최신{updatedAt ? ` · ${formatRelative(updatedAt)}` : ""}
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="gap-1">
      지연{updatedAt ? ` · ${formatRelative(updatedAt)}` : ""}
    </Badge>
  );
}

export const SIGNAL_TYPE_LABEL: Record<SignalType, string> = {
  ABC: "ABC",
  TOP: "고점되돌림",
  IMALOL: "이말올",
};

export function TypeBadge({ type, subtype }: { type: SignalType; subtype?: string | null }) {
  const base = SIGNAL_TYPE_LABEL[type] ?? type;
  const label = subtype ? `${base} · ${subtype}` : base;
  return <Badge variant="secondary">{label}</Badge>;
}

export const MARKET_LABEL: Record<Market, string> = {
  CRYPTO: "코인",
  US: "미국",
  KOSPI: "코스피",
  KOSDAQ: "코스닥",
};

export function MarketBadge({ market }: { market: Market }) {
  return (
    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
      {MARKET_LABEL[market] ?? market}
    </span>
  );
}

const SENTIMENT_LABEL: Record<NewsSentiment, string> = {
  POSITIVE: "긍정",
  NEGATIVE: "부정",
  NEUTRAL: "중립",
};

const SENTIMENT_VARIANT: Record<NewsSentiment, "success" | "destructive" | "secondary"> = {
  POSITIVE: "success",
  NEGATIVE: "destructive",
  NEUTRAL: "secondary",
};

export function SentimentBadge({ sentiment }: { sentiment?: NewsSentiment | null }) {
  if (!sentiment || !SENTIMENT_LABEL[sentiment]) return null;
  return <Badge variant={SENTIMENT_VARIANT[sentiment]}>{SENTIMENT_LABEL[sentiment]}</Badge>;
}

export function stripQuotePrefix(symbol: string): string {
  return symbol.replace(/^[A-Z0-9]+-/, "");
}

const CHIP_CLASS = "rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground";

export function CoinChips({
  symbols,
  instruments,
  max = 5,
}: {
  symbols?: string[];
  instruments?: { symbol: string; instrument_id?: number | null }[];
  max?: number;
}) {
  const list: { symbol: string; instrument_id?: number | null }[] = (
    instruments ?? (symbols ?? []).map((symbol) => ({ symbol }))
  ).filter((c) => c && c.symbol);
  if (list.length === 0) return null;
  const shown = list.slice(0, max);
  const extra = list.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((c, i) => {
        const label = stripQuotePrefix(c.symbol);
        const id = c.instrument_id;
        if (id != null) {
          return (
            <Link
              key={`${c.symbol}-${i}`}
              href={`/instruments/${id}`}
              onClick={(e) => e.stopPropagation()}
              className={`${CHIP_CLASS} transition-colors hover:bg-secondary/70`}
            >
              {label}
            </Link>
          );
        }
        return (
          <span key={`${c.symbol}-${i}`} className={CHIP_CLASS}>
            {label}
          </span>
        );
      })}
      {extra > 0 && <span className="text-[10px] text-muted-foreground">+{extra}</span>}
    </div>
  );
}
