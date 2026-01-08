/**
 * Client-side hooks for PWA service worker registration
 * This enables the app to be installed on Android (via TWA) and iOS (Add to Home Screen)
 */

import { browser, dev } from "$app/environment";

if (browser) {
  if (dev) {
    // 🔇 Dev mode: Unregister all service workers to prevent stale cache + workbox logs
    navigator.serviceWorker?.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  } else {
    // Production: Register service worker for PWA functionality
    import("virtual:pwa-register").then(({ registerSW }) => {
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
        onRegisterError(error) {
          console.error("❌ Service worker registration failed:", error);
        },
      });
    });
  }
}
