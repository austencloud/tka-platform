/**
 * Client-side hooks for PWA service worker registration
 * This enables the app to be installed on Android (via TWA) and iOS (Add to Home Screen)
 *
 * PWA is enabled by default for TKA Composer.
 * Set DISABLE_PWA=true when building for tkaflowarts.com (landing page).
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

// PWA registration - only when PWA plugin is enabled
// The __PWA_ENABLED__ flag is replaced at build time by vite.config.ts
// When DISABLE_PWA=true, this entire block is dead-code eliminated
declare const __PWA_ENABLED__: boolean;

// Dev mode: register a minimal FCM-only service worker for push notification testing
// This doesn't use the full PWA/Workbox SW - just the Firebase messaging handler
if (browser && dev && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/firebase-messaging-sw.js", { scope: "/" })
    .catch((err) => {
      console.warn("[FCM-Dev] Messaging service worker registration failed:", err);
    });
}

if (browser && !dev && typeof __PWA_ENABLED__ !== "undefined" && __PWA_ENABLED__) {
  // Only register service worker in production builds with PWA enabled
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
          console.log("[PWA] Service worker registered");
          // Register Background Sync if supported - retries failed network writes after restart
          if (registration?.active && "sync" in registration) {
            (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } })
              .sync.register("tka-sync-queue")
              .catch(() => {
                // Background Sync not supported in this browser - graceful degradation
              });
          }
        },
        onOfflineReady() {
          // Lazy-import toast to avoid blocking SW registration
          import("$lib/shared/toast/state/toast-state.svelte")
            .then(({ toast }) => {
              toast.success("App ready for offline use", 4000);
            })
            .catch(() => {});
        },
        onNeedRefresh() {
          // Persistent toast (duration 0 = stays until dismissed)
          import("$lib/shared/toast/state/toast-state.svelte")
            .then(({ toast }) => {
              toast.info("Update available. Refresh to apply.", 0);
            })
            .catch(() => {});
        },
        onRegisterError(error: Error) {
          console.error("Service worker registration failed:", error);
        },
      });
    })
    .catch(() => {
      // PWA not enabled for this build - expected in some configurations
    });
}
