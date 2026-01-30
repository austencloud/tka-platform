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

if (browser && !dev && typeof __PWA_ENABLED__ !== "undefined" && __PWA_ENABLED__) {
  // Only register service worker in production builds with PWA enabled
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
