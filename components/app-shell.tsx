"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Radar, Newspaper, Database, Settings, ShieldCheck, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadCount } from "@/lib/queries";
import { useAuthStore } from "@/store/auth";

/**
 * True only after the first client render. Auth state is derived from
 * localStorage (Zustand persist), which is empty during SSR — gating
 * auth-dependent chrome on this avoids a server/client hydration mismatch.
 */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

const TABS = [
  { href: "/", label: "홈", icon: Home, match: (p: string) => p === "/" || p.startsWith("/instruments") },
  { href: "/scanner", label: "스캐너", icon: Radar, match: (p: string) => p.startsWith("/scanner") || p.startsWith("/signals") || p.startsWith("/scalp") },
  { href: "/paper", label: "모의", icon: WalletCards, match: (p: string) => p.startsWith("/paper") },
  { href: "/news", label: "속보", icon: Newspaper, match: (p: string) => p.startsWith("/news") },
  { href: "/data", label: "데이터", icon: Database, match: (p: string) => p.startsWith("/data") || p.startsWith("/themes") || p.startsWith("/tvl") },
  { href: "/settings", label: "설정", icon: Settings, match: (p: string) => p.startsWith("/settings") },
  { href: "/admin", label: "관리", icon: ShieldCheck, match: (p: string) => p.startsWith("/admin") },
];

function BottomTabs() {
  const pathname = usePathname();
  const mounted = useMounted();
  const authed = useAuthStore((s) => s.isAuthenticated)();
  const { data: unread } = useUnreadCount();

  if (!mounted || !authed) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-stretch border-t border-border bg-card"
      aria-label="주요 탭"
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        const showBadge = tab.href === "/settings" && (unread ?? 0) > 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span>{tab.label}</span>
            {showBadge && (
              <span className="absolute right-1/2 top-1 translate-x-3 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                {unread! > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const authed = useAuthStore((s) => s.isAuthenticated)();
  const pathname = usePathname();
  const showChrome = mounted && authed && pathname !== "/login";

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      {showChrome && (
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
          <Image src="/vein_logo.svg" alt="VEIN" width={66} height={19} priority />
          <span className="sr-only">VEIN</span>
        </header>
      )}
      <main className={cn("flex-1", showChrome && "pb-20")}>{children}</main>
      <BottomTabs />
    </div>
  );
}
