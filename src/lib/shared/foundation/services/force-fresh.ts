/**
 * Surgical "force fresh" reload: unregister every service worker and delete the
 * Cache Storage entries it populated, then hard-reload so the page boots
 * uncontrolled and refetches all scripts (including module workers) from the
 * network.
 *
 * Why this exists: the prod SW (`static/sw.js`) cache-firsts `/_app/immutable/`.
 * Its localhost bypass only matches `localhost`/`127.0.0.1`, so when the app is
 * reached over a tunnel host (e.g. dev.tkaflowarts.com) the SW intercepts and
 * serves a STALE worker bundle — component HMR still lands, but the export
 * worker keeps running old bytes no matter how many times the tab is reopened.
 * Closing the tab does not evict a SW cache; only unregister + cache delete does.
 *
 * Unlike `nuclearCacheClear`, this preserves localStorage, IndexedDB and cookies
 * — so auth state and the local mandala collection survive. It only touches the
 * service-worker layer.
 */
export async function forceFreshReload(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }
  } catch {
    // best-effort — never block the reload on SW teardown
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // best-effort
  }

  // Cache-bust the navigation itself so the HTML shell is refetched too.
  const url = new URL(window.location.href);
  url.searchParams.set("fresh", String(Date.now()));
  window.location.replace(url.toString());
}
