// Name-first instrument label: shows the human NAME prominently and the
// symbol/ticker as smaller, muted secondary text. Falls back to the symbol as
// the primary text when no name is available (never renders blank).
// 코인=한글명 먼저 · KRW-VVV 작게 / 미국주식=영문명 먼저 · 티커 작게 / 코스피·코스닥=한글명 먼저.
import { cn } from "@/lib/utils";

export function InstrumentLabel({
  name,
  symbol,
  className,
  nameClassName,
  symbolClassName,
  inline = false,
}: {
  name?: string | null;
  symbol: string;
  className?: string;
  nameClassName?: string;
  symbolClassName?: string;
  // inline=true lays name + symbol on one row; otherwise symbol sits under the name.
  inline?: boolean;
}) {
  const hasName = name != null && name !== "";
  const primary = hasName ? name : symbol;
  return (
    <span
      className={cn(
        "min-w-0",
        inline ? "flex items-baseline gap-1.5" : "flex flex-col",
        className,
      )}
    >
      <span className={cn("truncate font-medium", nameClassName)}>{primary}</span>
      {hasName && (
        <span className={cn("truncate text-xs text-muted-foreground", symbolClassName)}>
          {symbol}
        </span>
      )}
    </span>
  );
}
