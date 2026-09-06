"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { ComplianceFooter, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useThemeConstituents } from "@/lib/queries";
import { cn } from "@/lib/utils";

function ConfidenceBadge({ value }: { value: string }) {
  const score = Number(value);
  const safeScore = Number.isFinite(score) ? score : 0;
  const low = safeScore < 0.6;

  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
        low ? "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]" : "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
      )}
    >
      신뢰 {(safeScore * 100).toFixed(0)}%
    </span>
  );
}

function ThemeDetailInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useThemeConstituents(params.id);

  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="뒤로">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold">{data?.name ?? "테마 구성종목"}</h1>
      </div>
      <div className="space-y-2 px-4 pb-4">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !data || (data.items?.length ?? 0) === 0 ? (
          <EmptyState title="구성종목이 없습니다" description="미분류 테마이거나 아직 데이터가 없습니다." />
        ) : (
          data.items.map((item, index) => (
            <Card key={`${item.instrument_ref}-${index}`}>
              <CardContent className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{item.instrument_ref}</span>
                    {item.display_name && item.display_name !== item.instrument_ref && (
                      <span className="truncate text-xs text-muted-foreground">{item.display_name}</span>
                    )}
                  </div>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>출처 {item.classification_source}</span>
                    <ConfidenceBadge value={item.classification_confidence} />
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <ComplianceFooter />
    </div>
  );
}

export default function ThemeDetailPage() {
  return (
    <RequireAuth>
      <ThemeDetailInner />
    </RequireAuth>
  );
}
