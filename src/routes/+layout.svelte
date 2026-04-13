<script lang="ts">
  import type { Snippet, Component } from "svelte";
  import { onMount, setContext } from "svelte";
  import { afterNavigate, onNavigate } from "$app/navigation";
  import { detectSiteMode, type SiteMode } from "../config/domains";
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

  // Site mode detection — determines whether we load the heavy app stack
  let siteMode = $state<SiteMode>("loading");

  // App-mode state
  let containerReady = $state(false);
  let containerError = $state<string | null>(null);

  // Dynamically loaded app-only components (null until loaded)
  let WarningBannerComp = $state<Component | null>(null);
  let EmailVerificationBannerComp = $state<Component | null>(null);
  let FullscreenPromptComp = $state<Component | null>(null);
  let InAppBrowserPromptComp = $state<Component | null>(null);
  let ReportUserModalComp = $state<Component | null>(null);
  let ModalUrlRestorerComp = $state<Component | null>(null);

  // Track cleanup functions for app-mode resources
  let appCleanup: (() => void) | null = null;

  // Deferred DI container reference — set once the dynamic import resolves
  let containerRef: any = null;

  // Set context synchronously during component init — the getter defers to the
  // dynamically loaded container once available. Legacy code calls getContext()
  // in onMount or later, by which point the container will be loaded.
  setContext("di-container", () => containerRef);

  // Update viewport height on window resize and visualViewport changes
  function updateViewportHeight() {
    if (typeof window !== "undefined") {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty(
        "--viewport-height",
        `${height}px`
      );
    }
  }

  /**
   * Landing mode init: minimal work, no Firebase, no DI, no auth.
   * Just CSS + viewport height + i18n.
   */
  async function initLandingMode() {
    updateViewportHeight();

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewportHeight);
    }
    window.addEventListener("resize", updateViewportHeight);

    // i18n is lightweight — safe for landing
    const { initI18n } = await import("$lib/shared/i18n/i18n.svelte.js");
    initI18n();

    // Analytics: PostHog (same instance as app mode — lightweight, no DI needed)
    const { initPostHog } = await import("$lib/shared/analytics/services/posthog");
    initPostHog();

    // Landing doesn't need DI container or auth — mark ready immediately
    containerReady = true;

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewportHeight);
      }
      window.removeEventListener("resize", updateViewportHeight);
    };
  }

  /**
   * App mode init: full bootstrap — DI container, Firebase, auth, analytics.
   * Same logic as the original layout, but loaded dynamically.
   */
  async function initAppMode() {
    // Progress: SvelteKit has hydrated and onMount is running
    if (typeof (window as any).__tkaLoadProgress === "function") {
      (window as any).__tkaLoadProgress(72, "Starting up...");
    } else {
      const loadingScreen = document.getElementById('app-loading');
      if (loadingScreen) {
        loadingScreen.classList.add('loaded');
        loadingScreen.addEventListener('transitionend', () => loadingScreen.remove());
      }
    }

    // Load DI container — this triggers all service registration
    const { container } = await import("$lib/shared/di");

    // Populate the deferred container reference (context was set synchronously above)
    containerRef = container;

    // Mark container ready so children can render
    containerReady = true;

    // Initialize native Capacitor plugins (status bar, keyboard, splash, lifecycle).
    // No-op on web — the isNative check inside returns immediately.
    container.items.nativeInitializer.initialize().catch((err: unknown) =>
      console.warn("[Layout] Native init skipped:", err)
    );

    // Prefetch browse data so it's ready before the user navigates there.
    // Uses requestIdleCallback to avoid competing with the active module's load.
    const prefetchBrowseData = () => {
      // Gallery: warm from IndexedDB cache, sync from Firestore in background
      try {
        const prefetcher = container.items.galleryPrefetcher;
        if (prefetcher && typeof prefetcher.prefetch === "function") {
          prefetcher.prefetch().catch((err: unknown) =>
            console.warn("[Layout] Gallery prefetch failed:", err)
          );
        }
      } catch (err) {
        console.warn("[Layout] Gallery prefetcher not available:", err);
      }

      // Creators: load creator profiles so the Creators tab is instant
      import("$lib/features/browse/creators/state/creators-data-state.svelte")
        .then(({ creatorsDataState }) => {
          if (!creatorsDataState.isInitialized) {
            const userRepo = container.items.userRepository;
            if (userRepo) {
              Promise.all([
                creatorsDataState.loadCreators(userRepo),
                creatorsDataState.loadFeaturedCreators(userRepo),
              ]).catch((err: unknown) =>
                console.warn("[Layout] Creators prefetch failed:", err)
              );
            }
          }
        })
        .catch((err: unknown) =>
          console.warn("[Layout] Creators module import failed:", err)
        );
    };

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(prefetchBrowseData);
    } else {
      setTimeout(prefetchBrowseData, 0);
    }

    // Analytics: PostHog
    const { initPostHog } = await import("$lib/shared/analytics/services/posthog");
    initPostHog();

    // Attribution tracking
    try {
      const persister = container?.items?.attributionPersister;
      if (persister) {
        (persister as any).getOrCreateSession();
      }
    } catch (error) {
      console.warn("Attribution capture failed:", error);
    }

    // i18n
    const { initI18n } = await import("$lib/shared/i18n/i18n.svelte.js");
    initI18n();

    // Modal URL state
    const { initModalUrlState, cleanupModalUrlState } = await import("$lib/shared/application/state/ui/modal-url-state.svelte");
    initModalUrlState();

    // Viewport height
    updateViewportHeight();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewportHeight);
      window.visualViewport.addEventListener("scroll", updateViewportHeight);
    }
    window.addEventListener("resize", updateViewportHeight);

    // Cache clear shortcut
    const { registerCacheClearShortcut } = await import("$lib/shared/utils/cache-buster");
    registerCacheClearShortcut();

    // Firestore + Auth
    try {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      (window as any).__tkaLoadProgress?.(76, "Connecting to cloud...");
    } catch (error) {
      console.error("[App Init] Firestore initialization failed:", error);
    }

    const { authState } = await import("$lib/shared/auth/state/authState.svelte");
    await authState.initialize();
    (window as any).__tkaLoadProgress?.(80, "Checking session...");

    // Web Vitals
    try {
      const { initWebVitals } = await import("$lib/shared/analytics/web-vitals");
      await initWebVitals();
    } catch (error) {
      console.warn("Web Vitals tracking failed to initialize:", error);
    }

    // Cloud thumbnail manifest
    try {
      const { CloudThumbnailCache } = await import(
        "$lib/features/browse/sequences/display/services/implementations/CloudThumbnailCache"
      );
      const cache = new CloudThumbnailCache();
      await cache.loadManifest();
    } catch (error) {
      console.warn("Cloud thumbnail manifest failed to load:", error);
    }

    // Load app-only UI components in parallel
    const [
      warningBannerMod,
      emailBannerMod,
      fullscreenMod,
      inAppMod,
      reportMod,
      modalRestorerMod,
    ] = await Promise.all([
      import("$lib/features/moderation/components/WarningBanner.svelte"),
      import("$lib/shared/auth/components/EmailVerificationBanner.svelte"),
      import("$lib/shared/components/FullscreenPrompt.svelte"),
      import("$lib/shared/auth/components/InAppBrowserPrompt.svelte"),
      import("$lib/features/moderation/components/ReportUserModal.svelte"),
      import("$lib/shared/application/components/ModalUrlRestorer.svelte"),
    ]);

    WarningBannerComp = warningBannerMod.default;
    EmailVerificationBannerComp = emailBannerMod.default;
    FullscreenPromptComp = fullscreenMod.default;
    InAppBrowserPromptComp = inAppMod.default;
    ReportUserModalComp = reportMod.default;
    ModalUrlRestorerComp = modalRestorerMod.default;

    // Return cleanup
    return () => {
      authState.cleanup();
      cleanupModalUrlState();

      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewportHeight);
        window.visualViewport.removeEventListener("scroll", updateViewportHeight);
      }
      window.removeEventListener("resize", updateViewportHeight);
    };
  }

  onMount(() => {
    siteMode = detectSiteMode();

    // Retro routes get a lightweight bootstrap: Firebase + auth + DI container,
    // but skip prefetch, analytics, moderation banners, modal state, web vitals.
    const isRetroRoute = ["/1989", "/1995", "/1998", "/2003"].some(
      (r) => window.location.pathname.startsWith(r)
    );
    if (isRetroRoute) {
      const loadingScreen = document.getElementById("app-loading");
      if (loadingScreen) loadingScreen.remove();

      import("$lib/features/retro/shared/services/retro-init")
        .then(({ initRetroMode }) => initRetroMode())
        .then(({ container: retroContainer }) => {
          containerRef = retroContainer;
          containerReady = true;
        })
        .catch((error) => {
          console.error("[Layout] Retro init failed:", error);
          containerError = String(error);
        });
      return;
    }

    const isLanding = siteMode === "landing";

    const initPromise = isLanding ? initLandingMode() : initAppMode();

    initPromise
      .then((cleanup) => {
        appCleanup = cleanup;
      })
      .catch((error) => {
        console.error("[Layout] Initialization failed:", error);
        containerError = String(error);
      });

    return () => {
      appCleanup?.();
    };
  });

  // Upgrade from landing mode → app mode when navigating to an app route.
  // This happens when a user scans a QR code (/p/[code] = landing mode),
  // then dismisses the viewer and lands on an app route like /browse/gallery.
  // Without this, auth/DI/Firestore are never initialized and the app
  // shows "Warming up..." forever.
  let appModeUpgradeStarted = false;
  afterNavigate(() => {
    if (siteMode !== "landing" || appModeUpgradeStarted) return;
    const newMode = detectSiteMode();
    if (newMode === "app") {
      appModeUpgradeStarted = true;
      siteMode = "app";
      initAppMode()
        .then((cleanup) => {
          appCleanup = cleanup;
        })
        .catch((error) => {
          console.error("[Layout] App mode upgrade failed:", error);
          containerError = String(error);
        });
    }
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
  <!-- App-only shell components (null/skipped for landing mode) -->
  {#if WarningBannerComp}
    <WarningBannerComp />
  {/if}

  {#if EmailVerificationBannerComp}
    <EmailVerificationBannerComp />
  {/if}

  <!-- Render children (either landing page or app) -->
  {@render children()}

  {#if FullscreenPromptComp}
    <FullscreenPromptComp />
  {/if}

  {#if InAppBrowserPromptComp}
    <InAppBrowserPromptComp />
  {/if}

  {#if ReportUserModalComp}
    <ReportUserModalComp />
  {/if}

  {#if ModalUrlRestorerComp}
    <ModalUrlRestorerComp />
  {/if}
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
