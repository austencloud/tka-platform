/**
 * Client-side hooks
 */

import { browser, dev } from "$app/environment";
if (typeof window !== 'undefined' && 'Capacitor' in window) {
  import('@capgo/capacitor-updater').then(({ CapacitorUpdater }) => {
    CapacitorUpdater.notifyAppReady();
  }).catch(() => {});
}

// Always expose cache benchmark utility globally (in both dev and prod for testing)
if (browser) {
  import("$lib/shared/render/utils/cache-benchmark")
    .then((module) => {
      // Explicitly expose on window
      (window as unknown as { runCacheBenchmark: typeof module.runCacheBenchmark }).runCacheBenchmark = module.runCacheBenchmark;
    })
    .catch(() => {
      // Cache benchmark not available - expected in some builds
    });
}

// Dev mode: register a minimal FCM-only service worker for push notification testing
// This doesn't use the full PWA/Workbox SW - just the Firebase messaging handler
if (browser && dev && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/firebase-messaging-sw.js", { scope: "/" })
    .catch((err) => {
      console.warn("[FCM-Dev] Messaging service worker registration failed:", err);
    });
}
