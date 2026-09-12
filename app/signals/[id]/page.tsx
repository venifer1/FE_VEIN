"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, ThumbsDown, ThumbsUp, WalletCards } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { ChartView } from "@/components/chart-view";
import { StatusBadge, TypeBadge, FreshnessBadge, MarketBadge } from "@/components/badges";
import { ErrorState, StaleNotice, ComplianceFooter } from "@/components/states";
import { AlertCreateDialog } from "@/components/alert-create-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSignalDetail,
  useSignalPerformance,
  useSignalExplain,
  useExplainFeedback,
  useSubmitExplainFeedback,
  useInstrumentCandles,
  useWatchlist,
  useAddWatchItem,
  useRemoveWatchItem,
  useCreatePaperOrder,
} from "@/lib/queries";
import { formatPrice, formatPct, formatScore, formatTime, pctSign } from "@/lib/format";
import { instrumentPathId } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Evidence, Freshness, SignalDetail } from "@/lib/types";

function pctClass(value?: string | null): string {
  const s = pctSign(value);
  if (s > 0) return "text-[hsl(var(--success))]";
  if (s < 0) return "text-destructive";
  return "text-foreground";
}

function SignalActionPanel({
  id,
  signal,
  instrumentNavId,
}: {
  id: string;
  signal: SignalDetail;
  instrumentNavId: string;
}) {
  const [quantity, setQuantity] = useState("1");
  const [leverage, setLeverage] = useState("3");
  const explain = useSignalExplain(id);
  const paperOrder = useCreatePaperOrder();
  const blocked = explain.data?.risk_guard === "BLOCK";
  const busy = paperOrder.isPending;

  const createPaper = (positionSide: "LONG" | "SHORT") => {
    paperOrder.mutate({
      instrument_id: instrumentNavId,
      side: positionSide === "LONG" ? "BUY" : "SELL",
      type: "MARKET",
      quantity,
      price: signal.current_price || undefined,
      investment_type: "FUTURES",
      position_side: positionSide,
      leverage,
      timeframe: signal.timeframe,
    });
  };

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">다음 액션</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">신호를 바로 검증하거나 모의 포지션으로 이어갑니다.</p>
          </div>
          {blocked && <Badge variant="destructive">Risk Guard BLOCK</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="수량" />
          <Input inputMode="decimal" value={leverage} onChange={(e) => setLeverage(e.target.value)} placeholder="레버리지" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={blocked || busy} onClick={() => createPaper("LONG")}>
            <WalletCards className="h-4 w-4" />
            Paper Long
          </Button>
          <Button variant="destructive" disabled={blocked || busy} onClick={() => createPaper("SHORT")}>
            <WalletCards className="h-4 w-4" />
            Paper Short
          </Button>
        </div>
        {paperOrder.isError && (
          <p className="text-xs text-destructive">
            모의 주문에 실패했습니다. 모의 계정이 없으면 `/paper`에서 먼저 계정을 생성하세요.
          </p>
        )}
        {paperOrder.isSuccess && <p className="text-xs text-[hsl(var(--success))]">모의 주문이 생성되었습니다.</p>}
        <div className="grid grid-cols-2 gap-2">
          <Link
            className={buttonVariants({ variant: "outline", className: "w-full" })}
            href={`/scanner?tab=backtest&type=${signal.type}&market=${signal.market}&timeframe=${signal.timeframe}`}
          >
            <BarChart3 className="h-4 w-4" />
            백테스트
          </Link>
          <Link className={buttonVariants({ variant: "outline", className: "w-full" })} href="/paper">
            <WalletCards className="h-4 w-4" />
            모의 화면
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function HorizonStrip({ id }: { id: string }) {
  const { data, isLoading } = useSignalPerformance(id);
  const horizons = data?.horizons ?? [];
  if (isLoading) return <Skeleton className="h-7 w-full" />;
  if (horizons.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border py-1.5 text-center text-[11px] text-muted-foreground">
        성과 측정 대기 중
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {horizons.map((h) => {
        const s = pctSign(h.return_pct);
        return (
          <span
            key={h.horizon}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] tabular-nums",
              s > 0
                ? "border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                : s < 0
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground",
            )}
          >
            <span className="font-mono text-muted-foreground">{h.horizon}</span>
            <span className="font-mono font-semibold">{formatPct(h.return_pct)}</span>
          </span>
        );
      })}
    </div>
  );
}

function PerformancePanel({ id }: { id: string }) {
  const { data, isLoading } = useSignalPerformance(id);
  const horizons = data?.horizons ?? [];
  return (
    <Card>
      <CardContent className="space-y-2">
        <h2 className="text-sm font-semibold">성과</h2>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : horizons.length === 0 ? (
          <p className="rounded-md border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
            성과 측정 대기 중입니다. 탐지 후 시간이 더 지나야 계산됩니다.
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {horizons.map((h) => (
              <li key={h.horizon} className="flex items-center justify-between py-2">
                <span className="font-mono text-muted-foreground">{h.horizon}</span>
                <div className="text-right">
                  <span className={cn("font-mono font-semibold tabular-nums", pctClass(h.return_pct))}>
                    {formatPct(h.return_pct)}
                  </span>
                  <div className="mt-0.5 flex justify-end gap-2 text-[10px] text-muted-foreground tabular-nums">
                    <span>MFE {formatPct(h.mfe_pct)}</span>
                    <span>MAE {formatPct(h.mae_pct)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const RISK_LABEL = {
  PASS: { text: "위험 필터 통과", variant: "default" as const },
  WARN: { text: "주의 필요", variant: "warning" as const },
  BLOCK: { text: "위험 차단", variant: "destructive" as const },
};

const CONFIDENCE_LABEL = {
  INSUFFICIENT: "표본 부족",
  LOW: "낮음",
  MEDIUM: "보통",
  HIGH: "높음",
};

function ExplainPanel({ id }: { id: string }) {
  const { data, isLoading } = useSignalExplain(id);
  const feedback = useExplainFeedback(id);
  const submitFeedback = useSubmitExplainFeedback(id);
  const [showReasons, setShowReasons] = useState(false);
  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (!data) return null;
  const risk = RISK_LABEL[data.risk_guard];

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Pattern Score · 근거 설명</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              구조 점수와 별도로 계산한 규칙 기반 참고 점수입니다.
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums text-primary">{data.pattern_score}</p>
            <p className="text-[10px] text-muted-foreground">/ 100</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={risk.variant}>{risk.text}</Badge>
          <Badge variant="secondary">
            신뢰도 {CONFIDENCE_LABEL[data.confidence.grade]} · 표본 {data.confidence.sample_size}
          </Badge>
          {data.confidence.hit_rate && (
            <Badge variant="outline">
              {data.confidence.horizon} 적중률 {formatPct(data.confidence.hit_rate)}
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          {data.factors.map((factor) => (
            <div key={factor.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">{factor.label}</span>
                <span className="font-mono">{factor.score}/{factor.max_score}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((factor.score / factor.max_score) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{factor.detail}</p>
            </div>
          ))}
        </div>

        <ExplainList title="탐지 근거" items={data.reasons} />
        <ExplainList title="위험 요인" items={data.risks} destructive />
        <ExplainList title="다음 확인 사항" items={data.next_checks} />

        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">이 설명이 유용했나요?</p>
            {feedback.data?.helpful_rate && (
              <span className="text-[10px] text-muted-foreground">
                유용 {feedback.data.helpful_rate}% · {feedback.data.total_count}명
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={feedback.data?.my_helpful === true ? "default" : "outline"}
              disabled={submitFeedback.isPending}
              onClick={() => {
                setShowReasons(false);
                submitFeedback.mutate({ helpful: true });
              }}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              유용해요
            </Button>
            <Button
              size="sm"
              variant={feedback.data?.my_helpful === false ? "destructive" : "outline"}
              disabled={submitFeedback.isPending}
              onClick={() => setShowReasons(true)}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              아쉬워요
            </Button>
          </div>
          {showReasons && (
            <div className="flex flex-wrap gap-1.5">
              {[
                ["UNCLEAR", "설명이 불명확"],
                ["INACCURATE", "내용이 부정확"],
                ["MISSING_RISK", "위험 설명 부족"],
                ["TOO_COMPLEX", "너무 복잡함"],
              ].map(([reason, label]) => (
                <Button
                  key={reason}
                  size="sm"
                  variant="secondary"
                  disabled={submitFeedback.isPending}
                  onClick={() => {
                    submitFeedback.mutate({ helpful: false, reason });
                    setShowReasons(false);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground">
          설명 템플릿 {data.template_version} · 매수/매도 권유가 아닙니다.
        </p>
      </CardContent>
    </Card>
  );
}

function ExplainList({
  title,
  items,
  destructive = false,
}: {
  title: string;
  items: string[];
  destructive?: boolean;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold">{title}</h3>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li
            key={item}
            className={cn("text-xs leading-relaxed text-muted-foreground", destructive && "text-destructive")}
          >
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

const EVIDENCE_LABEL: Record<string, string> = {
  PIVOT_0: "피벗 0",
  PIVOT_A: "피벗 A",
  PIVOT_B: "피벗 B",
  C_TARGET: "C 목표가",
  TREND_UPPER: "상단 추세선",
  TREND_LOWER: "하단 추세선",
  BOLL_UPPER: "볼린저 상단",
  BOLL_MID: "볼린저 중심",
  BOLL_LOWER: "볼린저 하단",
  MATCH_BOX: "매칭 박스",
};

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  const grouped = evidence.reduce<Record<string, Evidence[]>>((acc, e) => {
    (acc[e.type] ??= []).push(e);
    return acc;
  }, {});
  return (
    <Card>
      <CardContent className="space-y-2">
        <h2 className="text-sm font-semibold">근거</h2>
        <ul className="divide-y divide-border text-sm">
          {Object.entries(grouped).map(([type, items]) => (
            <li key={type} className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">{EVIDENCE_LABEL[type] ?? type}</span>
              <span className="text-right font-mono">
                {items.length > 1
                  ? items.map((i) => formatPrice(i.price)).join(" · ")
                  : formatPrice(items[0].price)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function DetailInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { data, isLoading, isError, error, refetch } = useSignalDetail(id);

  const signal = data?.data;
  const freshness = (data?.meta?.freshness as Freshness | undefined) ?? undefined;
  const instrumentId = signal?.instrument?.id != null ? String(signal.instrument.id) : undefined;
  const instrumentNavId = instrumentPathId(signal?.instrument?.id);

  const candlesQuery = useInstrumentCandles(instrumentId, signal?.timeframe ?? "4h");
  const candleData = candlesQuery.data?.data;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = candlesQuery;
  const loadOlderCandles = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const { data: watchlist } = useWatchlist();
  const addItem = useAddWatchItem();
  const removeItem = useRemoveWatchItem();
  const inWatchlist = !!watchlist?.items?.some(
    (i) => instrumentPathId(i.instrument?.id) === instrumentNavId,
  );

  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="뒤로">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold">신호 상세</h1>
      </div>

      <div className="space-y-4 px-4 pb-4">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-72 w-full" />
          </>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : signal ? (
          <>
            {signal.status === "INVALIDATED" && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                이 신호는 무효화되었습니다. 규칙: {signal.invalidation?.rule ?? "-"}
              </div>
            )}
            {signal.status === "EXPIRED" && (
              <div className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
                만료된 신호입니다.
              </div>
            )}
            {freshness === "DELAYED" && <StaleNotice updatedAt={candleData?.candles?.at(-1)?.open_time} onRefresh={() => candlesQuery.refetch()} />}

            <Card>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <Link href={`/instruments/${instrumentNavId}`} className="min-w-0 underline-offset-2 hover:underline">
                    <span className="block truncate text-lg font-semibold">
                      {signal.instrument?.name || signal.instrument?.symbol}
                    </span>
                    {signal.instrument?.name && (
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {signal.instrument.symbol}
                      </span>
                    )}
                  </Link>
                  <FreshnessBadge freshness={freshness} updatedAt={candleData?.candles?.at(-1)?.open_time} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <MarketBadge market={signal.market} />
                  <TypeBadge type={signal.type} subtype={signal.subtype} />
                  <StatusBadge status={signal.status} />
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs">{signal.timeframe}</span>
                  <span className="text-xs text-muted-foreground">구조 점수 {formatScore(signal.score)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>현재가 {formatPrice(signal.current_price)}</span>
                  {(signal.type === "ABC" || signal.type === "TOP") && signal.c_target && (
                    <span className="text-[hsl(var(--success))]">C 목표가 {formatPrice(signal.c_target)}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">탐지 {formatTime(signal.detected_at)}</p>
              </CardContent>
            </Card>

            {signal.event_risk?.active && (
              <div
                className={`rounded-md border px-3 py-2 text-sm ${
                  signal.event_risk.level === "HIGH"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                    ⚠ 이벤트 리스크 {signal.event_risk.level}
                  </span>
                </div>
                <p className="mt-1 leading-snug">{signal.event_risk.note}</p>
              </div>
            )}

            <SignalActionPanel id={id} signal={signal} instrumentNavId={instrumentNavId} />

            <Card>
              <CardContent className="space-y-2">
                <h2 className="text-sm font-semibold">차트 · 근거 오버레이</h2>
                {candlesQuery.isLoading ? (
                  <Skeleton className="h-72 w-full" />
                ) : candlesQuery.isError ? (
                  <div className="rounded-md border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                    캔들 데이터를 불러오지 못했습니다.
                    <div className="mt-2">
                      <Button size="sm" variant="outline" onClick={() => candlesQuery.refetch()}>다시 시도</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <HorizonStrip id={id} />
                    <ChartView
                      candles={candleData?.candles ?? []}
                      evidence={signal.evidence}
                      invalidation={signal.invalidation}
                      onLoadOlder={loadOlderCandles}
                      hasOlder={!!hasNextPage}
                      isLoadingOlder={isFetchingNextPage}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <EvidenceList evidence={signal.evidence} />
            <ExplainPanel id={id} />
            <PerformancePanel id={id} />

            <Card>
              <CardContent className="space-y-1">
                <h2 className="text-sm font-semibold">무효화 기준</h2>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">규칙</span>
                  <span className="font-mono">{signal.invalidation?.rule ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">무효화 가격</span>
                  <span className="font-mono">{formatPrice(signal.invalidation?.price)}</span>
                </div>
                {(() => {
                  // 리스크·리워드(R66 후속): 현재가 대비 목표/무효화 거리 + 손익비. ABC/TOP만.
                  const cur = Number(signal.current_price);
                  const tgt = Number(signal.c_target);
                  const inv = Number(signal.invalidation?.price);
                  const ok =
                    (signal.type === "ABC" || signal.type === "TOP") &&
                    Number.isFinite(cur) && cur !== 0 && Number.isFinite(tgt) && Number.isFinite(inv);
                  if (!ok) return null;
                  const up = ((tgt - cur) / cur) * 100;
                  const down = ((inv - cur) / cur) * 100;
                  const rr = Math.abs(down) > 0 ? Math.abs(up) / Math.abs(down) : null;
                  return (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">목표까지</span>
                        <span className="font-mono text-emerald-600">{up >= 0 ? "+" : ""}{up.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">무효화까지</span>
                        <span className="font-mono text-red-500">{down >= 0 ? "+" : ""}{down.toFixed(1)}%</span>
                      </div>
                      {rr != null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">손익비(R:R)</span>
                          <span className="font-mono">{rr.toFixed(2)} : 1</span>
                        </div>
                      )}
                    </>
                  );
                })()}
                <p className="pt-1 text-xs text-muted-foreground">알고리즘 {signal.algorithm_version}</p>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                variant={inWatchlist ? "secondary" : "default"}
                className="flex-1"
                disabled={addItem.isPending || removeItem.isPending}
                onClick={() =>
                  inWatchlist
                    ? removeItem.mutate(instrumentNavId)
                    : addItem.mutate(instrumentNavId)
                }
              >
                {inWatchlist ? "관심 해제" : "관심 등록"}
              </Button>
              <AlertCreateDialog
                instrumentId={instrumentNavId}
                symbol={signal.instrument?.symbol ?? ""}
                signalType={signal.type}
                timeframe={signal.timeframe}
                market={signal.market}
              />
            </div>
          </>
        ) : null}
      </div>
      <ComplianceFooter />
    </div>
  );
}

export default function SignalDetailPage() {
  return (
    <RequireAuth>
      <DetailInner />
    </RequireAuth>
  );
}
