"use client";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { bootstrapAuth } from "@/lib/api";
import { LivePrices } from "@/components/live-prices";
import { WebNotifications } from "@/components/web-notifications";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // Gate rendering until a persisted refresh token is exchanged for an access
  // token, so child queries don't fire a burst of 401s on a fresh page load.
  const [ready, setReady] = useState(false);
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
    bootstrapAuth().finally(() => setReady(true));
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <LivePrices />
      <WebNotifications />
      {ready ? children : null}
    </QueryClientProvider>
  );
}
