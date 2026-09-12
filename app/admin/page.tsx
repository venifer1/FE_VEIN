"use client";

import type { ComponentType } from "react";
import { AlertTriangle, Bell, CheckCircle2, Database, Lock, Radar, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";
import {
  useAdminApproveUser,
  useAdminSetTier,
  useAdminAuditLogs,
  useAdminFailedDeliveries,
  useAdminLockUser,
  useAdminNotifications,
  useAdminOverview,
  useAdminUsers,
} from "@/lib/queries";
import { formatRelative, formatTime } from "@/lib/format";
import { useAuthStore } from "@/store/auth";
import type { AdminAuditLog, AdminDeliveryAttempt, AdminNotification, User, UserStatus } from "@/lib/types";

function fmt(n?: number | null) {
  return n == null ? "-" : new Intl.NumberFormat("ko-KR").format(n);
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "destructive" | "success";
}) {
  const toneClass =
    tone === "destructive" ? "bg-destructive/10 text-destructive"
      : tone === "warning" ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
        : tone === "success" ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
          : "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
          {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function Distribution({ title, rows }: { title: string; rows: Record<string, number> }) {
  const entries = Object.entries(rows ?? {});
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  return (
    <Card>
      <CardContent className="space-y-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">데이터 없음</p>
        ) : (
          entries.map(([key, value]) => {
            const pct = total > 0 ? (value / total) * 100 : 0;
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{key}</span>
                  <span className="tabular-nums text-muted-foreground">{fmt(value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function UserStatusBadge({ status }: { status: UserStatus }) {
  const variant =
    status === "APPROVED" ? "success" : status === "LOCKED" ? "destructive" : "warning";
  return <Badge variant={variant}>{status}</Badge>;
}

function UserRow({ user, currentUserId }: { user: User; currentUserId?: string | number }) {
  const approve = useAdminApproveUser();
  const lock = useAdminLockUser();
  const setTier = useAdminSetTier();
  const isSelf = String(user.id) === String(currentUserId ?? "");
  const isPro = String(user.tier ?? "FREE").toUpperCase() === "PRO";
  const busy = approve.isPending || lock.isPending || setTier.isPending;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.email}</p>
            <p className="text-xs text-muted-foreground">#{user.id} · {user.role}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant={isPro ? "default" : "secondary"}>{isPro ? "PRO" : "FREE"}</Badge>
            <UserStatusBadge status={user.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || user.status === "APPROVED"}
            onClick={() => approve.mutate(user.id)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            승인
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || user.status === "LOCKED" || isSelf}
            onClick={() => {
              if (window.confirm(`${user.email} 계정을 잠글까요? 로그인이 차단됩니다.`)) {
                lock.mutate(user.id);
              }
            }}
          >
            <Lock className="h-3.5 w-3.5" />
            잠금
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setTier.mutate({ id: user.id, tier: isPro ? "FREE" : "PRO" })}
          >
            {isPro ? "FREE로" : "PRO로"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function auditDetail(log: AdminAuditLog) {
  if (!log.detail) return null;
  try {
    const parsed = JSON.parse(log.detail) as Record<string, unknown>;
    return Object.entries(parsed)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" · ");
  } catch {
    return log.detail;
  }
}

function AuditRow({ log }: { log: AdminAuditLog }) {
  const detail = auditDetail(log);
  return (
    <div className="border-b border-border py-2 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{log.action}</span>
        <span className="text-xs text-muted-foreground">{formatRelative(log.created_at)}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {log.target ?? "-"} · actor {log.actor_id ?? "-"} · {log.ip ?? "-"}
      </p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function AdminNotificationRow({ item }: { item: AdminNotification }) {
  return (
    <div className="border-b border-border py-2 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{item.title}</span>
        <Badge variant={item.status === "FAILED" ? "destructive" : item.read_at ? "secondary" : "default"}>{item.status}</Badge>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatRelative(item.created_at)} · user {item.user_id} · signal {item.signal_id ?? "-"} · alert {item.alert_id ?? "-"}
      </p>
      {item.body && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>}
    </div>
  );
}

function DeliveryAttemptRow({ item }: { item: AdminDeliveryAttempt }) {
  return (
    <div className="border-b border-border py-2 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{item.channel}</span>
        <Badge variant="destructive">{item.status}</Badge>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatRelative(item.attempted_at)} · notification {item.notification_id} · attempt {item.attempt_no}
      </p>
      {item.error_code && <p className="mt-1 text-xs text-muted-foreground">{item.error_code}</p>}
    </div>
  );
}

function OperationQueue({
  pendingUsers,
  failedDeliveries,
  unreadNotifications,
  activeScannerMatches,
}: {
  pendingUsers: number;
  failedDeliveries: number;
  unreadNotifications: number;
  activeScannerMatches: number;
}) {
  const rows = [
    { label: "승인 대기 사용자", value: pendingUsers, tone: pendingUsers > 0 ? "warning" : "success" },
    { label: "실패한 전달", value: failedDeliveries, tone: failedDeliveries > 0 ? "destructive" : "success" },
    { label: "읽지 않은 알림", value: unreadNotifications, tone: unreadNotifications > 0 ? "warning" : "success" },
    { label: "활성 조건검색 매칭", value: activeScannerMatches, tone: activeScannerMatches > 0 ? "default" : "success" },
  ] as const;
  return (
    <Card>
      <CardContent className="space-y-2">
        <h2 className="text-sm font-semibold">운영 큐</h2>
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">{row.label}</span>
            <Badge variant={row.tone === "default" ? "secondary" : row.tone}>{fmt(row.value)}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AdminInner() {
  const overview = useAdminOverview();
  const users = useAdminUsers();
  const auditLogs = useAdminAuditLogs();
  const notifications = useAdminNotifications();
  const failedDeliveries = useAdminFailedDeliveries();
  const currentUser = useAuthStore((s) => s.user);
  const data = overview.data;

  const refreshAll = () => {
    void overview.refetch();
    void users.refetch();
    void auditLogs.refetch();
    void notifications.refetch();
    void failedDeliveries.refetch();
  };

  const pendingUsers = data?.users.by_status?.PENDING ?? 0;
  const proUsers = data?.users.by_tier?.PRO ?? 0;
  const failedDeliveryCount = data?.notifications.failed_deliveries ?? failedDeliveries.data?.length ?? 0;
  const activeScannerMatches = data?.scanner_rules.active_matches ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">관리</h1>
          <p className="text-xs text-muted-foreground">
            {data?.generated_at ? `${formatTime(data.generated_at, "yyyy.MM.dd HH:mm:ss")} 기준` : "운영 지표"}
          </p>
        </div>
        <Button
          size="icon"
          variant="outline"
          onClick={refreshAll}
          disabled={overview.isFetching || users.isFetching || auditLogs.isFetching || notifications.isFetching || failedDeliveries.isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${overview.isFetching ? "animate-spin" : ""}`} />
          <span className="sr-only">새로고침</span>
        </Button>
      </div>

      <div className="space-y-4 px-4 pb-4">
        {overview.isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : overview.isError ? (
          <ErrorState error={overview.error} onRetry={() => overview.refetch()} title="관리 지표 호출 실패" />
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatCard title="사용자" value={fmt(data.users.total)} sub={`대기 ${fmt(pendingUsers)} · PRO ${fmt(proUsers)}`} icon={Users} tone={pendingUsers > 0 ? "warning" : "default"} />
              <StatCard
                title="알림 규칙"
                value={fmt(data.alerts.total)}
                sub={`활성 ${fmt(data.alerts.enabled)} · 비활성 ${fmt(data.alerts.disabled)}`}
                icon={Bell}
              />
              <StatCard
                title="읽지 않은 알림"
                value={fmt(data.notifications.unread)}
                sub={`전체 ${fmt(data.notifications.total)} · 실패 ${fmt(failedDeliveryCount)}`}
                icon={AlertTriangle}
                tone={failedDeliveryCount > 0 ? "destructive" : data.notifications.unread > 0 ? "warning" : "success"}
              />
              <StatCard
                title="Web Push"
                value={fmt(data.notifications.active_web_push_subscriptions)}
                sub={`비활성 ${fmt(data.notifications.inactive_web_push_subscriptions)} · 실패 ${fmt(data.notifications.failed_web_push)}`}
                icon={Bell}
                tone={(data.notifications.failed_web_push ?? 0) > 0 ? "warning" : "default"}
              />
              <StatCard
                title="Explain 평가"
                value={data.explain.helpful_rate ? `${data.explain.helpful_rate}%` : "-"}
                sub={`유용 ${fmt(data.explain.helpful)} / ${fmt(data.explain.total)}`}
                icon={CheckCircle2}
                tone="success"
              />
              <StatCard
                title="조건검색식"
                value={fmt(data.scanner_rules.total)}
                sub={`활성 ${fmt(data.scanner_rules.enabled)} · 매칭 ${fmt(activeScannerMatches)} · 24h ${fmt(data.scanner_rules.runs24h)}`}
                icon={Radar}
                tone={activeScannerMatches > 0 ? "default" : "success"}
              />
              <StatCard
                title="종목"
                value={fmt(data.instruments.total)}
                sub={`신호 ${fmt(data.signals.total)}`}
                icon={Database}
              />
            </div>

            <OperationQueue
              pendingUsers={pendingUsers}
              failedDeliveries={failedDeliveryCount}
              unreadNotifications={data.notifications.unread}
              activeScannerMatches={activeScannerMatches}
            />

            <Card>
              <CardContent className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">SUPER_ADMIN 운영</span>
                </div>
                <Badge variant="secondary">30초 자동 갱신</Badge>
              </CardContent>
            </Card>

            <Distribution title="사용자 상태" rows={data.users.by_status} />
            {data.users.by_tier && <Distribution title="구독 티어" rows={data.users.by_tier} />}
            <Distribution title="신호 상태" rows={data.signals.by_status} />
          </>
        ) : null}

        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-sm font-semibold">사용자 관리</h2>
            {users.isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : users.isError ? (
              <ErrorState error={users.error} onRetry={() => users.refetch()} title="사용자 목록 호출 실패" />
            ) : users.data?.length ? (
              <div className="space-y-2">
                {users.data.map((item) => (
                  <UserRow key={String(item.id)} user={item} currentUserId={currentUser?.id} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">사용자가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-2 text-sm font-semibold">최근 감사 로그</h2>
            {auditLogs.isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : auditLogs.isError ? (
              <ErrorState error={auditLogs.error} onRetry={() => auditLogs.refetch()} title="감사 로그 호출 실패" />
            ) : auditLogs.data?.length ? (
              auditLogs.data.map((log) => <AuditRow key={log.id} log={log} />)
            ) : (
              <p className="text-sm text-muted-foreground">감사 로그가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-2 text-sm font-semibold">최근 알림</h2>
            {notifications.isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : notifications.isError ? (
              <ErrorState error={notifications.error} onRetry={() => notifications.refetch()} title="알림 목록 호출 실패" />
            ) : notifications.data?.length ? (
              notifications.data.map((item) => <AdminNotificationRow key={item.id} item={item} />)
            ) : (
              <p className="text-sm text-muted-foreground">알림이 없습니다.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-2 text-sm font-semibold">실패한 전달</h2>
            {failedDeliveries.isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : failedDeliveries.isError ? (
              <ErrorState error={failedDeliveries.error} onRetry={() => failedDeliveries.refetch()} title="전달 실패 목록 호출 실패" />
            ) : failedDeliveries.data?.length ? (
              failedDeliveries.data.map((item) => <DeliveryAttemptRow key={item.id} item={item} />)
            ) : (
              <p className="text-sm text-muted-foreground">실패한 전달이 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth>
      <AdminInner />
    </RequireAuth>
  );
}
