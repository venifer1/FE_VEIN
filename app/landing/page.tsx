"use client";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ComplianceFooter } from "@/components/states";
import { useWeeklyReport, useSignup } from "@/lib/queries";
import { extractError, BASE } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { WeeklyReport } from "@/lib/types";

const schema = z.object({
  email: z.string().min(1, "이메일을 입력하세요.").email("이메일 형식이 올바르지 않습니다."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(100, "비밀번호가 너무 깁니다."),
});
type FormValues = z.infer<typeof schema>;

const ERROR_MESSAGES: Record<string, string> = {
  ALREADY_EXISTS: "이미 가입된 이메일입니다. 로그인해 주세요.",
  RATE_LIMITED: "가입 시도가 많습니다. 잠시 후 다시 시도해 주세요.",
  VALIDATION_ERROR: "입력값을 다시 확인해 주세요.",
};

/** "+1.61" / "-0.42" — signed percent, rounded to 2 dp for display. */
function signed(v: string | undefined): string {
  if (!v) return "0.00";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  const s = Math.abs(n).toFixed(2);
  return n >= 0 ? `+${s}` : `-${s}`;
}

function StatProof({ report }: { report: WeeklyReport }) {
  const { overall, rows, highlights, window_days, horizon } = report;
  if (!overall || overall.sample_size === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        성과 데이터를 모으는 중입니다. 신호가 누적되면 실측 적중률이 여기 표시됩니다.
      </p>
    );
  }
  const topRows = rows.slice(0, 5);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <div className="text-4xl font-bold tabular-nums text-[hsl(var(--success))]">
            {overall.hit_rate}%
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">전체 적중률</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{overall.sample_size.toLocaleString()}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">누적 표본</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{signed(overall.avg_return_pct)}%</div>
          <div className="mt-0.5 text-xs text-muted-foreground">평균 수익률</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        최근 {window_days}일 · 청산기준 {horizon} · 개별 종목이 아닌 패턴 통계
      </p>

      {topRows.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">패턴</th>
                <th className="px-3 py-2 text-left font-medium">시장</th>
                <th className="px-3 py-2 text-left font-medium">봉</th>
                <th className="px-3 py-2 text-right font-medium">표본</th>
                <th className="px-3 py-2 text-right font-medium">적중률</th>
                <th className="px-3 py-2 text-right font-medium">평균</th>
              </tr>
            </thead>
            <tbody>
              {topRows.map((r) => (
                <tr key={`${r.type}-${r.market}-${r.timeframe}`} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{r.type}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.market}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.timeframe}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.sample_size.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.hit_rate}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{signed(r.avg_return_pct)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {highlights.length > 0 && (
        <ul className="space-y-1 text-sm">
          {highlights.map((h) => (
            <li key={h.kind} className="text-muted-foreground">
              {h.kind === "BEST" ? "🔥" : "🧊"} <span className="font-medium text-foreground">{h.label}</span> —{" "}
              {h.type} · {h.market} · {h.timeframe} · 적중률 {h.hit_rate}% (표본 {h.sample_size})
            </li>
          ))}
        </ul>
      )}

      <a
        href={`${BASE}/public/reports/weekly.md?window_days=${window_days}`}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-sm font-medium text-primary underline underline-offset-4"
      >
        전체 리포트 원문 보기 →
      </a>
    </div>
  );
}

function LandingInner() {
  const router = useRouter();
  const search = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const report = useWeeklyReport(90);
  const signup = useSignup();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Attribution: capture where the visitor came from (marketing links / referrer).
  const source = useMemo(() => search.get("utm_source") ?? search.get("ref") ?? undefined, [search]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setPending(false);
    try {
      const referrer = typeof document !== "undefined" && document.referrer ? document.referrer : undefined;
      const res = await signup.mutateAsync({
        email: values.email,
        password: values.password,
        signup_source: source,
        signup_referrer: referrer,
      });
      if (res.access_token && res.refresh_token) {
        setSession(res.access_token, res.refresh_token, res.user);
        router.replace("/");
      } else {
        // 승인제(PENDING): no tokens issued.
        setPending(true);
      }
    } catch (err) {
      const body = extractError(err);
      setServerError(ERROR_MESSAGES[body.code] ?? body.message ?? "가입에 실패했습니다.");
    }
  });

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <Image src="/vein_logo.svg" alt="VEIN" width={140} height={41} priority />
        <h1 className="text-balance text-2xl font-bold leading-snug">
          한국·미국·코인을 한 화면에서,
          <br />
          패턴 후보를 <span className="text-primary">근거와 함께</span>.
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          자리에 없어도 후보를 놓치지 않도록, 시스템이 패턴을 먼저 올려줍니다.
          아래는 우리가 실제로 낸 신호가 얼마나 맞았는지에 대한 <strong>실측 데이터</strong>입니다.
        </p>
      </header>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">실측 패턴 성과</h2>
          {report.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-2/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : report.isError || !report.data ? (
            <p className="text-sm text-muted-foreground">
              지금은 성과 데이터를 불러올 수 없습니다. 가입은 아래에서 계속할 수 있어요.
            </p>
          ) : (
            <StatProof report={report.data} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-1 text-lg font-semibold">무료로 시작하기</h2>
          <p className="mb-4 text-sm text-muted-foreground">이메일만 있으면 바로 시작할 수 있습니다.</p>

          {pending ? (
            <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-3 text-sm" role="status">
              가입이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">이메일</Label>
                <Input id="email" type="email" autoComplete="email" {...register("email")} aria-invalid={!!errors.email} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  {...register("password")}
                  aria-invalid={!!errors.password}
                />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>

              {serverError && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                  {serverError}
                </p>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? "가입 중..." : "무료로 시작하기"}
              </Button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="font-medium text-primary underline underline-offset-4">
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>

      <ComplianceFooter />
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={null}>
      <LandingInner />
    </Suspense>
  );
}
