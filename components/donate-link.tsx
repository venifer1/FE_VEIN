"use client";
import { Coffee } from "lucide-react";

// 후원 링크(MONETIZATION 단계2 ④). URL은 빌드타임 env(NEXT_PUBLIC_DONATE_URL)로 주입 —
// 미설정이면 렌더하지 않아 깨진 링크가 노출되지 않는다. **기능 차등 없음**: 순수 링크일 뿐,
// 후원 여부로 어떤 기능도 잠그거나 열지 않는다(6장).
const DONATE_URL = process.env.NEXT_PUBLIC_DONATE_URL;

export function DonateLink({ variant = "inline" }: { variant?: "inline" | "card" }) {
  if (!DONATE_URL) return null;

  if (variant === "card") {
    return (
      <a
        href={DONATE_URL}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-secondary/40"
      >
        <Coffee className="h-4 w-4" />
        VEIN 후원하기
      </a>
    );
  }

  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-4"
    >
      <Coffee className="h-3.5 w-3.5" />
      후원하기
    </a>
  );
}
