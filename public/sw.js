self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "VEIN 알림" };
  }
  const title = payload.title || "VEIN 알림";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || undefined,
      icon: "/vein_logo.svg",
      tag: payload.notification_id ? `vein-notification-${payload.notification_id}` : undefined,
      data: { url: payload.url || "/settings" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/settings";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => new URL(client.url).pathname === url);
      if (existing) return existing.focus();
      return clients.openWindow(url);
    }),
  );
});
