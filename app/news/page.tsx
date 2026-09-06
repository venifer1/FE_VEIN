"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CoinChips, SentimentBadge } from "@/components/badges";
import { RequireAuth } from "@/components/require-auth";
import { ComplianceFooter, EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative } from "@/lib/format";
import { useNews } from "@/lib/queries";
import { newsSourceLabel, type NewsSource } from "@/lib/types";
import { cn } from "@/lib/utils";

const SOURCES: { value: NewsSource | undefined; label: string }[] = [
  { value: undefined, label: "전체" },
  { value: "TELEGRAM", label: "코인니스" },
  { value: "BLOOMBERG", label: "Bloomberg" },
];

function NewsInner() {
  const [source, setSource] = useState<NewsSource | undefined>(undefined);
  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useNews(source);
  const items = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div>
      <div className="px-4 py-3">
        <h1 className="text-lg font-semibold">뉴스</h1>
      </div>
      <div className="flex gap-2 px-4">
        {SOURCES.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setSource(item.value)}
            className={cn(
              "flex-1 rounded-full border px-3 py-1 text-sm transition-colors",
              source === item.value ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 p-4">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="뉴스가 없습니다" />
        ) : (
          <>
            {items.map((item) => (
              <Card key={item.id} className="transition-colors hover:bg-accent/40">
                <CardContent className="space-y-1">
                  <Link href={`/news/${item.id}`} className="block space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.source === "TELEGRAM" ? "default" : "secondary"}>
                        {newsSourceLabel(item.source)}
                      </Badge>
                      <SentimentBadge sentiment={item.sentiment} />
                      {item.is_new && <Badge variant="success">NEW</Badge>}
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {formatRelative(item.published_at)}
                      </span>
                    </div>
                    <p className="flex items-start gap-1 font-medium">
                      <span className="min-w-0 flex-1 line-clamp-2">{item.title || item.body || "(제목 없음)"}</span>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </p>
                    {item.title && item.body && <p className="line-clamp-2 text-sm text-muted-foreground">{item.body}</p>}
                  </Link>
                  <CoinChips symbols={item.tagged_symbols} instruments={item.tagged_instruments} />
                </CardContent>
              </Card>
            ))}
            {hasNextPage && (
              <Button variant="outline" className="w-full" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? "불러오는 중..." : "더 보기"}
              </Button>
            )}
          </>
        )}
      </div>
      <ComplianceFooter />
    </div>
  );
}

export default function NewsPage() {
  return (
    <RequireAuth>
      <NewsInner />
    </RequireAuth>
  );
}
