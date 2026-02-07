// Kill-switch service worker: clears all caches and unregisters itself.
// Deployed to replace the old Workbox SW that was serving stale content.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", async () => {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.navigate(client.url);
  }
  await self.registration.unregister();
});
