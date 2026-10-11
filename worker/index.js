// Custom service worker additions, bundled into the generated sw.js by
// next-pwa (see next.config.mjs — customWorkerSrc defaults to this folder).
// Handles incoming Web Push events and notification taps.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "SODE", body: event.data.text() };
  }

  const { title, body, url, tag } = payload;

  event.waitUntil(
    self.registration.showNotification(title || "SODE", {
      body: body || "",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      tag: tag || undefined,
      renotify: !!tag,
      data: { url: url || "/member/home" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/member/home", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Reuse an open SODE window if there is one, sending it to the target page
      for (const client of clients) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        if (client.url === targetUrl && "focus" in client) return client.focus();
        if ("navigate" in client) {
          return client.focus().then(() => client.navigate(targetUrl)).catch(() => self.clients.openWindow(targetUrl));
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
