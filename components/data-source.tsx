"use client";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useSystemStatus } from "@/lib/queries";
import type { Market, SystemStatus } from "@/lib/types";

// 데이터 출처 사용지점 노출(R50, Track B #3). R40이 설정 화면 한 곳에만 REAL/STUB를 보여줬는데,
// 합성 스텁 데이터는 종목 차트·데이터 탭 등 여러 화면에 조용히 뜬다. 사이드카가 다운되면
// 미국·한국 주식(yfinance/pykrx)·텔레그램 속보(telegram)가 합성값으로 폴백되므로, 그 사실을
// 실제로 데이터를 보는 자리에서 알린다.

const STUB_LABELS: Record<string, string> = {
  yfinance: "미국주식",
  pykrx: "국내주식",
  telegram: "텔레그램",
};

/** 시장 → 그 시장 캔들/지표를 공급하는 프로바이더. 코인은 실연동이라 null. */
export function providerForMarket(market?: Market | null): string | null {
  if (market === "US") return "yfinance";
  if (market === "KOSPI" || market === "KOSDAQ") return "pykrx";
  return null;
}

function stubProviders(status?: SystemStatus): string[] {
  return (status?.providers ?? []).filter((p) => p.source === "STUB").map((p) => p.provider);
}

/** 이 시장의 데이터가 지금 합성 스텁인가. */
export function isMarketStub(status: SystemStatus | undefined, market?: Market | null): boolean {
  const provider = providerForMarket(market);
  return !!provider && stubProviders(status).includes(provider);
}

/**
 * 전역 얇은 배너. 사이드카 다운 또는 STUB 프로바이더가 하나라도 있으면 상단에 상시 노출하고
 * 설정 "데이터 출처"로 링크한다. 정상(전부 실데이터)이면 렌더하지 않는다.
 */
export function DataSourceBanner() {
  const { data } = useSystemStatus();
  const stubs = stubProviders(data);
  const degraded = data?.sidecar?.healthy === false || stubs.length > 0;
  if (!degraded) return null;

  const labels = stubs
    .map((p) => STUB_LABELS[p] ?? p)
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <Link
      href="/settings"
      className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-[11px] text-amber-600"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="flex-1 truncate">
        일부 데이터가 합성값입니다{labels.length ? ` · ${labels.join("·")}` : ""}
      </span>
      <span className="shrink-0 underline">자세히</span>
    </Link>
  );
}

/** 종목 상세 등 시장이 명확한 자리에서, 그 시장이 합성 스텁이면 붙이는 배지. */
export function MarketStubBadge({ market }: { market?: Market | null }) {
  const { data } = useSystemStatus();
  if (!isMarketStub(data, market)) return null;
  return (
    <span className="rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
      합성
    </span>
  );
}
