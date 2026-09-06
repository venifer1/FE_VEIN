"use client";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Skeleton } from "@/components/ui/skeleton";

// Redirects unauthenticated users to /login, preserving the deep link in ?next=.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<RequireAuthFallback />}>
      <RequireAuthInner>{children}</RequireAuthInner>
    </Suspense>
  );
}

function RequireAuthFallback() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function RequireAuthInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const authed = isAuthenticated();
    if (!authed) {
      const qs = search.toString();
      const next = encodeURIComponent(pathname + (qs ? `?${qs}` : ""));
      router.replace(`/login?next=${next}`);
    } else {
      setChecked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  if (!checked) {
    return <RequireAuthFallback />;
  }
  return <>{children}</>;
}
