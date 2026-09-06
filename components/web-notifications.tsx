"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useNotifications } from "@/lib/queries";
import {
  WEB_NOTIFICATIONS_CHANGED,
  WEB_NOTIFICATIONS_SEEN,
  isWebNotificationsEnabled,
  readSeenNotificationIds,
  registerServiceWorker,
  writeSeenNotificationIds,
} from "@/lib/web-notifications";
import { signalPathId } from "@/lib/types";
import { useAuthStore } from "@/store/auth";

export function WebNotifications() {
  const authed = useAuthStore((state) => state.isAuthenticated)();
  const [enabled, setEnabled] = useState(false);
  const [nativePushAvailable, setNativePushAvailable] = useState(true);
  const initialized = useRef(false);
  const notifications = useNotifications(true, authed && enabled && !nativePushAvailable);

  useEffect(() => {
    const sync = () => setEnabled(isWebNotificationsEnabled());
    sync();
    window.addEventListener(WEB_NOTIFICATIONS_CHANGED, sync);
    setNativePushAvailable("PushManager" in window);
    registerServiceWorker().catch(() => undefined);
    return () => window.removeEventListener(WEB_NOTIFICATIONS_CHANGED, sync);
  }, []);

  useEffect(() => {
    if (!authed) {
      initialized.current = false;
      return;
    }
    if (!enabled
      || !("Notification" in window)
      || window.Notification.permission !== "granted"
      || !notifications.data) return;

    const items = notifications.data.data;
    const seen = readSeenNotificationIds();
    if (!initialized.current && window.localStorage.getItem(WEB_NOTIFICATIONS_SEEN) == null) {
      writeSeenNotificationIds(items.map((item) => String(item.id)));
      initialized.current = true;
      return;
    }
    initialized.current = true;

    const fresh = items
      .filter((item) => !seen.has(String(item.id)))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (fresh.length === 0) return;

    void navigator.serviceWorker.ready.then(async (registration) => {
      for (const item of fresh) {
        const id = String(item.id);
        const url = item.signal_id != null
          ? `/signals/${signalPathId(item.signal_id)}`
          : "/settings";
        try {
          await registration.showNotification(item.title || "VEIN 알림", {
            body: item.body || undefined,
            icon: "/vein_logo.svg",
            tag: `vein-notification-${id}`,
            data: { url },
          });
          seen.add(id);
          await api.post(`/notifications/${id}/deliveries/web-push`).catch(() => undefined);
        } catch {
          // Keep it unseen so the next poll can retry browser display.
        }
      }
      writeSeenNotificationIds(seen);
    });
  }, [authed, enabled, notifications.data]);

  useEffect(() => {
    if (!authed) window.localStorage.removeItem(WEB_NOTIFICATIONS_SEEN);
  }, [authed]);

  return null;
}
