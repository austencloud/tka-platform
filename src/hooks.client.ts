/**
 * Client-side hooks for PWA service worker registration
 * This enables the app to be installed on Android (via TWA) and iOS (Add to Home Screen)
 *
 * PWA is enabled by default for TKA Scribe.
 * Set DISABLE_PWA=true when building for tkaflowarts.com (landing page).
 */

import { browser, dev } from "$app/environment";

// Always expose cache benchmark utility globally (in both dev and prod for testing)
if (browser) {
  console.log("[hooks.client] browser=", browser, "dev=", dev);
  import("$lib/shared/render/utils/cache-benchmark")
    .then((module) => {
      console.log("[hooks.client] Cache benchmark utility loaded. Run: window.runCacheBenchmark()");
      // Explicitly expose on window
      (window as unknown as { runCacheBenchmark: typeof module.runCacheBenchmark }).runCacheBenchmark = module.runCacheBenchmark;
    })
    .catch((err) => {
      console.error("[hooks.client] Failed to load cache benchmark:", err);
    });

}

if (browser && !dev) {
  // Only register service worker in production builds
  // In dev mode, the virtual:pwa-register module causes CORS errors
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onRegisteredSW() {
          // Service worker registered
        },
        onOfflineReady() {
          // App ready to work offline
        },
        onNeedRefresh() {
          // Auto-update when new version is available
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
