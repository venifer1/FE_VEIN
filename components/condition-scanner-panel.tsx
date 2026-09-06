"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Copy, Plus, Radar, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/states";
import {
  useDeleteScannerRule,
  useRunConditionScan,
  useSaveScannerRule,
  useScannerRules,
  useSimulateScannerRule,
  useUpdateScannerRule,
} from "@/lib/queries";
import { formatPrice, formatRelative } from "@/lib/format";
import {
  timeframesForMarket,
  type ConditionScanRequest,
  type Market,
  type ScannerCondition,
  type ScannerRule,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const INDICATORS = [
  ["RSI", "RSI(14)"],
  ["VOLUME_RATIO", "거래량/20평균"],
  ["PRICE", "현재가"],
  ["MA5", "MA5"],
  ["MACD_HISTOGRAM", "MACD Histogram"],
] as const;
const OPERATORS = ["<", "<=", ">", ">="] as const;
const MARKETS: Market[] = ["CRYPTO", "US", "KOSPI", "KOSDAQ"];
const MARKET_LABEL: Record<Market, string> = {
  CRYPTO: "코인",
  US: "미국",
  KOSPI: "코스피",
  KOSDAQ: "코스닥",
};
const FREQUENCY_LABEL = {
  LOW: { label: "낮음", variant: "secondary" as const },
  MEDIUM: { label: "보통", variant: "warning" as const },
  HIGH: { label: "높음", variant: "destructive" as const },
};

const TEMPLATES: Array<{
  name: string;
  description: string;
  logic: "AND" | "OR";
  conditions: ScannerCondition[];
}> = [
  {
    name: "거래량 급증",
    description: "평균 대비 거래량이 커진 종목",
    logic: "AND",
    conditions: [{ indicator: "VOLUME_RATIO", operator: ">", value: "2" }],
  },
  {
    name: "RSI 반등 후보",
    description: "과매도 구간에서 거래량이 붙는 종목",
    logic: "AND",
    conditions: [
      { indicator: "RSI", operator: "<", value: "35" },
      { indicator: "VOLUME_RATIO", operator: ">", value: "1.3" },
    ],
  },
  {
    name: "MA20 돌파",
    description: "현재가가 MA20 위로 올라온 종목",
    logic: "AND",
    conditions: [
      { indicator: "PRICE", operator: ">", target: "MA20", value: null },
      { indicator: "VOLUME_RATIO", operator: ">", value: "1.2" },
    ],
  },
  {
    name: "MACD 전환",
    description: "MACD Histogram이 0 위로 돌아선 종목",
    logic: "AND",
    conditions: [{ indicator: "MACD_HISTOGRAM", operator: ">", value: "0" }],
  },
];

function defaultCondition(): ScannerCondition {
  return { indicator: "RSI", operator: "<", value: "30" };
}

function conditionSummary(condition: ScannerCondition) {
  const label = INDICATORS.find(([value]) => value === condition.indicator)?.[1] ?? condition.indicator;
  return `${label} ${condition.operator} ${condition.target ?? condition.value ?? "-"}`;
}

function requestQuality(conditions: ScannerCondition[], matchRate?: string | null) {
  const rate = Number(matchRate ?? NaN);
  if (conditions.length === 0) return { text: "조건이 필요합니다", tone: "destructive" as const };
  if (Number.isFinite(rate)) {
    if (rate === 0) return { text: "무매칭: 조건을 완화해 보세요", tone: "warning" as const };
    if (rate > 20) return { text: "과다매칭: 조건을 좁혀 보세요", tone: "warning" as const };
    return { text: "매칭 범위 양호", tone: "success" as const };
  }
  if (conditions.length === 1) return { text: "넓은 조건일 수 있습니다", tone: "warning" as const };
  if (conditions.length > 5) return { text: "너무 좁은 조건일 수 있습니다", tone: "warning" as const };
  return { text: "조건 구성 양호", tone: "success" as const };
}

export function ConditionScannerPanel() {
  const [market, setMarket] = useState<Market>("CRYPTO");
  const [timeframe, setTimeframe] = useState("1d");
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [conditions, setConditions] = useState<ScannerCondition[]>([
    defaultCondition(),
    { indicator: "VOLUME_RATIO", operator: ">", value: "1.5" },
  ]);
  const [ruleName, setRuleName] = useState("");
  const run = useRunConditionScan();
  const rules = useScannerRules();
  const save = useSaveScannerRule();
  const remove = useDeleteScannerRule();
  const update = useUpdateScannerRule();
  const simulate = useSimulateScannerRule();

  const request: ConditionScanRequest = {
    market,
    timeframe: timeframe as ConditionScanRequest["timeframe"],
    logic,
    conditions,
  };

  const lastRate = run.data
    ? String(((run.data.matched_count / Math.max(run.data.evaluated_count, 1)) * 100).toFixed(2))
    : undefined;
  const quality = requestQuality(conditions, lastRate);
  const sortedRules = useMemo(
    () => [...(rules.data ?? [])].sort((a, b) => Number(b.enabled) - Number(a.enabled) || b.id - a.id),
    [rules.data],
  );

  const updateCondition = (index: number, patch: Partial<ScannerCondition>) => {
    setConditions((current) => current.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, ...patch };
      if (patch.indicator === "PRICE" || patch.indicator === "MA5") {
        next.target = "MA20";
        next.value = null;
      } else if (patch.indicator) {
        next.target = null;
        next.value = patch.indicator === "RSI" ? "30"
          : patch.indicator === "VOLUME_RATIO" ? "1.5" : "0";
      }
      return next;
    }));
  };

  const loadRule = (rule: ScannerRule) => {
    setMarket(rule.market);
    setTimeframe(rule.timeframe);
    setLogic(rule.logic);
    setConditions(rule.conditions);
    setRuleName(rule.name);
  };

  const applyTemplate = (template: (typeof TEMPLATES)[number]) => {
    setLogic(template.logic);
    setConditions(template.conditions);
    setRuleName(template.name);
  };

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">조건검색</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                시장별 캔들 지표를 조합해 즉시 검색하고 저장식 알림으로 이어갑니다.
              </p>
            </div>
            <Badge variant={quality.tone}>{quality.text}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((template) => (
              <button
                key={template.name}
                onClick={() => applyTemplate(template)}
                className="rounded-md border border-border p-3 text-left transition-colors hover:bg-accent/40"
              >
                <p className="text-sm font-medium">{template.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="시장">
              <select
                className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={market}
                onChange={(event) => {
                  const next = event.target.value as Market;
                  setMarket(next);
                  setTimeframe(timeframesForMarket(next).filter((tf) => tf !== "1M")[0] ?? "1d");
                }}
              >
                {MARKETS.map((item) => <option key={item} value={item}>{MARKET_LABEL[item]}</option>)}
              </select>
            </Field>
            <Field label="봉">
              <select
                className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={timeframe}
                onChange={(event) => setTimeframe(event.target.value)}
              >
                {timeframesForMarket(market).filter((tf) => tf !== "1M")
                  .map((tf) => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </Field>
            <Field label="논리">
              <select
                className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={logic}
                onChange={(event) => setLogic(event.target.value as "AND" | "OR")}
              >
                <option value="AND">모두 충족</option>
                <option value="OR">하나 이상</option>
              </select>
            </Field>
          </div>

          <div className="space-y-2">
            {conditions.map((condition, index) => (
              <div key={index} className="grid grid-cols-[1fr_64px_84px_36px] gap-2">
                <select
                  className="h-10 rounded-md border border-border bg-background px-2 text-xs"
                  value={condition.indicator}
                  onChange={(event) => updateCondition(index, {
                    indicator: event.target.value as ScannerCondition["indicator"],
                  })}
                >
                  {INDICATORS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select
                  className="h-10 rounded-md border border-border bg-background px-2 text-sm"
                  value={condition.operator}
                  onChange={(event) => updateCondition(index, {
                    operator: event.target.value as ScannerCondition["operator"],
                  })}
                >
                  {OPERATORS.map((operator) => <option key={operator}>{operator}</option>)}
                </select>
                {condition.target ? (
                  <div className="flex h-10 items-center justify-center rounded-md border border-border bg-secondary text-xs">
                    {condition.target}
                  </div>
                ) : (
                  <Input
                    value={condition.value ?? ""}
                    inputMode="decimal"
                    onChange={(event) => updateCondition(index, { value: event.target.value })}
                  />
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={conditions.length === 1}
                  onClick={() => setConditions((current) => current.filter((_, i) => i !== index))}
                  aria-label="조건 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              disabled={conditions.length >= 8}
              onClick={() => setConditions((current) => [...current, defaultCondition()])}
            >
              <Plus className="h-4 w-4" /> 조건 추가
            </Button>
          </div>

          <div className="rounded-md bg-secondary p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">현재 조건</p>
            <p className="mt-1">{conditions.map(conditionSummary).join(` ${logic} `)}</p>
          </div>

          <Button className="w-full" disabled={run.isPending} onClick={() => run.mutate(request)}>
            <Radar className="h-4 w-4" />
            {run.isPending ? "시장 종목 평가 중" : "조건검색 실행"}
          </Button>
          <div className="flex gap-2">
            <Input
              placeholder="저장식 이름"
              value={ruleName}
              onChange={(event) => setRuleName(event.target.value)}
            />
            <Button
              variant="secondary"
              disabled={!ruleName.trim() || save.isPending}
              onClick={() => save.mutate({ ...request, name: ruleName.trim() })}
            >
              저장
            </Button>
          </div>
        </CardContent>
      </Card>

      {run.isError && <ErrorState error={run.error} onRetry={() => run.mutate(request)} />}
      {run.data && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">검색 결과</h2>
              <span className="text-xs text-muted-foreground">
                {run.data.evaluated_count}종 평가 · {run.data.matched_count}종 충족 · {lastRate}%
              </span>
            </div>
            {run.data.items.length === 0 ? (
              <EmptyState title="조건을 충족한 종목이 없습니다" description="조건을 완화하거나 다른 템플릿으로 시작해 보세요." />
            ) : (
              <div className="space-y-2">
                {run.data.items.map((item) => (
                  <Link key={item.instrument_id} href={`/instruments/${item.instrument_id}`} className="block">
                    <div className="rounded-md border border-border p-3 hover:bg-accent/30">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{item.name || item.symbol}</p>
                          <p className="text-xs text-muted-foreground">{item.symbol}</p>
                        </div>
                        <p className="font-mono text-sm">{formatPrice(item.price)}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span>RSI {Number(item.rsi14).toFixed(1)}</span>
                        <span>거래량 {item.volume_ratio ? `${Number(item.volume_ratio).toFixed(2)}배` : "-"}</span>
                        <span>MACD {Number(item.macd_histogram).toFixed(2)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.matched_conditions.map((condition) => (
                          <Badge key={condition} variant="secondary">{condition}</Badge>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">저장된 검색식</h2>
            <Badge variant="secondary">{sortedRules.length}</Badge>
          </div>
          {rules.isError ? (
            <ErrorState error={rules.error} onRetry={() => rules.refetch()} />
          ) : sortedRules.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">저장된 검색식이 없습니다.</p>
          ) : (
            sortedRules.map((rule) => (
              <SavedRuleRow
                key={rule.id}
                rule={rule}
                onLoad={() => loadRule(rule)}
                onClone={() => {
                  loadRule(rule);
                  setRuleName(`${rule.name} 복사`);
                }}
                onToggle={() => update.mutate({ id: rule.id, enabled: !rule.enabled })}
                onDelete={() => remove.mutate(rule.id)}
                onSimulate={() => simulate.mutate(rule.id)}
                busy={update.isPending || remove.isPending || simulate.isPending}
              />
            ))
          )}
          {simulate.data && (
            <div className="rounded-md bg-secondary p-3 text-xs">
              <p className="font-medium">
                현재 충족률 {simulate.data.match_rate}% · {FREQUENCY_LABEL[simulate.data.frequency_grade].label}
              </p>
              <p className="mt-1 text-muted-foreground">
                {simulate.data.evaluated_count}종 중 {simulate.data.matched_count}종 충족
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SavedRuleRow({
  rule,
  onLoad,
  onClone,
  onToggle,
  onDelete,
  onSimulate,
  busy,
}: {
  rule: ScannerRule;
  onLoad: () => void;
  onClone: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onSimulate: () => void;
  busy: boolean;
}) {
  const latest = rule.latest_run;
  const freq = latest ? FREQUENCY_LABEL[latest.frequency_grade] : null;
  const quality = requestQuality(rule.conditions, latest?.match_rate);

  return (
    <div className="rounded-md border border-border p-3">
      <button className="w-full text-left" onClick={onLoad}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{rule.name}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {MARKET_LABEL[rule.market]} · {rule.timeframe} · {rule.logic} · {rule.conditions.length}개 조건
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Badge variant={rule.enabled ? "success" : "secondary"}>{rule.enabled ? "알림 ON" : "OFF"}</Badge>
            <Badge variant={quality.tone}>{quality.text}</Badge>
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
          {rule.conditions.map(conditionSummary).join(` ${rule.logic} `)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {latest ? (
            <>
              <Badge variant="outline">최근 {formatRelative(latest.created_at)}</Badge>
              <Badge variant="outline">충족 {latest.match_rate}%</Badge>
              <Badge variant={freq?.variant ?? "secondary"}>빈도 {freq?.label}</Badge>
              <Badge variant="outline">알림 {latest.notification_count}</Badge>
            </>
          ) : (
            <Badge variant="secondary">예약 실행 전</Badge>
          )}
        </div>
      </button>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <Button size="sm" variant={rule.enabled ? "secondary" : "outline"} disabled={busy} onClick={onToggle}>
          {rule.enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onClone}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onSimulate}>
          빈도
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
