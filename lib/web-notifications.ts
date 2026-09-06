import type { Notification as VeinNotification } from "./types";

export const WEB_NOTIFICATIONS_ENABLED = "vein.webNotifications.enabled";
export const WEB_NOTIFICATIONS_SEEN = "vein.webNotifications.seen";
export const WEB_NOTIFICATIONS_CHANGED = "vein:web-notifications-changed";

export function isWebNotificationsEnabled(): boolean {
  return typeof window !== "undefined"
    && window.localStorage.getItem(WEB_NOTIFICATIONS_ENABLED) === "true";
}

export function setWebNotificationsEnabled(enabled: boolean): void {
  window.localStorage.setItem(WEB_NOTIFICATIONS_ENABLED, String(enabled));
  window.dispatchEvent(new Event(WEB_NOTIFICATIONS_CHANGED));
}

export function notificationIds(items: VeinNotification[]): string[] {
  return items.map((item) => String(item.id));
}

export function readSeenNotificationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const value = JSON.parse(window.localStorage.getItem(WEB_NOTIFICATIONS_SEEN) ?? "[]");
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set();
  }
}

export function writeSeenNotificationIds(ids: Iterable<string>): void {
  const latest = Array.from(ids).slice(-100);
  window.localStorage.setItem(WEB_NOTIFICATIONS_SEEN, JSON.stringify(latest));
}

export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/**
 * 기존 푸시 구독이 현재 서버 VAPID 공개키로 만들어진 것인지 확인한다.
 *
 * 서버 키를 회전하면 브라우저에 남은 구독은 여전히 "옛" applicationServerKey 에
 * 묶여 있고, 전달만 조용히 실패한다(구독 객체 자체는 멀쩡해 보인다).
 * 불일치가 감지되면 호출부가 구독을 폐기하고 새로 만들어야 한다.
 */
export function subscriptionMatchesKey(
  subscription: PushSubscription,
  publicKey: string,
): boolean {
  const applied = subscription.options?.applicationServerKey;
  if (!applied) return false; // 확인 불가 → 재구독시켜 안전한 쪽으로.
  const current = urlBase64ToUint8Array(publicKey);
  const stored = new Uint8Array(applied);
  if (stored.length !== current.length) return false;
  return stored.every((byte, i) => byte === current[i]);
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service worker is not supported");
  }
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}
