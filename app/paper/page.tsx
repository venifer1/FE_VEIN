"use client";
import { useMemo, useState } from "react";
import { RefreshCw, WalletCards } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ErrorState, ComplianceFooter } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreatePaperAccount,
  useCreatePaperOrder,
  useInstruments,
  usePaperPerformance,
  usePaperPortfolio,
} from "@/lib/queries";
import { formatPct, formatPrice, pctSign } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Instrument, PaperOrder, PaperPosition } from "@/lib/types";

type PaperTab = "trade" | "positions" | "orders";

function decimalString(value: number) {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(8).replace(/\.?0+$/, "");
}

// 큰 금액을 사람이 읽는 한글 단위로(예: 10000000 → "1,000만원", 150000000 → "1억 5,000만원").
function koreanMoney(n: number): string {
  if (!Number.isFinite(n) || n < 10000) return "";
  const eok = Math.floor(n / 1e8);
  const man = Math.floor((n % 1e8) / 1e4);
  const parts: string[] = [];
  if (eok) parts.push(`${eok.toLocaleString("ko-KR")}억`);
  if (man) parts.push(`${man.toLocaleString("ko-KR")}만`);
  return parts.length ? parts.join(" ") + "원" : "";
}

function ratioPct(numerator?: string | null, denominator?: string | null) {
  const top = Number(numerator ?? 0);
  const bottom = Number(denominator ?? 0);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= 0) return "0";
  return decimalString((top / bottom) * 100);
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-card p-3">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-lg font-semibold tabular-nums",
          tone && tone > 0 ? "text-emerald-600" : tone && tone < 0 ? "text-destructive" : "",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SectionTabs({ value, onChange }: { value: PaperTab; onChange: (value: PaperTab) => void }) {
  const tabs: Array<{ value: PaperTab; label: string }> = [
    { value: "trade", label: "주문" },
    { value: "positions", label: "포지션" },
    { value: "orders", label: "내역" },
  ];

  return (
    <div className="grid grid-cols-3 rounded-md border border-border p-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "h-9 rounded text-sm font-medium",
            value === tab.value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function AccountSetup() {
  const createAccount = useCreatePaperAccount();
  const [balanceDigits, setBalanceDigits] = useState("10000000");
  const amount = Number(balanceDigits || "0");
  const display = balanceDigits ? amount.toLocaleString("ko-KR") : "";
  const hint = koreanMoney(amount);

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">모의 계정 시작</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            실제 거래소 주문 없이 가상 현금과 포지션만 기록합니다.
          </p>
        </div>
        <div>
          <div className="relative">
            <Input
              inputMode="numeric"
              value={display}
              onChange={(e) => setBalanceDigits(e.target.value.replace(/[^\d]/g, "").slice(0, 15))}
              className="pr-9 tabular-nums"
              aria-label="초기 잔액(원)"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">원</span>
          </div>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <Button
          className="w-full"
          onClick={() => createAccount.mutate({ initial_balance: balanceDigits || "0", base_currency: "KRW" })}
          disabled={createAccount.isPending || amount <= 0}
        >
          <WalletCards className="h-4 w-4" />
          {createAccount.isPending ? "생성 중" : "계정 생성"}
        </Button>
      </CardContent>
    </Card>
  );
}

function OrderForm({ positions }: { positions: PaperPosition[] }) {
  const [query, setQuery] = useState("BTC");
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [investmentType, setInvestmentType] = useState<"SPOT" | "FUTURES">("SPOT");
  const [positionSide, setPositionSide] = useState<"LONG" | "SHORT">("LONG");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("0.01");
  const [leverage, setLeverage] = useState("3");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [price, setPrice] = useState("");
  const instruments = useInstruments(query, undefined);
  const createOrder = useCreatePaperOrder();
  const candidates = instruments.data ?? [];
  const target = selected ?? candidates[0] ?? null;
  const matchingPosition = positions.find(
    (p) =>
      String(p.instrument_id) === String(target?.id) &&
      p.investment_type === investmentType &&
      p.position_side === positionSide,
  );
  const isClosing = investmentType === "FUTURES" && reduceOnly;
  const submitTone = isClosing || (investmentType === "SPOT" && side === "SELL") ? "destructive" : "default";

  function useClosePercent(pct: number) {
    const openQty = Number(matchingPosition?.quantity ?? 0);
    if (!Number.isFinite(openQty) || openQty <= 0) return;
    setQuantity(decimalString(openQty * pct));
    setReduceOnly(true);
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">가상 주문</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">현물과 선물 모의 포지션을 즉시 체결가로 기록합니다.</p>
          </div>
          <div className="flex shrink-0 rounded-md border border-border p-0.5">
            {(["SPOT", "FUTURES"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setInvestmentType(value)}
                className={cn(
                  "h-8 px-3 text-xs",
                  investmentType === value ? "rounded bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {value === "SPOT" ? "현물" : "선물"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex rounded-md border border-border p-0.5">
            {(["BUY", "SELL"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setSide(value)}
                className={cn(
                  "h-8 flex-1 px-3 text-xs",
                  side === value ? "rounded bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
          {investmentType === "FUTURES" ? (
            <div className="flex rounded-md border border-border p-0.5">
              {(["LONG", "SHORT"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setPositionSide(value)}
                  className={cn(
                    "h-8 flex-1 px-3 text-xs",
                    positionSide === value ? "rounded bg-secondary text-secondary-foreground" : "text-muted-foreground",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-9 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">
              현물 포지션
            </div>
          )}
        </div>

        <Input
          placeholder="종목 검색"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
        />
        {candidates.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {candidates.slice(0, 6).map((inst) => (
              <button
                key={String(inst.id)}
                onClick={() => setSelected(inst)}
                className={cn(
                  "min-w-28 shrink-0 rounded-md border px-3 py-2 text-left text-xs",
                  String(target?.id) === String(inst.id) ? "border-primary bg-primary/10" : "border-border",
                )}
              >
                <span className="block truncate font-medium">{inst.symbol}</span>
                <span className="block truncate text-muted-foreground">{inst.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Input inputMode="decimal" placeholder="수량" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <Input inputMode="decimal" placeholder="가격 비우면 최신가" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>

        {investmentType === "FUTURES" && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input inputMode="decimal" placeholder="레버리지" value={leverage} onChange={(e) => setLeverage(e.target.value)} />
              <label className="flex h-11 items-center gap-2 rounded-md border border-border px-3 text-sm">
                <input type="checkbox" checked={reduceOnly} onChange={(e) => setReduceOnly(e.target.checked)} />
                청산/감소
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0.25, 0.5, 1].map((pct) => (
                <Button
                  key={pct}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => useClosePercent(pct)}
                  disabled={!matchingPosition}
                >
                  {pct === 1 ? "100%" : `${pct * 100}%`}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {matchingPosition
                ? `보유 ${matchingPosition.position_side} ${matchingPosition.quantity}`
                : "선택한 방향의 보유 선물 포지션이 없습니다."}
            </p>
          </div>
        )}

        <Button
          className="w-full"
          variant={submitTone}
          disabled={!target || createOrder.isPending}
          onClick={() => target && createOrder.mutate({
            instrument_id: target.id,
            side,
            type: "MARKET",
            quantity,
            price,
            investment_type: investmentType,
            position_side: investmentType === "FUTURES" ? positionSide : undefined,
            leverage: investmentType === "FUTURES" ? leverage : undefined,
            reduce_only: investmentType === "FUTURES" ? reduceOnly : undefined,
          })}
        >
          {createOrder.isPending
            ? "주문 중"
            : `${target?.symbol ?? "종목"} ${investmentType === "FUTURES" ? `${positionSide}${reduceOnly ? " 청산" : ""}` : side}`}
        </Button>
        {createOrder.isError && <p className="text-xs text-destructive">주문을 처리하지 못했습니다.</p>}
      </CardContent>
    </Card>
  );
}

function PositionList({ positions }: { positions: PaperPosition[] }) {
  if (positions.length === 0) {
    return <EmptyState title="보유 포지션이 없습니다" />;
  }

  return (
    <section className="space-y-2">
      {positions.map((p) => {
        const roe = ratioPct(p.unrealized_pnl, p.margin);
        const roeSign = pctSign(roe);
        return (
          <Card key={`${p.instrument_id}-${p.investment_type}-${p.position_side ?? "SPOT"}`}>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.symbol}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.investment_type === "FUTURES" ? `선물 ${p.position_side} ${p.leverage}x` : "현물"} · {p.name}
                  </p>
                </div>
                <div className="text-right text-sm tabular-nums">
                  <p>{p.quantity}</p>
                  <p className={cn(pctSign(p.unrealized_pnl) > 0 ? "text-emerald-600" : pctSign(p.unrealized_pnl) < 0 ? "text-destructive" : "")}>
                    {formatPrice(p.unrealized_pnl)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">진입가</p>
                  <p className="mt-0.5 font-medium tabular-nums">{formatPrice(p.avg_price)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">마크가</p>
                  <p className="mt-0.5 font-medium tabular-nums">{formatPrice(p.mark_price)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">증거금</p>
                  <p className="mt-0.5 font-medium tabular-nums">{formatPrice(p.margin)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">ROE</p>
                  <p className={cn("mt-0.5 font-medium tabular-nums", roeSign > 0 ? "text-emerald-600" : roeSign < 0 ? "text-destructive" : "")}>
                    {formatPct(roe)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

function OrderList({ orders }: { orders: PaperOrder[] }) {
  if (orders.length === 0) {
    return <EmptyState title="주문 내역이 없습니다" />;
  }

  return (
    <section className="space-y-2">
      {orders.slice(0, 12).map((o) => (
        <div key={o.id} className="rounded-md border border-border px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate font-medium">
              {o.investment_type === "FUTURES" ? `${o.position_side}${o.reduce_only ? " 청산" : ""}` : o.side} #{o.instrument_id}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{o.status}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{o.investment_type}</span>
            <span className="tabular-nums">
              {o.quantity} @ {formatPrice(o.price)}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}

function PaperInner() {
  const [tab, setTab] = useState<PaperTab>("trade");
  const portfolio = usePaperPortfolio();
  const performance = usePaperPerformance();
  const data = portfolio.data;
  const perf = performance.data;
  const positions = useMemo(() => data?.positions ?? [], [data?.positions]);
  const orders = data?.recent_orders ?? [];
  const isMissing = portfolio.isError && !data;

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">모의투자</h1>
          <p className="text-xs text-muted-foreground">현물과 선물 포지션을 실제 주문 없이 검증합니다.</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            portfolio.refetch();
            performance.refetch();
          }}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-3 p-4">
        {portfolio.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : isMissing ? (
          <AccountSetup />
        ) : portfolio.isError ? (
          <ErrorState error={portfolio.error} onRetry={() => portfolio.refetch()} />
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="평가금액" value={formatPrice(data.equity)} />
              <Metric label="수익률" value={formatPct(perf?.total_return_pct ?? "0")} tone={pctSign(perf?.total_return_pct)} />
              <Metric label="현금" value={formatPrice(data.account.cash_balance)} />
              <Metric label="미실현손익" value={formatPrice(data.unrealized_pnl)} tone={pctSign(data.unrealized_pnl)} />
            </div>
            <SectionTabs value={tab} onChange={setTab} />
            {tab === "trade" && <OrderForm positions={positions} />}
            {tab === "positions" && <PositionList positions={positions} />}
            {tab === "orders" && <OrderList orders={orders} />}
          </>
        ) : null}
      </div>
      <ComplianceFooter />
    </div>
  );
}

export default function PaperPage() {
  return (
    <RequireAuth>
      <PaperInner />
    </RequireAuth>
  );
}
