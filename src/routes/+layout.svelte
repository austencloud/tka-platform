<script lang="ts">
  import FullscreenPrompt from "$lib/shared/components/FullscreenPrompt.svelte";
  import InAppBrowserPrompt from "$lib/shared/auth/components/InAppBrowserPrompt.svelte";
  import ReportUserModal from "$lib/features/moderation/components/ReportUserModal.svelte";
  import WarningBanner from "$lib/features/moderation/components/WarningBanner.svelte";
  import EmailVerificationBanner from "$lib/shared/auth/components/EmailVerificationBanner.svelte";
  import ModalUrlRestorer from "$lib/shared/application/components/ModalUrlRestorer.svelte";
  import { container } from "$lib/shared/di";
  import type { Snippet } from "svelte";
  import { onMount, setContext } from "svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { registerCacheClearShortcut } from "$lib/shared/utils/cache-buster";
  import { initI18n } from "$lib/shared/i18n/i18n.svelte.js";
  import { initModalUrlState, cleanupModalUrlState } from "$lib/shared/application/state/ui/modal-url-state.svelte";
  import "../app.css";
  // Import modern view transitions CSS
  import "$lib/shared/transitions/view-transitions.css";

  let { children } = $props<{
    children: Snippet;
  }>();

  // Application bootstrap - ITI container is created synchronously on import
  // No async setup needed - container.items is immediately available
  let containerReady = $state(true);
  let containerError = $state<string | null>(null);

  // Set context for legacy code that expects di-container
  setContext("di-container", () => container);

  // Update viewport height on window resize and visualViewport changes
  function updateViewportHeight() {
    if (typeof window !== "undefined") {
      // Use visualViewport for accurate height that accounts for browser chrome
      const height = window.visualViewport?.height ?? window.innerHeight;
      // Update CSS custom property for use throughout the app
      document.documentElement.style.setProperty(
        "--viewport-height",
        `${height}px`
      );
    }
  }

  onMount(() => {
    // ⚡ CRITICAL: Initialize i18n and set HTML dir attribute
    initI18n();

    // ⚡ Initialize modal URL state tracking for HMR persistence
    initModalUrlState();

    // ⚡ CRITICAL: Set up viewport height IMMEDIATELY for fast render
    updateViewportHeight();

    // Listen to visualViewport resize (more reliable than window resize for mobile)
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewportHeight);
      window.visualViewport.addEventListener("scroll", updateViewportHeight);
    }

    // Fallback to window resize for browsers that don't support visualViewport
    window.addEventListener("resize", updateViewportHeight);

    // Register cache clear shortcut (Ctrl+Shift+Delete)
    registerCacheClearShortcut();

    // Browser navigation is handled in navigation-coordinator; allow native back/forward.

    // 🍪 Clean up old deployment cookies BEFORE auth initializes
    // This prevents stale cookies from breaking the login flow
    (async () => {
      try {
        const { cleanupOldCookies } =
          await import("$lib/shared/auth/utils/cookieCleanup");
        await cleanupOldCookies();
      } catch (error) {
        console.error("❌ [App Init] Cookie cleanup failed:", error);
        // Non-fatal error - continue with auth init anyway
      }
    })();

    // ⚡ CRITICAL: Initialize Firestore BEFORE auth listener
    // This prevents race conditions when services try to use Firestore
    (async () => {
      try {
        const { getFirestoreInstance } =
          await import("$lib/shared/auth/firebase");
        await getFirestoreInstance();
      } catch (error) {
        console.error("❌ [App Init] Firestore initialization failed:", error);
      }

      // ⚡ CRITICAL: Initialize Firebase Auth listener AFTER Firestore is ready
      // This is required to catch auth state changes from social sign-in
      // Must await to process pending OAuth redirect results (e.g., account linking)
      await authState.initialize();
    })();

    // Note: Sequence restoration tester removed (now integrated into services)

    // 📊 PERFORMANCE: Initialize Web Vitals tracking
    (async () => {
      try {
        const { initWebVitals } =
          await import("$lib/shared/analytics/web-vitals");
        await initWebVitals();
      } catch (error) {
        console.warn("Web Vitals tracking failed to initialize:", error);
      }
    })();

    // ⚡ PERFORMANCE: Load cloud thumbnail manifest for instant cache hits
    // This pre-populates the "known exists" list so all users can get cloud-cached
    // thumbnails instantly instead of re-rendering locally
    (async () => {
      try {
        const { CloudThumbnailCache } = await import(
          "$lib/features/browse/sequences/display/services/implementations/CloudThumbnailCache"
        );
        const cache = new CloudThumbnailCache();
        await cache.loadManifest();
      } catch (error) {
        console.warn("Cloud thumbnail manifest failed to load:", error);
        // Non-fatal - thumbnails will render locally on cache miss
      }
    })();

    // ⚡ PERFORMANCE: ITI container is created synchronously on import
    // No async setup needed - container.items is immediately available
    // Glyph cache uses lazy loading - SVGs are fetched on-demand when first needed
    // This eliminates 70+ network requests at startup

    // Return synchronous cleanup function
    return () => {
      // Clean up auth listener
      authState.cleanup();

      // Clean up modal URL state tracking
      cleanupModalUrlState();

      if (window.visualViewport) {
        window.visualViewport.removeEventListener(
          "resize",
          updateViewportHeight
        );
        window.visualViewport.removeEventListener(
          "scroll",
          updateViewportHeight
        );
      }
      window.removeEventListener("resize", updateViewportHeight);
    };
  });
</script>

<svelte:head>
  <!-- Default title only if page doesn't set one -->
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
</svelte:head>

{#if containerError}
  <div class="error-screen">
    <h1>Critical Error</h1>
    <p>{containerError}</p>
    <button onclick={() => window.location.reload()}>Retry</button>
  </div>
{:else if containerReady}
  <!-- Warning banner for users who have received a moderation warning -->
  <WarningBanner />

  <!-- Email verification banner for unverified email/password users -->
  <EmailVerificationBanner />

  <!-- ITI container is ready synchronously - render children immediately -->
  {@render children()}

  <!-- Fullscreen prompt for extreme constraints -->
  <FullscreenPrompt />

  <!-- Warn users in restricted in-app browsers (Messenger, Instagram, etc.) -->
  <InAppBrowserPrompt />

  <!-- Global report user modal -->
  <ReportUserModal />

  <!-- Restore modal state from URL (for page refresh and HMR) -->
  <ModalUrlRestorer />
{:else}
  <!-- Brief loading while container sets up -->
  <div class="error-screen">
    <p>Setting up services...</p>
  </div>
{/if}

<style>
  .error-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    text-align: center;
  }
</style>
