"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComplianceFooter } from "@/components/states";
import { useLogin } from "@/lib/queries";
import { extractError, BASE, USE_MOCK } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { BUILD_VERSION, MOCK_PASSWORD } from "@/lib/mockData";

const schema = z.object({
  email: z.string().min(1, "이메일을 입력하세요.").email("이메일 형식이 올바르지 않습니다."),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});
type FormValues = z.infer<typeof schema>;

const ERROR_MESSAGES: Record<string, string> = {
  AUTH_INVALID: "이메일 또는 비밀번호가 올바르지 않습니다.",
  USER_NOT_APPROVED: "승인 대기 중인 계정입니다. 관리자 승인 후 이용할 수 있습니다.",
  USER_LOCKED: "계정이 잠겼습니다. 관리자에게 문의하세요.",
};

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const login = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const tokens = await login.mutateAsync(values);
      setSession(tokens.access_token, tokens.refresh_token, tokens.user);
      const next = search.get("next");
      router.replace(next ? decodeURIComponent(next) : "/");
    } catch (err) {
      const body = extractError(err);
      setServerError(ERROR_MESSAGES[body.code] ?? body.message ?? "로그인에 실패했습니다.");
    }
  });

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-2">
        <Image src="/vein_logo.svg" alt="VEIN" width={120} height={35} priority />
        <p className="text-sm text-muted-foreground">내부 알파 · 트레이딩 인텔리전스</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} aria-invalid={!!errors.email} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">비밀번호</Label>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} aria-invalid={!!errors.password} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        {serverError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {serverError}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "로그인 중..." : "로그인"}
        </Button>
      </form>

      {USE_MOCK && (
        <p className="mt-4 rounded-md bg-secondary px-3 py-2 text-center text-xs text-muted-foreground">
          목 모드: <span className="font-mono">tester@vein.test</span> / <span className="font-mono">{MOCK_PASSWORD}</span>
        </p>
      )}

      <div className="mt-8 text-center text-xs text-muted-foreground">
        <p>{USE_MOCK ? BUILD_VERSION : "vein-frontend-0.1.0"}</p>
        <p className="mt-0.5 font-mono">{BASE}</p>
      </div>

      <ComplianceFooter />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
