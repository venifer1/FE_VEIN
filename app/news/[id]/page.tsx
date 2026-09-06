"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { CoinChips, SentimentBadge } from "@/components/badges";
import { RequireAuth } from "@/components/require-auth";
import { ComplianceFooter, EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative } from "@/lib/format";
import { useNewsItem } from "@/lib/queries";
import { newsSourceLabel } from "@/lib/types";

function NewsDetailInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useNewsItem(params.id);

  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="뒤로">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold">뉴스 상세</h1>
      </div>

      <div className="space-y-4 px-4 pb-4">
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !data ? (
          <EmptyState title="뉴스를 찾을 수 없습니다" />
        ) : (
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={data.source === "TELEGRAM" ? "default" : "secondary"}>
                  {newsSourceLabel(data.source)}
                </Badge>
                <SentimentBadge sentiment={data.sentiment} />
                {data.is_new && <Badge variant="success">NEW</Badge>}
                <span className="ml-auto text-[11px] text-muted-foreground">{formatRelative(data.published_at)}</span>
              </div>

              {data.title && <h2 className="text-lg font-semibold leading-snug">{data.title}</h2>}
              {data.body && <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{data.body}</p>}
              {!data.title && !data.body && <p className="text-sm text-muted-foreground">(내용 없음)</p>}

              <CoinChips symbols={data.tagged_symbols} instruments={data.tagged_instruments} />

              {data.url && (
                <a
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", className: "mt-1 w-full gap-1.5" })}
                >
                  원문 보기
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <ComplianceFooter />
    </div>
  );
}

export default function NewsDetailPage() {
  return (
    <RequireAuth>
      <NewsDetailInner />
    </RequireAuth>
  );
}
