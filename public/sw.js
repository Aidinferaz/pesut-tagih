// Pesut Tagih service worker: shows reminders pushed by the server and opens
// the right page when one is tapped. No caching here; the app stays online-first.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Pesut Tagih", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Pesut Tagih", {
      body: data.body || "",
      icon: "/icons/192.png",
      badge: "/icons/192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  // Only ever open pages of this site.
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === target.origin);
      if (open) return open.navigate(target.href).then((w) => w && w.focus());
      return self.clients.openWindow(target.href);
    }),
  );
});
