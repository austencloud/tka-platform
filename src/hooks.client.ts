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

// Production: auto-recover from stale chunks after a deploy.
// When the SW serves an old HTML shell that references chunk hashes the server
// no longer has, dynamic imports fail. A single reload fetches the new manifest.
if (browser && !dev) {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    const reloaded = sessionStorage.getItem("tka-chunk-reload");
    if (!reloaded) {
      sessionStorage.setItem("tka-chunk-reload", "1");
      window.location.reload();
    }
  });

  // Clear the reload guard on successful page load (no stale chunks)
  sessionStorage.removeItem("tka-chunk-reload");

  // Report unhandled promise rejections to error telemetry
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason) || "Unknown rejection";
    const stack = reason?.stack;

    if (
      message.includes("ResizeObserver loop") ||
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("MIME type")
    ) {
      return;
    }

    import("$lib/shared/error/services/error-telemetry-reporter")
      .then(({ reportErrorTelemetry }) => {
        reportErrorTelemetry({
          message: `Unhandled rejection: ${message.slice(0, 200)}`,
          severity: "warning",
          context: {
            module: "global",
            action: "unhandledrejection",
            additionalData: {
              url: window.location.pathname,
              stack: stack?.slice(0, 1000),
            },
          },
          error: reason instanceof Error ? reason : undefined,
        });
      })
      .catch(() => {});
  });
}

// Production: register the minimal hand-written service worker
if (browser && !dev && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => {
      console.log("[SW] Registered");
      if (registration.active && "sync" in registration) {
        (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } })
          .sync.register("tka-sync-queue")
          .catch(() => {});
      }
    })
    .catch((err) => {
      console.error("[SW] Registration failed:", err);
    });
}
