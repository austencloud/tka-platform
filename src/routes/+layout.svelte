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

  // ============================================================================
  // PARALLEL IMPORT KICKOFF (pre-onMount)
  //
  // Start fetching all app-mode JS chunks the moment this module is evaluated,
  // NOT when onMount runs. onMount waits for Svelte hydration — by then the
  // browser is idle and could have been downloading chunks already.
  //
  // Fetching at module-top lets all vendor chunks (firebase, iti, etc.) stream
  // in parallel with hydration. When onMount finally needs them, they're cached.
  //
  // Guard: only run in app mode. Landing/retro routes must not pay this cost.
  // The helper is reused for the landing→app upgrade path (afterNavigate).
  // ============================================================================
  /**
   * First-path-segment → module chunk preloader. Keep synchronized with
   * ModuleRenderer.moduleLoaders. Unlisted segments fall through to lazy load.
   */
  const URL_TO_MODULE: Record<string, () => Promise<unknown>> = {
    create: () => import("$lib/features/create/shared/components/CreateModule.svelte"),
    generate: () => import("$lib/features/create/shared/components/CreateModule.svelte"),
    browse: () => import("$lib/features/browse/shared/components/BrowseModule.svelte"),
    compose: () => import("$lib/features/compose/ComposeModule.svelte"),
    animate: () => import("$lib/features/compose/ComposeModule.svelte"),
    museum: () => import("$lib/features/museum/MuseumModule.svelte"),
    learn: () => import("$lib/features/learn/LearnTab.svelte"),
    train: () => import("$lib/features/train/components/TrainModule.svelte"),
    arena: () => import("$lib/features/arena/ArenaModule.svelte"),
    watch: () => import("$lib/features/watch/WatchModule.svelte"),
    settings: () => import("$lib/features/settings/SettingsModule.svelte"),
    tika: () => import("$lib/features/tika/TikaModule.svelte"),
    festivals: () => import("$lib/features/festivals/FestivalModule.svelte"),
    admin: () => import("$lib/features/admin/components/AdminDashboard.svelte"),
  };

  function startActiveModulePreload(): void {
    if (typeof window === "undefined") return;
    // Dev mode: each ES module is a separate HTTP request. Preloading the
    // module chunk (150+ files for /create) contends with the DI container
    // fetch and slows both. Skip in dev — ModuleRenderer lazy loads anyway.
    // Prod mode: chunks are bundled; HTTP/2 multiplexes them at negligible
    // cost, so parallel preload is pure win.
    if (!import.meta.env.PROD) return;
    const segment = window.location.pathname.split("/")[1] ?? "";
    const loader = URL_TO_MODULE[segment];
    if (loader) {
      // Fire-and-forget. Cache warms up while DI/firebase/auth resolve in parallel.
      loader().catch(() => {
        // Preload failure is non-critical — ModuleRenderer retries on demand.
      });
    }
  }

  function startAppImports() {
    // Prod-only: also kick off the active module chunk so ModuleRenderer's
    // later dynamic import resolves from cache.
    startActiveModulePreload();
    const common = {
      bootProfiler: import("$lib/shared/analytics/boot-profiler"),
      di: import("$lib/shared/di"),
      firebase: import("$lib/shared/auth/firebase"),
      authState: import("$lib/shared/auth/state/authState.svelte"),
      i18n: import("$lib/shared/i18n/i18n.svelte.js"),
      posthog: import("$lib/shared/analytics/services/posthog"),
      modalUrlState: import("$lib/shared/application/state/ui/modal-url-state.svelte"),
      cacheBuster: import("$lib/shared/utils/cache-buster"),
    };
    // Prod-only: preload MainApp too. In dev, AppShellLoader's own import() is
    // fast enough — adding it here pulls too many deps into initial parallel
    // fetch and slows DI.
    if (import.meta.env.PROD) {
      (common as Record<string, Promise<unknown>>).mainApp = import(
        "$lib/shared/application/components/MainApplication.svelte"
      );
    }
    return common;
  }

  let preloadedImports: ReturnType<typeof startAppImports> | null =
    typeof window !== "undefined" && detectSiteMode() === "app"
      ? startAppImports()
      : null;

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
    // Landing→app upgrade: preloadedImports is null because we started in landing
    // mode. Kick off the imports now (still parallel, just late).
    if (!preloadedImports) preloadedImports = startAppImports();
    const imports = preloadedImports;

    const { bootProfiler } = await imports.bootProfiler;
    bootProfiler.mark("total-init");

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
    bootProfiler.mark("di-container");
    const { container } = await imports.di;
    bootProfiler.end("di-container");

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
    bootProfiler.mark("posthog");
    const { initPostHog } = await imports.posthog;
    initPostHog();
    bootProfiler.end("posthog");

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
    bootProfiler.mark("i18n");
    const { initI18n } = await imports.i18n;
    initI18n();
    bootProfiler.end("i18n");

    // Modal URL state
    const { initModalUrlState, cleanupModalUrlState } = await imports.modalUrlState;
    initModalUrlState();

    // Viewport height
    updateViewportHeight();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewportHeight);
      window.visualViewport.addEventListener("scroll", updateViewportHeight);
    }
    window.addEventListener("resize", updateViewportHeight);

    // Cache clear shortcut
    const { registerCacheClearShortcut } = await imports.cacheBuster;
    registerCacheClearShortcut();

    // Firestore + Auth
    bootProfiler.mark("firestore-init");
    try {
      const { getFirestoreInstance } = await imports.firebase;
      await getFirestoreInstance();
      (window as any).__tkaLoadProgress?.(76, "Connecting to cloud...");
    } catch (error) {
      console.error("[App Init] Firestore initialization failed:", error);
    }
    bootProfiler.end("firestore-init");

    bootProfiler.mark("auth-init");
    const { authState } = await imports.authState;
    await authState.initialize();
    bootProfiler.end("auth-init");
    (window as any).__tkaLoadProgress?.(80, "Checking session...");

    bootProfiler.end("total-init");
    // Don't print summary yet — wait for the active feature module to signalReady.
    // 3s timeout is the safety net if no module signals.
    bootProfiler.scheduleSummary(3000);

    // ========================================================================
    // BACKGROUND INIT — fire-and-forget. The UI is interactive at this point;
    // these are observability + secondary banners that don't need to block.
    // Each is wrapped to log its own timing without holding up the boot.
    // ========================================================================
    const runDeferred = () => {
      // Web Vitals — analytics, never user-visible
      bootProfiler.mark("web-vitals");
      import("$lib/shared/analytics/web-vitals")
        .then(({ initWebVitals }) => initWebVitals())
        .catch((error) => console.warn("Web Vitals failed:", error))
        .finally(() => bootProfiler.end("web-vitals"));

      // Cloud thumbnail manifest — only needed when user visits browse
      bootProfiler.mark("thumbnail-manifest");
      import("$lib/features/browse/sequences/display/services/implementations/CloudThumbnailCache")
        .then(({ CloudThumbnailCache }) => new CloudThumbnailCache().loadManifest())
        .catch((error) => console.warn("Cloud thumbnail manifest failed:", error))
        .finally(() => bootProfiler.end("thumbnail-manifest"));

      // Secondary UI components (banners, prompts) — slot in when ready
      bootProfiler.mark("ui-components");
      Promise.all([
        import("$lib/features/moderation/components/WarningBanner.svelte"),
        import("$lib/shared/auth/components/EmailVerificationBanner.svelte"),
        import("$lib/shared/components/FullscreenPrompt.svelte"),
        import("$lib/shared/auth/components/InAppBrowserPrompt.svelte"),
        import("$lib/features/moderation/components/ReportUserModal.svelte"),
        import("$lib/shared/application/components/ModalUrlRestorer.svelte"),
      ])
        .then(([warning, email, full, inApp, report, modal]) => {
          WarningBannerComp = warning.default;
          EmailVerificationBannerComp = email.default;
          FullscreenPromptComp = full.default;
          InAppBrowserPromptComp = inApp.default;
          ReportUserModalComp = report.default;
          ModalUrlRestorerComp = modal.default;
        })
        .catch((error) => console.warn("UI components failed:", error))
        .finally(() => bootProfiler.end("ui-components"));
    };

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(runDeferred);
    } else {
      setTimeout(runDeferred, 0);
    }

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
{:else}
  <!-- App-only shell components (only after container initializes client-side;
       skipped during SSR and for landing mode). The #app-loading DOM in app.html
       covers the visible loading state until hydration completes. -->
  {#if containerReady && WarningBannerComp}
    <WarningBannerComp />
  {/if}

  {#if containerReady && EmailVerificationBannerComp}
    <EmailVerificationBannerComp />
  {/if}

  <!-- Render children always — required for SSR/prerender of public routes.
       App routes opt out of SSR via their own +layout.ts (ssr = false). -->
  {@render children()}

  {#if containerReady && FullscreenPromptComp}
    <FullscreenPromptComp />
  {/if}

  {#if containerReady && InAppBrowserPromptComp}
    <InAppBrowserPromptComp />
  {/if}

  {#if containerReady && ReportUserModalComp}
    <ReportUserModalComp />
  {/if}

  {#if containerReady && ModalUrlRestorerComp}
    <ModalUrlRestorerComp />
  {/if}
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
