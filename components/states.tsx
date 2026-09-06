"use client";
import { AlertTriangle, Inbox, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractError } from "@/lib/api";
import { formatTime } from "@/lib/format";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground" aria-hidden />
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = "문제가 발생했습니다",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const body = extractError(error);
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body.message}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          코드: <span className="font-mono">{body.code}</span>
          {body.trace_id ? (
            <>
              {" · "}trace: <span className="font-mono">{body.trace_id}</span>
            </>
          ) : null}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> 다시 시도
        </Button>
      )}
    </div>
  );
}

export function StaleNotice({
  updatedAt,
  onRefresh,
}: {
  updatedAt?: string | null;
  onRefresh?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 px-3 py-2 text-sm">
      <span className="flex items-center gap-1.5 text-[hsl(var(--warning))]">
        <Clock className="h-4 w-4" aria-hidden />
        데이터 지연 · 마지막 갱신 {formatTime(updatedAt)}
      </span>
      {onRefresh && (
        <button onClick={onRefresh} className="text-xs underline">
          새로고침
        </button>
      )}
    </div>
  );
}

export function PartialErrorNotice({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <span>일부 데이터를 불러오지 못했습니다</span>
      {onRetry && (
        <button onClick={onRetry} className="text-xs underline">
          영역 다시 시도
        </button>
      )}
    </div>
  );
}

export function ComplianceFooter() {
  return (
    <p className="px-4 py-3 text-center text-xs text-muted-foreground">
      투자 참고용 · 투자권유 아님
    </p>
  );
}
