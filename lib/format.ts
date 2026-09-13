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

// USD 대형 금액 축약(미결제약정·시총 등): $1.50T / $7.63B / $2.10M / $12,345. 음수 안전.
// data·derivatives·instruments 상세가 각각 중복 정의하던 것을 단일 소스로(R124).
export function compactUsd(value?: string | null): string {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

// 큰 원화 금액을 사람이 읽는 한글 단위로(예: 10000000 → "1,000만원", 150000000 → "1억 5,000만원").
// 1만원 미만/비수치는 빈 문자열(보조 힌트용). (R127: paper 로컬 정의를 lib로 추출)
export function koreanMoney(n: number): string {
  if (!Number.isFinite(n) || n < 10000) return "";
  const eok = Math.floor(n / 1e8);
  const man = Math.floor((n % 1e8) / 1e4);
  const parts: string[] = [];
  if (eok) parts.push(`${eok.toLocaleString("ko-KR")}억`);
  if (man) parts.push(`${man.toLocaleString("ko-KR")}만`);
  return parts.length ? parts.join(" ") + "원" : "";
}

// USD 금액을 한글 조(1e12)/억(1e8)/만(1e4) 스케일로, 예: "$3.42조". 음수 안전, null→"-".
// (R129: 홈 로컬 정의를 lib로 추출. compactUsd(T/B/M)와 달리 한글 단위 표기.)
export function compactUsdScaled(v?: string | null): string {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return "-";
  const neg = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e12) return `${neg}$${(a / 1e12).toFixed(2)}조`;
  if (a >= 1e8) return `${neg}$${(a / 1e8).toFixed(2)}억`;
  if (a >= 1e4) return `${neg}$${(a / 1e4).toFixed(0)}만`;
  return `${neg}$${a.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

// ko-KR 로케일 숫자 포맷(지수·지표 표시용). null/빈값→"-", 비수치는 원본 문자열 유지.
// (R131: 홈 로컬 정의를 lib로 추출.)
export function fmtNum(v?: string | null, frac = 2): string {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return n.toLocaleString("ko-KR", { maximumFractionDigits: frac });
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
