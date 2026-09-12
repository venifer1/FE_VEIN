"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, Database, LogOut, ShieldCheck } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { FreshnessBadge, TypeBadge } from "@/components/badges";
import { EmptyState, ErrorState } from "@/components/states";
import { DonateLink } from "@/components/donate-link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useSystemStatus,
  useLogout,
  useAlerts,
  useUpdateAlert,
  useNotifications,
  useMarkRead,
  useWebPushConfig,
  useSaveWebPushSubscription,
  useDeleteWebPushSubscription,
  useNotificationPrefs,
  useUpdateNotificationPrefs,
  useNotificationDigest,
  useEntitlements,
} from "@/lib/queries";
import { useAuthStore } from "@/store/auth";
import { formatRelative, formatTime } from "@/lib/format";
import { BASE, USE_MOCK } from "@/lib/api";
import { signalPathId } from "@/lib/types";
import {
  isWebNotificationsEnabled,
  notificationIds,
  registerServiceWorker,
  setWebNotificationsEnabled,
  subscriptionMatchesKey,
  urlBase64ToUint8Array,
  writeSeenNotificationIds,
} from "@/lib/web-notifications";
import type { Alert, Notification, NotificationStatus } from "@/lib/types";

type NotificationFilter = "ALL" | "UNREAD" | NotificationStatus;

const NOTIF_LABEL: Record<string, { text: string; variant: "default" | "secondary" | "warning" | "destructive" }> = {
  CREATED: { text: "생성", variant: "default" },
  SENT: { text: "전송", variant: "default" },
  READ: { text: "읽음", variant: "secondary" },
  EXPIRED: { text: "만료", variant: "warning" },
  FAILED: { text: "실패", variant: "destructive" },
};

// 데이터 출처 배지(R40). 실데이터(직접 API) vs 합성 스텁(사이드카 다운 폴백)을 명시해
// 가짜 데이터를 진짜로 착각하는 것을 막는다.
function SourceBadge({ source }: { source?: string | null }) {
  if (!source) return null;
  if (source === "STUB") {
    return (
      <span className="rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
        합성
      </span>
    );
  }
  return (
    <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      실데이터
    </span>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Bell }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function NotificationRow({ n, onRead }: { n: Notification; onRead: () => void }) {
  const unread = n.read_at == null && n.status !== "READ";
  const label = NOTIF_LABEL[n.status] ?? NOTIF_LABEL.CREATED;
  const inner = (
    <CardContent className="flex items-start gap-3">
      {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="읽지 않음" />}
      <div className={cn("min-w-0 flex-1", !unread && "opacity-70")}>
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{n.title}</span>
          <Badge variant={label.variant}>{label.text}</Badge>
        </div>
        {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>}
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>{formatRelative(n.created_at)}</span>
          {n.instrument?.symbol && <span>{n.instrument.symbol}</span>}
          {n.signal_type && <span>{n.signal_type}</span>}
        </div>
      </div>
    </CardContent>
  );
  return (
    <Card className="transition-colors hover:bg-accent/30" onClick={onRead} role="button">
      {n.signal_id != null ? <Link href={`/signals/${signalPathId(n.signal_id)}`}>{inner}</Link> : inner}
    </Card>
  );
}

function AlertRuleRow({ alert }: { alert: Alert }) {
  const update = useUpdateAlert();
  const [cooldown, setCooldown] = useState(String(alert.cooldown_sec));
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{alert.symbol ?? `#${alert.instrument_id}`}</span>
            <TypeBadge type={alert.signal_type} />
            {alert.timeframe && <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">{alert.timeframe}</span>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {alert.market ?? "-"} · 쿨다운 {alert.cooldown_sec}s
          </p>
        </div>
        <Switch
          checked={alert.enabled}
          onCheckedChange={(v) => update.mutate({ id: String(alert.alert_id), enabled: v })}
          aria-label="알림 활성화"
        />
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm">
        {editing ? (
          <>
            <Input type="number" min={1} value={cooldown} onChange={(e) => setCooldown(e.target.value)} className="h-8 w-28" />
            <Button
              size="sm"
              onClick={() => {
                update.mutate({ id: String(alert.alert_id), cooldown_sec: Number(cooldown) });
                setEditing(false);
              }}
            >
              저장
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              취소
            </Button>
          </>
        ) : (
          <button className="text-xs text-muted-foreground underline" onClick={() => setEditing(true)}>
            쿨다운 수정
          </button>
        )}
      </div>
    </div>
  );
}

function WebNotificationSettings({ notifications }: { notifications: Notification[] }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const config = useWebPushConfig();
  const saveSubscription = useSaveWebPushSubscription();
  const deleteSubscription = useDeleteWebPushSubscription();

  useEffect(() => {
    const available = "Notification" in window && "serviceWorker" in navigator;
    setSupported(available);
    if (available) {
      setPermission(window.Notification.permission);
      setEnabled(isWebNotificationsEnabled());
    }
  }, []);

  const enable = async () => {
    if (!supported) return;
    const result = await window.Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return;
    if ("PushManager" in window) {
      const latestConfig = config.data ?? (await config.refetch()).data;
      if (!latestConfig?.enabled || !latestConfig.public_key) return;
      const registration = await registerServiceWorker();
      let existing = await registration.pushManager.getSubscription();
      // 서버 VAPID 키가 회전되면 기존 구독은 옛 키에 묶여 전달이 조용히 실패한다.
      // 키가 다르면 폐기하고 새 키로 다시 구독한다.
      if (existing && !subscriptionMatchesKey(existing, latestConfig.public_key)) {
        await deleteSubscription.mutateAsync(existing.endpoint).catch(() => undefined);
        await existing.unsubscribe().catch(() => undefined);
        existing = null;
      }
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(latestConfig.public_key),
      });
      const json = subscription.toJSON();
      await saveSubscription.mutateAsync({
        ...json,
        user_agent: window.navigator.userAgent,
      });
    }
    writeSeenNotificationIds(notificationIds(notifications));
    setWebNotificationsEnabled(true);
    setEnabled(true);
  };

  const disable = async () => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      const subscription = await registration?.pushManager.getSubscription();
      await deleteSubscription.mutateAsync(subscription?.endpoint ?? null).catch(() => undefined);
      await subscription?.unsubscribe().catch(() => undefined);
    } else {
      await deleteSubscription.mutateAsync(null).catch(() => undefined);
    }
    setWebNotificationsEnabled(false);
    setEnabled(false);
  };

  const pending = saveSubscription.isPending || deleteSubscription.isPending;
  const active = enabled && permission === "granted";

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">웹 푸시</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              브라우저 또는 설치된 PWA로 주요 알림을 표시합니다.
            </p>
          </div>
          <Switch
            checked={active}
            disabled={!supported || permission === "denied" || pending}
            onCheckedChange={(checked) => {
              if (checked) void enable();
              else void disable();
            }}
            aria-label="웹 푸시 활성화"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={active ? "success" : "secondary"}>{active ? "활성" : "비활성"}</Badge>
          <Badge variant={permission === "denied" ? "destructive" : "outline"}>권한 {permission}</Badge>
          <Badge variant={config.data?.enabled ? "success" : "warning"}>서버 {config.data?.enabled ? "준비됨" : "대기"}</Badge>
        </div>
        {!supported && <p className="text-xs text-muted-foreground">이 브라우저는 웹 푸시를 지원하지 않습니다.</p>}
        {permission === "denied" && (
          <p className="text-xs text-destructive">브라우저 설정에서 이 사이트의 알림 권한을 허용해야 합니다.</p>
        )}
        {supported && permission !== "denied" && (
          <p className="text-xs text-muted-foreground">앱이 실행 중이면 새 알림을 감지하고 표시합니다.</p>
        )}
      </CardContent>
    </Card>
  );
}

// 조용한 시간(R42) + 스풀링(R46). 설정한 KST 시간대(자정 넘김 지원)에 온 알림은 드롭되지 않고
// 창이 끝날 때까지 보류됐다가 자연히 도착한다. 자는 사이 핑은 줄이되 알림은 놓치지 않는다.
function QuietHoursCard() {
  const { data, isLoading } = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();
  const enabled = data?.quiet_enabled ?? false;
  const start = data?.quiet_start_hour ?? 22;
  const end = data?.quiet_end_hour ?? 8;

  const save = (next: { quiet_enabled: boolean; quiet_start_hour: number; quiet_end_hour: number }) =>
    update.mutate(next);

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">조용한 시간</h2>
            <p className="mt-1 text-xs text-muted-foreground">이 시간대(KST)에 온 알림은 보류됐다가 창이 끝나면 도착합니다.</p>
          </div>
          <Switch
            checked={enabled}
            disabled={isLoading || update.isPending}
            onCheckedChange={(v) => save({ quiet_enabled: v, quiet_start_hour: start, quiet_end_hour: end })}
            aria-label="조용한 시간 활성화"
          />
        </div>
        {enabled && (
          <div className="flex items-center gap-2 text-sm">
            <HourSelect
              value={start}
              onChange={(h) => save({ quiet_enabled: true, quiet_start_hour: h, quiet_end_hour: end })}
              disabled={update.isPending}
            />
            <span className="text-muted-foreground">부터</span>
            <HourSelect
              value={end}
              onChange={(h) => save({ quiet_enabled: true, quiet_start_hour: start, quiet_end_hour: h })}
              disabled={update.isPending}
            />
            <span className="text-muted-foreground">까지</span>
          </div>
        )}
        {enabled && start === end && (
          <p className="text-xs text-amber-600">시작과 종료가 같으면 창이 비어 알림이 억제되지 않습니다.</p>
        )}
      </CardContent>
    </Card>
  );
}

function HourSelect({ value, onChange, disabled }: { value: number; onChange: (h: number) => void; disabled?: boolean }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums"
      aria-label="시각 선택"
    >
      {Array.from({ length: 24 }, (_, h) => (
        <option key={h} value={h}>
          {String(h).padStart(2, "0")}:00
        </option>
      ))}
    </select>
  );
}

// 알림 다이제스트(읽기 시점 요약). R41 신호 큐레이션·R42 조용한 시간에 이어, 자리를 비운
// 사이 온 알림을 분류별로 한 줄 요약한다. 저장 데이터를 바꾸지 않는 순수 조회.
function NotificationDigestCard() {
  const [windowHours, setWindowHours] = useState<24 | 168>(24);
  const { data, isLoading, isError, refetch } = useNotificationDigest(windowHours);
  const periods: Array<{ value: 24 | 168; label: string }> = [
    { value: 24, label: "24시간" },
    { value: 168, label: "7일" },
  ];
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">알림 요약</h2>
            <p className="mt-1 text-xs text-muted-foreground">최근 알림을 분류별로 모아봅니다.</p>
          </div>
          {data && <Badge variant="secondary" className="tabular-nums">안읽음 {data.unread}</Badge>}
        </div>
        <div className="flex gap-1.5">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setWindowHours(p.value)}
              className={cn(
                "h-7 shrink-0 rounded-md border px-2.5 text-xs",
                windowHours === p.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <Skeleton className="h-14 w-full" />
        ) : isError ? (
          <ErrorState error={new Error("요약을 불러오지 못했습니다.")} onRetry={() => refetch()} />
        ) : !data ? (
          <EmptyState title="표시할 요약이 없습니다" />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{data.summary}</p>
            {data.released > 0 && (
              <p className="text-xs text-amber-600">
                조용한 시간에 보류됐다 방금 도착: {data.released}건
              </p>
            )}
            {data.categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.categories.map((c) => (
                  <div
                    key={c.category}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"
                  >
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="font-semibold tabular-nums">{c.total}</span>
                    {c.unread > 0 && (
                      <span className="rounded bg-primary/10 px-1 text-[10px] font-medium text-primary tabular-nums">
                        안읽음 {c.unread}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertCenter({
  alerts,
  alertsQuery,
  notifications,
  notifQuery,
  markRead,
}: {
  alerts: Alert[];
  alertsQuery: ReturnType<typeof useAlerts>;
  notifications: Notification[];
  notifQuery: ReturnType<typeof useNotifications>;
  markRead: ReturnType<typeof useMarkRead>;
}) {
  const [filter, setFilter] = useState<NotificationFilter>("ALL");
  const unread = notifications.filter((n) => n.read_at == null && n.status !== "READ").length;
  const failed = notifications.filter((n) => n.status === "FAILED").length;
  const enabledAlerts = alerts.filter((a) => a.enabled).length;
  const filteredNotifications = useMemo(() => {
    if (filter === "ALL") return notifications;
    if (filter === "UNREAD") return notifications.filter((n) => n.read_at == null && n.status !== "READ");
    return notifications.filter((n) => n.status === filter);
  }, [filter, notifications]);

  const filters: Array<{ value: NotificationFilter; label: string }> = [
    { value: "ALL", label: "전체" },
    { value: "UNREAD", label: "안읽음" },
    { value: "CREATED", label: "생성" },
    { value: "FAILED", label: "실패" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="활성 규칙" value={enabledAlerts} icon={BellRing} />
        <StatCard label="안읽음" value={unread} icon={Bell} />
        <StatCard label="실패" value={failed} icon={ShieldCheck} />
      </div>

      <WebNotificationSettings notifications={notifications} />

      <QuietHoursCard />

      <NotificationDigestCard />

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">알림 규칙</h2>
              <p className="mt-1 text-xs text-muted-foreground">신호 상세에서 만든 종목/패턴별 알림입니다.</p>
            </div>
            <Badge variant="secondary">{alerts.length}</Badge>
          </div>
          {alertsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : alertsQuery.isError ? (
            <ErrorState error={alertsQuery.error} onRetry={() => alertsQuery.refetch()} />
          ) : alerts.length === 0 ? (
            <EmptyState title="알림 규칙이 없습니다" description="신호 상세에서 패턴 알림을 생성하세요." />
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <AlertRuleRow key={a.alert_id} alert={a} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">알림함</h2>
            <p className="mt-1 text-xs text-muted-foreground">최근 알림과 읽음 상태를 확인합니다.</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((item) => (
              <button
                key={item.value}
                onClick={() => setFilter(item.value)}
                className={cn(
                  "h-8 shrink-0 rounded-md border px-3 text-xs",
                  filter === item.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          {notifQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : notifQuery.isError ? (
            <ErrorState error={notifQuery.error} onRetry={() => notifQuery.refetch()} />
          ) : filteredNotifications.length === 0 ? (
            <EmptyState title="표시할 알림이 없습니다" />
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onRead={() => {
                    if (n.read_at == null && n.status !== "READ") markRead.mutate(String(n.id));
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// 구독(Track C, R52). 현재 티어와 기능/한도 표시. 결제 연동은 후속이라 업그레이드는 준비중.
function SubscriptionCard() {
  const { data, isLoading } = useEntitlements();
  const fmtUsage = (used: number, limit: number) =>
    limit < 0 ? `${used} / 무제한` : `${used} / ${limit}개`;
  const atLimit = (used: number, limit: number) => limit >= 0 && used >= limit;
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">구독</h2>
            <p className="mt-1 text-xs text-muted-foreground">플랜별로 사용 한도가 다릅니다.</p>
          </div>
          {data && (
            <Badge variant={data.pro ? "default" : "secondary"}>{data.pro ? "PRO" : "FREE"}</Badge>
          )}
        </div>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !data ? (
          <EmptyState title="구독 정보를 불러올 수 없습니다" />
        ) : (
          <div className="space-y-2">
            <ul className="space-y-1">
              {data.features.map((f) => (
                <li key={f.key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      atLimit(f.used, f.limit) ? "text-amber-600" : "",
                    )}
                  >
                    {fmtUsage(f.used, f.limit)}
                  </span>
                </li>
              ))}
            </ul>
            {!data.pro && (
              <button
                disabled
                className="w-full rounded-md border border-border py-2 text-xs text-muted-foreground"
              >
                PRO 업그레이드 (준비 중)
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsInner() {
  const router = useRouter();
  const status = useSystemStatus();
  const logout = useLogout();
  const alertsQuery = useAlerts();
  const notifQuery = useNotifications(false);
  const markRead = useMarkRead();
  const user = useAuthStore((s) => s.user);
  const getRefresh = useAuthStore((s) => s.getRefreshToken);
  const clear = useAuthStore((s) => s.clear);
  const [trace, setTrace] = useState("");

  const alerts = alertsQuery.data ?? [];
  const notifications = notifQuery.data?.data ?? [];

  const onLogout = async () => {
    await logout.mutateAsync(getRefresh());
    clear();
    router.replace("/login");
  };

  return (
    <div>
      <div className="px-4 py-3">
        <h1 className="text-lg font-semibold">설정</h1>
        <p className="mt-1 text-xs text-muted-foreground">알림, 데이터 상태, 계정 정보를 관리합니다.</p>
      </div>

      <div className="space-y-4 px-4 pb-4">
        <AlertCenter
          alerts={alerts}
          alertsQuery={alertsQuery}
          notifications={notifications}
          notifQuery={notifQuery}
          markRead={markRead}
        />

        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">데이터 출처 · 시스템 상태</h2>
            </div>
            {status.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : status.isError ? (
              <ErrorState error={status.error} onRetry={() => status.refetch()} title="상태 API 호출 실패" />
            ) : (
              <div className="space-y-2 text-sm">
                {status.data?.sidecar && !status.data.sidecar.healthy && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-snug text-amber-600">
                    ⚠ 사이드카 다운 — 미국·한국 주식·텔레그램 속보가 <b>합성 스텁</b>으로 대체되고 있습니다.
                    아래 <b>합성</b> 배지가 붙은 항목은 실데이터가 아닙니다.
                  </div>
                )}
                {status.data?.providers?.map((p) => (
                  <div key={p.provider} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{p.provider}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <SourceBadge source={p.source} />
                      <FreshnessBadge freshness={p.freshness} updatedAt={p.last_run_at} />
                    </div>
                  </div>
                ))}
                {status.data?.scanner_status && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">스캐너</span>
                    <span className="font-mono">{status.data.scanner_status}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">빌드</span>
                  <span className="font-mono text-xs">{status.data?.build_version ?? "-"}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <SubscriptionCard />

        <Card>
          <CardContent className="space-y-1">
            <h2 className="text-sm font-semibold">계정</h2>
            <p className="text-sm text-muted-foreground">{user?.email ?? "-"}</p>
            <p className="text-xs text-muted-foreground">역할 {user?.role ?? "-"} · 상태 {user?.status ?? "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-sm font-semibold">진단</h2>
            <div className="space-y-1.5">
              <Label htmlFor="trace">trace_id 입력</Label>
              <Input
                id="trace"
                placeholder="오류 화면의 trace_id를 붙여넣어 보관"
                value={trace}
                onChange={(e) => setTrace(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                운영자에게 trace_id를 전달하면 요청 추적이 가능합니다.
              </p>
            </div>
            <div className="pt-1 text-xs text-muted-foreground">
              <p>API Base · <span className="font-mono">{BASE}</span></p>
              <p>모드 · {USE_MOCK ? "MOCK" : "LIVE"}</p>
              <p>현재 시각 · {formatTime(new Date().toISOString(), "yyyy.MM.dd HH:mm")}</p>
            </div>
          </CardContent>
        </Card>

        <DonateLink variant="card" />

        <Button variant="destructive" className="w-full" onClick={onLogout} disabled={logout.isPending}>
          <LogOut className="h-4 w-4" />
          {logout.isPending ? "로그아웃 중" : "로그아웃"}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsInner />
    </RequireAuth>
  );
}
