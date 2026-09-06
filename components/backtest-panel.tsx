"use client";
import { useState } from "react";
import { ChevronDown, RotateCw, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/sparkline";
import { InstrumentLabel } from "@/components/instrument-label";
import { EmptyState, ErrorState } from "@/components/states";
import { MARKET_LABEL, SIGNAL_TYPE_LABEL } from "@/components/badges";
import { cn } from "@/lib/utils";
import {
  useBacktest,
  useDeleteStrategy,
  useRunStrategy,
  useSaveStrategy,
  useStrategies,
  useStrategyHistory,
  type BacktestInput,
} from "@/lib/queries";
import { formatPct, formatPrice, formatRelative, pctSign } from "@/lib/format";
import { timeframesForMarket } from "@/lib/types";
import type {
  BacktestMetrics,
  BacktestResult,
  BacktestTrade,
  BacktestWalkForward,
  Market,
  SignalType,
  Strategy,
  StrategyRun,
  Timeframe,
} from "@/lib/types";

const TYPES: SignalType[] = ["ABC", "TOP", "IMALOL"];
const MARKETS: { value: Market | undefined; label: string }[] = [
  { value: undefined, label: "전체" },
  { value: "CRYPTO", label: MARKET_LABEL.CRYPTO },
  { value: "US", label: MARKET_LABEL.US },
  { value: "KOSPI", label: MARKET_LABEL.KOSPI },
  { value: "KOSDAQ", label: MARKET_LABEL.KOSDAQ },
];
const HORIZONS = ["4h", "1d", "3d", "7d"];

const OUTCOME_LABEL: Record<string, string> = { WIN: "익절", LOSS: "손절", TIME: "시간" };
const OUTCOME_VARIANT: Record<string, "success" | "destructive" | "secondary"> = {
  WIN: "success",
  LOSS: "destructive",
  TIME: "secondary",
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
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

// One metric card; null-safe value display.
function Metric({ label, value, sign }: { label: string; value: string; sign?: number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-0.5 text-base font-semibold tabular-nums",
            sign === 1 && "text-[hsl(var(--success))]",
            sign === -1 && "text-destructive",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function MetricsGrid({ metrics }: { metrics: BacktestMetrics }) {
  const winRate = metrics.win_rate != null ? `${metrics.win_rate}%` : "-";
  const mdd = metrics.max_drawdown_pct != null ? `${metrics.max_drawdown_pct}%` : "-";
  const pf = metrics.profit_factor ?? "-";
  const best = metrics.best_pct;
  const worst = metrics.worst_pct;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Metric label="거래수" value={String(metrics.trade_count ?? 0)} />
      <Metric label="승률" value={winRate} />
      <Metric label="평균수익" value={formatPct(metrics.avg_return_pct)} sign={pctSign(metrics.avg_return_pct)} />
      <Metric label="누적수익" value={formatPct(metrics.total_return_pct)} sign={pctSign(metrics.total_return_pct)} />
      <Metric label="Profit Factor" value={pf} />
      <Metric label="MDD" value={mdd} sign={mdd === "-" ? 0 : -1} />
      <Metric label="최고" value={formatPct(best)} sign={pctSign(best)} />
      <Metric label="최저" value={formatPct(worst)} sign={pctSign(worst)} />
    </div>
  );
}

// One IS/OOS row: a metric label with the in-sample and out-of-sample values
// side by side. Null-safe; decimals formatted at display.
function WalkForwardRow({
  label,
  is,
  oos,
  sign,
}: {
  label: string;
  is: string;
  oos: string;
  sign?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-border py-1.5 last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "w-16 text-right text-sm font-medium tabular-nums",
          sign && is !== "-" && pctSign(is.replace("%", "")) === 1 && "text-[hsl(var(--success))]",
          sign && is !== "-" && pctSign(is.replace("%", "")) === -1 && "text-destructive",
        )}
      >
        {is}
      </span>
      <span
        className={cn(
          "w-16 text-right text-sm font-medium tabular-nums",
          sign && oos !== "-" && pctSign(oos.replace("%", "")) === 1 && "text-[hsl(var(--success))]",
          sign && oos !== "-" && pctSign(oos.replace("%", "")) === -1 && "text-destructive",
        )}
      >
        {oos}
      </span>
    </div>
  );
}

function pctOrDash(v?: string | null): string {
  return v != null && v !== "" ? `${v}%` : "-";
}

// IS vs OOS comparison block — two columns (In-Sample / Out-of-Sample) for the
// core metrics, with a prominent overfit warning badge when flagged.
function WalkForwardBlock({ wf }: { wf: BacktestWalkForward }) {
  const is = wf.in_sample;
  const oos = wf.out_of_sample;
  const overfit = wf.overfit_warning === true;
  const ratioPct = wf.is_ratio != null ? `${Math.round(Number(wf.is_ratio) * 100)}%` : null;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">워크포워드 검증</p>
          {ratioPct && (
            <span className="text-[11px] text-muted-foreground">IS {ratioPct}</span>
          )}
        </div>
        {overfit ? (
          <Badge variant="destructive" className="text-xs font-semibold">
            ⚠ 과적합 주의
          </Badge>
        ) : (
          <span className="text-[11px] text-[hsl(var(--success))]">검증 통과</span>
        )}
      </div>
      <div className="mb-1 grid grid-cols-[1fr_auto_auto] gap-2">
        <span />
        <span className="w-16 text-right text-[11px] font-medium text-muted-foreground">In-Sample</span>
        <span className="w-16 text-right text-[11px] font-medium text-muted-foreground">Out-of-Sample</span>
      </div>
      <WalkForwardRow label="거래수" is={String(is.trade_count ?? 0)} oos={String(oos.trade_count ?? 0)} />
      <WalkForwardRow label="승률" is={pctOrDash(is.win_rate)} oos={pctOrDash(oos.win_rate)} />
      <WalkForwardRow label="평균수익" is={formatPct(is.avg_return_pct)} oos={formatPct(oos.avg_return_pct)} sign />
      <WalkForwardRow label="누적수익" is={formatPct(is.total_return_pct)} oos={formatPct(oos.total_return_pct)} sign />
      <WalkForwardRow label="Profit Factor" is={is.profit_factor ?? "-"} oos={oos.profit_factor ?? "-"} />
      <WalkForwardRow label="MDD" is={pctOrDash(is.max_drawdown_pct)} oos={pctOrDash(oos.max_drawdown_pct)} />
      {overfit && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          검증 구간(OOS) 성과가 학습 구간(IS) 대비 크게 저하되었습니다. 과최적화 가능성을 점검하세요.
        </p>
      )}
    </div>
  );
}

function EquityChart({ result }: { result: BacktestResult }) {
  const pts = (result.equity_curve ?? [])
    .map((p) => Number(p.equity))
    .filter((v) => Number.isFinite(v));
  if (pts.length < 2) return null;
  const last = pts.at(-1) ?? 1;
  const up = last >= 1;
  return (
    <Card>
      <CardContent className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">자본 곡선 (시작 1.0)</p>
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              up ? "text-[hsl(var(--success))]" : "text-destructive",
            )}
          >
            {last.toFixed(3)}
          </span>
        </div>
        <Sparkline
          values={pts}
          width={340}
          height={72}
          strokeWidth={1.5}
          className={cn("w-full", up ? "text-[hsl(var(--success))]" : "text-destructive")}
        />
      </CardContent>
    </Card>
  );
}

function TradeRow({ trade }: { trade: BacktestTrade }) {
  const sign = pctSign(trade.return_pct);
  const outcome = trade.outcome ?? "";
  return (
    <div className="flex items-center gap-3 border-b border-border px-1 py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <InstrumentLabel name={trade.name} symbol={trade.symbol} inline nameClassName="text-sm font-medium" />
          {outcome && (
            <Badge variant={OUTCOME_VARIANT[outcome] ?? "secondary"}>{OUTCOME_LABEL[outcome] ?? outcome}</Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground tabular-nums">
          <span>진입 {formatPrice(trade.entry)}</span>
          <span aria-hidden>→</span>
          <span>청산 {formatPrice(trade.exit)}</span>
          {trade.detected_at && (
            <>
              <span aria-hidden>·</span>
              <span>{formatRelative(trade.detected_at)}</span>
            </>
          )}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          sign === 1 && "text-[hsl(var(--success))]",
          sign === -1 && "text-destructive",
        )}
      >
        {formatPct(trade.return_pct)}
      </span>
    </div>
  );
}

const PAGE = 50;

// Compact summary line for a saved strategy: 패턴 · 시장 · 주기.
function strategyMeta(s: Strategy): string {
  const parts = [SIGNAL_TYPE_LABEL[s.type as SignalType] ?? s.type];
  if (s.market) parts.push(MARKET_LABEL[s.market as Market] ?? String(s.market));
  if (s.timeframe) parts.push(String(s.timeframe));
  return parts.join(" · ");
}

// Per-strategy 성과 히스토리: sparkline of total_return_pct across snapshots
// (oldest→newest) + the latest snapshot's key metrics and relative run time.
// Loaded lazily — `useStrategyHistory` is enabled only while the row is open.
function StrategyHistory({ strategyId }: { strategyId: string | number }) {
  const query = useStrategyHistory(strategyId, true);

  if (query.isLoading) {
    return (
      <div className="space-y-2 pb-2">
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  // History arrives newest-first; the sparkline wants oldest→newest.
  const newestFirst: StrategyRun[] = query.data ?? [];
  if (newestFirst.length === 0) {
    return (
      <p className="py-4 text-center text-[11px] text-muted-foreground">
        재실행하여 성과를 기록하세요
      </p>
    );
  }
  const oldestFirst = [...newestFirst].reverse();
  const values = oldestFirst
    .map((r) => Number(r.total_return_pct))
    .filter((v) => Number.isFinite(v));
  const latest = newestFirst[0];
  const total = latest.total_return_pct;
  const up = pctSign(total) >= 0;

  return (
    <div className="space-y-2 pb-2">
      {values.length >= 2 && (
        <Sparkline
          values={values}
          width={320}
          height={40}
          strokeWidth={1.5}
          className={cn("w-full", up ? "text-[hsl(var(--success))]" : "text-destructive")}
        />
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
        <span>거래 {latest.trade_count ?? 0}건</span>
        {latest.win_rate != null && (
          <>
            <span aria-hidden>·</span>
            <span>승률 {latest.win_rate}%</span>
          </>
        )}
        {total != null && (
          <>
            <span aria-hidden>·</span>
            <span
              className={cn(
                pctSign(total) === 1 && "text-[hsl(var(--success))]",
                pctSign(total) === -1 && "text-destructive",
              )}
            >
              누적 {formatPct(total)}
            </span>
          </>
        )}
        <span aria-hidden>·</span>
        <span>{formatRelative(latest.run_at)}</span>
      </div>
    </div>
  );
}

// One saved-strategy row: name + meta + key metric, click to expand history,
// ↻ to re-run, × to delete. The chevron/expand reveals the 성과 히스토리.
function StrategyRow({
  strategy,
  onLoad,
  onDelete,
  onRun,
  deleting,
  running,
}: {
  strategy: Strategy;
  onLoad: (s: Strategy) => void;
  onDelete: (s: Strategy) => void;
  onRun: (s: Strategy) => void;
  deleting: boolean;
  running: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const m = strategy.metrics;
  const winRate = m?.win_rate != null ? `승률 ${m.win_rate}%` : null;
  const total = m?.total_return_pct;
  return (
    <div className="border-b border-border py-2 last:border-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((o) => !o)}
          aria-expanded={expanded}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-medium">{strategy.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
            <span>{strategyMeta(strategy)}</span>
            {winRate && (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{winRate}</span>
              </>
            )}
            {total != null && (
              <>
                <span aria-hidden>·</span>
                <span
                  className={cn(
                    "tabular-nums",
                    pctSign(total) === 1 && "text-[hsl(var(--success))]",
                    pctSign(total) === -1 && "text-destructive",
                  )}
                >
                  누적 {formatPct(total)}
                </span>
              </>
            )}
          </div>
        </button>
        <button
          type="button"
          aria-label="재실행"
          disabled={running}
          onClick={() => onRun(strategy)}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          <RotateCw className={cn("h-4 w-4", running && "animate-spin")} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="전략 삭제"
          disabled={deleting}
          onClick={() => onDelete(strategy)}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {expanded && (
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">성과 히스토리</p>
            <button
              type="button"
              onClick={() => onLoad(strategy)}
              className="text-[11px] text-primary"
            >
              불러오기
            </button>
          </div>
          <StrategyHistory strategyId={strategy.id} />
        </div>
      )}
    </div>
  );
}

function SavedStrategies({ onLoad }: { onLoad: (s: Strategy) => void }) {
  const [open, setOpen] = useState(false);
  const query = useStrategies();
  const del = useDeleteStrategy();
  const run = useRunStrategy();
  const list = query.data ?? [];

  function handleDelete(s: Strategy) {
    del.mutate(s.id);
  }

  function handleRun(s: Strategy) {
    run.mutate(s.id);
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-3"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          저장된 전략
          {list.length > 0 && (
            <span className="text-[11px] text-muted-foreground">{list.length}</span>
          )}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t border-border px-3 pb-2">
          {query.isLoading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : list.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">저장된 전략 없음</p>
          ) : (
            <div>
              {list.map((s) => (
                <StrategyRow
                  key={String(s.id)}
                  strategy={s}
                  onLoad={onLoad}
                  onDelete={handleDelete}
                  onRun={handleRun}
                  deleting={del.isPending && del.variables === s.id}
                  running={run.isPending && run.variables === s.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BacktestPanel() {
  const [type, setType] = useState<SignalType>("ABC");
  const [market, setMarket] = useState<Market | undefined>(undefined);
  const [timeframe, setTimeframe] = useState<Timeframe | undefined>(undefined);
  const [horizon, setHorizon] = useState("1d");
  const [targetPct, setTargetPct] = useState("5");
  const [stopPct, setStopPct] = useState("3");
  const [periodDays, setPeriodDays] = useState("90");
  const [feePct, setFeePct] = useState("0.1");
  const [walkForward, setWalkForward] = useState(false);
  const [isRatio, setIsRatio] = useState("0.7");
  const [shown, setShown] = useState(PAGE);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");

  const mutation = useBacktest();
  const saveMutation = useSaveStrategy();
  const result = mutation.data;

  const tfs: (Timeframe | undefined)[] = [undefined, ...timeframesForMarket(market)];

  function currentInput(): BacktestInput {
    return {
      type,
      market,
      timeframe,
      target_pct: Number(targetPct) || 0,
      stop_pct: Number(stopPct) || 0,
      horizon,
      period_days: Number(periodDays) || undefined,
      fee_pct: feePct === "" ? undefined : Number(feePct),
      walk_forward: walkForward || undefined,
      is_ratio: walkForward ? Number(isRatio) || 0.7 : undefined,
    };
  }

  function onRun(input: BacktestInput = currentInput()) {
    setShown(PAGE);
    mutation.mutate(input);
  }

  // Load a saved strategy's params into the form, then auto-run it.
  function loadStrategy(s: Strategy) {
    const p = s.params;
    const nextType = (p.type as SignalType) ?? "ABC";
    const nextMarket = (p.market ?? undefined) as Market | undefined;
    const nextTimeframe = (p.timeframe ?? undefined) as Timeframe | undefined;
    const nextHorizon = p.horizon ?? "1d";
    const nextTarget = p.target_pct != null ? String(p.target_pct) : "";
    const nextStop = p.stop_pct != null ? String(p.stop_pct) : "";
    const nextPeriod = p.period_days != null ? String(p.period_days) : "";
    const nextFee = p.fee_pct != null ? String(p.fee_pct) : "";

    setType(nextType);
    setMarket(nextMarket);
    setTimeframe(nextTimeframe);
    setHorizon(nextHorizon);
    setTargetPct(nextTarget);
    setStopPct(nextStop);
    setPeriodDays(nextPeriod);
    setFeePct(nextFee);
    setSaving(false);

    onRun({
      type: nextType,
      market: nextMarket,
      timeframe: nextTimeframe,
      target_pct: Number(nextTarget) || 0,
      stop_pct: Number(nextStop) || 0,
      horizon: nextHorizon,
      period_days: Number(nextPeriod) || undefined,
      fee_pct: nextFee === "" ? undefined : Number(nextFee),
    });
  }

  function onSave() {
    const name = saveName.trim();
    if (!name || !result) return;
    saveMutation.mutate(
      { name, params: currentInput(), metrics: result.metrics },
      {
        onSuccess: () => {
          setSaving(false);
          setSaveName("");
        },
      },
    );
  }

  const trades = result?.trades ?? [];

  return (
    <div className="space-y-4 p-4">
      <p className="text-xs text-muted-foreground">
        과거 데이터로 패턴 진입/청산을 시뮬레이션합니다. 목표·손절·보유기간 조건으로 성과를 추정합니다.
      </p>

      {/* ----- saved strategies ----- */}
      <SavedStrategies onLoad={loadStrategy} />

      {/* ----- form ----- */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">패턴</Label>
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            {TYPES.map((t) => (
              <Chip key={t} active={type === t} onClick={() => setType(t)}>
                {SIGNAL_TYPE_LABEL[t]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">시장</Label>
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            {MARKETS.map((m) => (
              <Chip
                key={m.label}
                active={market === m.value}
                onClick={() => {
                  setMarket(m.value);
                  setTimeframe(undefined);
                }}
              >
                {m.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">주기</Label>
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            {tfs.map((t) => (
              <Chip key={t ?? "all"} active={timeframe === t} onClick={() => setTimeframe(t)}>
                {t ?? "전체"}
              </Chip>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">보유기간 (horizon)</Label>
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            {HORIZONS.map((h) => (
              <Chip key={h} active={horizon === h} onClick={() => setHorizon(h)}>
                {h}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bt-target" className="text-xs text-muted-foreground">목표 %</Label>
            <Input id="bt-target" type="number" inputMode="decimal" value={targetPct} onChange={(e) => setTargetPct(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bt-stop" className="text-xs text-muted-foreground">손절 %</Label>
            <Input id="bt-stop" type="number" inputMode="decimal" value={stopPct} onChange={(e) => setStopPct(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bt-period" className="text-xs text-muted-foreground">기간 (일)</Label>
            <Input id="bt-period" type="number" inputMode="numeric" value={periodDays} onChange={(e) => setPeriodDays(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bt-fee" className="text-xs text-muted-foreground">수수료 %</Label>
            <Input id="bt-fee" type="number" inputMode="decimal" value={feePct} onChange={(e) => setFeePct(e.target.value)} />
          </div>
        </div>
        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <Label htmlFor="bt-wf" className="text-sm font-medium">워크포워드 검증</Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                기간을 학습(IS)·검증(OOS)으로 나눠 과적합 여부를 점검합니다.
              </p>
            </div>
            <Switch
              checked={walkForward}
              onCheckedChange={setWalkForward}
              aria-label="워크포워드 검증"
            />
          </div>
          {walkForward && (
            <div className="space-y-1.5">
              <Label htmlFor="bt-isratio" className="text-xs text-muted-foreground">
                학습 비율 (IS, 0.5–0.9)
              </Label>
              <Input
                id="bt-isratio"
                type="number"
                inputMode="decimal"
                min={0.5}
                max={0.9}
                step={0.05}
                value={isRatio}
                onChange={(e) => setIsRatio(e.target.value)}
              />
            </div>
          )}
        </div>
        <Button className="w-full" onClick={() => onRun()} disabled={mutation.isPending}>
          {mutation.isPending ? "실행 중..." : "실행"}
        </Button>
      </div>

      {/* ----- results ----- */}
      {mutation.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : mutation.isError ? (
        <ErrorState error={mutation.error} onRetry={() => onRun()} />
      ) : result ? (
        trades.length === 0 ? (
          <EmptyState
            title="체결된 거래가 없습니다"
            description="조건에 맞는 진입 신호가 없었습니다. 기간을 늘리거나 조건을 완화해 보세요."
          />
        ) : (
          <div className="space-y-3">
            {/* ----- save strategy ----- */}
            <div className="rounded-lg border border-border bg-card p-3">
              {saving ? (
                <div className="space-y-2">
                  <Label htmlFor="bt-save-name" className="text-xs text-muted-foreground">
                    전략 이름
                  </Label>
                  <Input
                    id="bt-save-name"
                    autoFocus
                    placeholder="예) ABC 코인 1d 공격형"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSave();
                      if (e.key === "Escape") setSaving(false);
                    }}
                  />
                  {saveMutation.isError && (
                    <p className="text-xs text-destructive">저장에 실패했습니다. 다시 시도해 주세요.</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={onSave}
                      disabled={!saveName.trim() || saveMutation.isPending}
                    >
                      {saveMutation.isPending ? "저장 중..." : "저장"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSaving(false)}
                      disabled={saveMutation.isPending}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => setSaving(true)}>
                  전략 저장
                </Button>
              )}
            </div>
            {result.walk_forward && <WalkForwardBlock wf={result.walk_forward} />}
            <MetricsGrid metrics={result.metrics} />
            <EquityChart result={result} />
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-medium">거래 내역</p>
                <span className="text-[11px] text-muted-foreground">총 {trades.length}건</span>
              </div>
              <div>
                {trades.slice(0, shown).map((t, i) => (
                  <TradeRow key={`${t.symbol}-${t.exit_at ?? i}-${i}`} trade={t} />
                ))}
              </div>
              {trades.length > shown && (
                <Button variant="outline" className="mt-2 w-full" onClick={() => setShown((s) => s + PAGE)}>
                  더 보기 ({trades.length - shown})
                </Button>
              )}
            </div>
          </div>
        )
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          조건을 설정하고 실행을 눌러 백테스트를 시작하세요.
        </p>
      )}
    </div>
  );
}
