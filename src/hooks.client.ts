/**
 * Client-side hooks for PWA service worker registration
 * This enables the app to be installed on Android (via TWA) and iOS (Add to Home Screen)
 *
 * PWA is only enabled when ENABLE_PWA=true environment variable is set.
 * This allows tkaflowarts.com (landing page) to build without PWA.
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
    // Production: Register service worker for PWA functionality (only if PWA is enabled)
    // The virtual:pwa-register module only exists when vite-plugin-pwa is active
    // @vite-ignore tells Vite not to fail if the module doesn't exist
    import(/* @vite-ignore */ "virtual:pwa-register")
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
          onRegisterError(error) {
            console.error("❌ Service worker registration failed:", error);
          },
        });
      })
      .catch(() => {
        // PWA not enabled for this build - this is expected for tkaflowarts.com
      });
  }
}
