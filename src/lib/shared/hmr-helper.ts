/**
 * HMR Helper - Ensures proper handling of hot module replacements
 * Particularly important for Svelte 5 runes state management
 */

/**
 * Check if we're in HMR mode and the page needs a full reload
 */
export function shouldForceReload(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // Check if this is an HMR update that left the page in a bad state
  // This can happen when Svelte 5 runes state doesn't preserve properly
  const rootElement = document.getElementById("app");
  if (!rootElement) {
    return false;
  }

  // If the root element exists but has no children after HMR, we're in a bad state
  // We rely solely on content check - if HMR left us with an empty app, reload
  const hasContent = rootElement.children.length > 0;

  // Only trigger reload if we're in dev mode (HMR active) and have no content
  const isDevMode = import.meta.env.DEV;

  return isDevMode && !hasContent;
}

/**
 * Handle HMR-specific initialization
 * Call this in your main app component's onMount
 */
export function handleHMRInit() {
  if (typeof window === "undefined") {
    return;
  }

  // Listen for Vite HMR events
  if (import.meta.hot) {
    // Before HMR invalidation, check if we should do a full reload instead
    import.meta.hot.on("vite:beforeUpdate", () => {
      console.log("[HMR] Preparing for update...");
    });

    // After HMR update, verify the page is still functional
    import.meta.hot.on("vite:afterUpdate", () => {
      console.log("[HMR] Update complete, verifying page state...");

      // Small delay to let Svelte finish rendering
      setTimeout(() => {
        if (shouldForceReload()) {
          console.warn(
            "[HMR] Page appears to be in a bad state, forcing reload..."
          );
          window.location.reload();
        }
      }, 100);
    });

    // Handle errors during HMR
    import.meta.hot.on("vite:error", (_error: unknown) => {
      console.error("[HMR] Error detected:", _error);
      // Force reload on error
      setTimeout(() => {
        console.warn("[HMR] Forcing reload due to error...");
        window.location.reload();
      }, 500);
    });
  }
}

/**
 * Register a cleanup function that will be called before HMR updates
 */
export function onBeforeHMR(cleanup: () => void) {
  if (import.meta.hot) {
    import.meta.hot.on("vite:beforeUpdate", cleanup);
  }
}
