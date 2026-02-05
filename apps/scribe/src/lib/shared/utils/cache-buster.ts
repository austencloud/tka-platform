/**
 * Cache Buster - Nuclear option to clear all caches
 * Use this when the app gets stuck on white screen
 */

import { nuclearCacheClear } from "../auth/utils/nuclearCacheClear";

export async function clearAllCaches(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    // Use the comprehensive nuclear cache clear
    await nuclearCacheClear();

    // Wait a moment for operations to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Force hard reload
    window.location.reload();
  } catch (error) {
    console.error("Error clearing caches:", error);
  }
}

/**
 * Check if we should auto-clear cache on white screen
 */
export function checkAndClearIfBroken(): void {
  if (typeof window === "undefined") return;

  // Wait for page to load
  window.addEventListener("load", () => {
    setTimeout(() => {
      // Check if the page is still white (no meaningful content)
      const root = document.getElementById("app") || document.body;
      const hasContent =
        root.children.length > 0 &&
        root.querySelector("svg, img, button, input, canvas");

      if (!hasContent) {
        console.warn("Page appears to be stuck on white screen!");

        setTimeout(() => {
          void clearAllCaches();
        }, 2000);
      }
    }, 1000);
  });
}

/**
 * Add keyboard shortcut to clear caches: Ctrl+Shift+Delete or Cmd+Shift+Delete
 */
export function registerCacheClearShortcut(): void {
  if (typeof window === "undefined") return;

  // Check for URL parameter to force cache clear
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("clear-cache")) {
    void clearAllCaches();
    return;
  }

  window.addEventListener("keydown", (e) => {
    // Ctrl+Shift+Delete (Windows/Linux) or Cmd+Shift+Delete (Mac)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Delete") {
      e.preventDefault();

      const confirm = window.confirm(
        "Clear all caches and reload?\n\nThis will:\n- Clear service worker caches\n- Clear IndexedDB\n- Clear localStorage\n- Clear sessionStorage\n- Reload the page"
      );

      if (confirm) {
        void clearAllCaches();
      }
    }
  });
}
