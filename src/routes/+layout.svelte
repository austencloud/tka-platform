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
  import { onNavigate } from "$app/navigation";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { registerCacheClearShortcut } from "$lib/shared/utils/cache-buster";
  import { initI18n } from "$lib/shared/i18n/i18n.svelte.js";
  import { initModalUrlState, cleanupModalUrlState } from "$lib/shared/application/state/ui/modal-url-state.svelte";
  import { initPostHog } from "$lib/shared/analytics/services/posthog";
  import { consumeSkipNextViewTransition } from "$lib/shared/transitions/sequence-drawer-state.svelte";
  import "../app.css";
  // Chip toggle tokens — maps --chip-* to TKA design values
  import "@austencloud/chip-toggle/css/tka-tokens.css";
  // Import modern view transitions CSS
  import "$lib/shared/transitions/view-transitions.css";

  // ============================================================================
  // VIEW TRANSITIONS API
  // Enables smooth morphing animations between pages (e.g., thumbnail → viewer)
  // ============================================================================
  onNavigate((navigation) => {
    // Skip if browser doesn't support View Transitions API
    if (!document.startViewTransition) return;

    // If the sequence page already animated (swipe dismiss), skip the view transition
    if (consumeSkipNextViewTransition()) return;

    // Detect mobile drawer transitions for /sequence/ routes
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const fromPath = navigation.from?.url?.pathname ?? "";
    const toPath = navigation.to?.url?.pathname ?? "";
    const enteringSequence = !fromPath.startsWith("/sequence/") && toPath.startsWith("/sequence/");
    const exitingSequence = fromPath.startsWith("/sequence/") && !toPath.startsWith("/sequence/");

    // Add transition class for mobile drawer animation
    if (isMobile && (enteringSequence || exitingSequence)) {
      const cls = enteringSequence ? "sequence-drawer-enter" : "sequence-drawer-exit";
      document.documentElement.classList.add(cls);

      return new Promise((resolve) => {
        const transition = document.startViewTransition(async () => {
          resolve();
          await navigation.complete;
        });

        transition.finished.then(() => {
          document.documentElement.classList.remove(cls);
        });
      });
    }

    // Default: standard view transition (desktop morph, etc.)
    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });

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
    // Progress: SvelteKit has hydrated and onMount is running
    // If __tkaLoadProgress exists (new app.html), use deterministic progress.
    // If not (cached old app.html), dismiss the loading screen immediately.
    if (typeof (window as any).__tkaLoadProgress === "function") {
      (window as any).__tkaLoadProgress(20, "Starting up...");
    } else {
      const loadingScreen = document.getElementById('app-loading');
      if (loadingScreen) {
        loadingScreen.classList.add('loaded');
        loadingScreen.addEventListener('transitionend', () => loadingScreen.remove());
      }
    }

    // 📊 ANALYTICS: Initialize PostHog first for early event capture
    initPostHog();

    // 📊 ATTRIBUTION: Capture how users found us (UTM params, referrer, etc.)
    // Must run before any navigation that might change URL params
    (async () => {
      try {
        const { container } = await import("$lib/shared/di");
        const persister = container?.items?.attributionPersister;
        if (persister) {
          // Get or create session and record current touch
          persister.getOrCreateSession();
        }
      } catch (error) {
        console.warn("Attribution capture failed:", error);
        // Non-fatal - app works without attribution
      }
    })();

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
        (window as any).__tkaLoadProgress?.(35, "Connecting to cloud...");
      } catch (error) {
        console.error("❌ [App Init] Firestore initialization failed:", error);
      }

      // ⚡ CRITICAL: Initialize Firebase Auth listener AFTER Firestore is ready
      // This is required to catch auth state changes from social sign-in
      // Must await to process pending OAuth redirect results (e.g., account linking)
      await authState.initialize();
      (window as any).__tkaLoadProgress?.(55, "Checking session...");
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
