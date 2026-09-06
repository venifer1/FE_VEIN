import Decimal from "decimal.js";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

// Prices arrive as string decimals; format only at display time.
export function formatPrice(value?: string | null, opts?: { maxFrac?: number }): string {
  if (value == null || value === "") return "-";
  try {
    const d = new Decimal(value);
    const abs = d.abs();
    // Heuristic fraction digits for KRW crypto display.
    let maxFrac = opts?.maxFrac;
    if (maxFrac == null) {
      if (abs.gte(1000)) maxFrac = 0;
      else if (abs.gte(1)) maxFrac = 2;
      else maxFrac = 8;
    }
    const num = Number(d.toFixed(maxFrac));
    return new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: maxFrac,
    }).format(num);
  } catch {
    return value;
  }
}

export function formatScore(value?: string | null): string {
  if (value == null || value === "") return "-";
  try {
    return new Decimal(value).toFixed(1);
  } catch {
    return value;
  }
}

// Percent string decimals -> signed display, e.g. "3.2" -> "+3.20%", "-0.8" -> "-0.80%".
export function formatPct(value?: string | null, frac = 2): string {
  if (value == null || value === "") return "-";
  try {
    const d = new Decimal(value);
    const sign = d.gt(0) ? "+" : "";
    return `${sign}${d.toFixed(frac)}%`;
  } catch {
    return value;
  }
}

// Sign of a percent string for green/red coloring: 1 / -1 / 0.
export function pctSign(value?: string | null): number {
  if (value == null || value === "") return 0;
  try {
    const d = new Decimal(value);
    return d.gt(0) ? 1 : d.lt(0) ? -1 : 0;
  } catch {
    return 0;
  }
}

const userTz =
  typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    : "UTC";

// UTC ISO string -> user-local display.
export function formatTime(iso?: string | null, pattern = "MM/dd HH:mm"): string {
  if (!iso) return "-";
  try {
    return formatInTimeZone(new Date(iso), userTz, pattern);
  } catch {
    return iso;
  }
}

export function formatRelative(iso?: string | null, now = new Date()): string {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diffSec = Math.round((now.getTime() - t) / 1000);
  if (diffSec < 0) return formatTime(iso);
  if (diffSec < 60) return `${diffSec}초 전`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return formatTime(iso, "yyyy.MM.dd");
}

// lightweight-charts wants epoch seconds for intraday and 'yyyy-mm-dd' for daily,
// but epoch seconds (UTCTimestamp) works across timeframes.
export function toChartTime(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

export { format };
