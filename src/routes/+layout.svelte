<script lang="ts">
  import type { Snippet, Component } from "svelte";
  import { onMount } from "svelte";
  import { afterNavigate, onNavigate, replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import MarketingChrome from "$lib/shared/landing/components/MarketingChrome.svelte";
  import { detectSiteMode, type SiteMode } from "../config/domains";
  import { consumeSkipNextViewTransition } from "$lib/shared/transitions/sequence-drawer-state.svelte";
  import { getPresenceTracker } from "$lib/shared/presence/get-presence-tracker";
  import { isConstrainedConnection } from "$lib/shared/platform/network-conditions";
  import type { LayoutData } from "./$types";
  import "../app.css";
  // Chip toggle tokens - maps --chip-* to TKA design values
  import "@austencloud/chip-toggle/css/tka-tokens.css";
  // Import modern view transitions CSS
  import "$lib/shared/transitions/view-transitions.css";

  // View Transitions driver (2026 canonical SvelteKit pattern). The root transition
  // is disabled in view-transitions.css, so only elements carrying a
  // view-transition-name morph. SCOPED to the navigations that actually have a
  // morph pair (shop grid <-> product, browse <-> sequence). Every other route
  // change instant-cuts: unscoped, the API still snapshots the full viewport —
  // including the fixed cosmic WebGL background (~99ms readback) — on EVERY app
  // navigation, for no visible benefit (root is disabled). Guards: feature-detect
  // for graceful fallback, the swipe-dismiss coordination flag, same-pathname (the
  // viewer mutates bpm/t/view params constantly), and the morph-pair allowlist.
  // onNavigate never fires on a full-page F5.
  function navigationMorphs(
    from: URL | null | undefined,
    to: URL | null | undefined
  ): boolean {
    if (!from || !to) return false;
    const a = from.pathname;
    const b = to.pathname;
    // Shop uses a Motion spring-FLIP morph (ShopMorphLayer), NOT the View
    // Transitions API — interruptible, velocity-aware, and works on Safari/Firefox
    // where VT does not. So shop navigations are deliberately excluded here.
    // Browse gallery <-> sequence viewer still uses the VT thumbnail morph.
    const seqPair = (x: string, y: string) =>
      x.startsWith("/browse") && y.startsWith("/sequence");
    if (seqPair(a, b) || seqPair(b, a)) return true;
    return false;
  }

  onNavigate((navigation) => {
    if (!document.startViewTransition) return;
    if (consumeSkipNextViewTransition()) return;
    if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
    if (!navigationMorphs(navigation.from?.url, navigation.to?.url)) return;
    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });

  const OWNED_PARAMS: Record<string, readonly string[]> = {
    // loop-labeler (/test/loop-labeler) uses these for deep-link state.
    seq: ["/test/loop-labeler"],
    filter: ["/test/loop-labeler"],
  };

  afterNavigate((navigation) => {
    if (typeof window === "undefined") return;
    const pathname = navigation.to?.url.pathname ?? "";

    const url = new URL(window.location.href);
    let changed = false;
    for (const [param, ownedBy] of Object.entries(OWNED_PARAMS)) {
      if (!url.searchParams.has(param)) continue;
      const allowed = ownedBy.some((prefix) => pathname.startsWith(prefix));
      if (!allowed) {
        url.searchParams.delete(param);
        changed = true;
      }
    }

    if (changed) {
      const cleaned = url.pathname + (url.search ? url.search : "") + url.hash;
      replaceState(cleaned, {});
    }
  });

  let { children, data } = $props<{
    children: Snippet;
    data: LayoutData;
  }>();

  // Marketing routes share one persistent cosmic chrome (MarketingChrome) hosted
  // here at the root layout, which never unmounts across client-side navigation.
  // That keeps the COSMIC background + SiteHeader mounted while only the page
  // content transitions — no flash of the body's saved-theme gradient between
  // pages. App routes (everything else) render children exactly as before.
  // Exact marketing pages + whole subtrees (/shop/*) that all render the same
  // persistent cosmic chrome. The whole /guide subtree (hub included) now owns
  // its own shell chrome via GuideShell — clicking Guide lands directly in the
  // sidebar shell instead of a separate cosmic-background landing page first.
  const MARKETING_EXACT = new Set([
    "/",
    "/about",
    "/roots",
    "/support",
    "/composer",
    "/glossary",
    "/learn/staff-spinning-choreography",
  ]);
  // /notation is a subtree: the hub plus the per-prop pages (/notation/staves,
  // /notation/fans, ...) all render the same persistent chrome.
  const MARKETING_SUBTREES = ["/shop", "/notation"];
  const isMarketing = $derived.by(() => {
    const p = page.url.pathname;
    if (MARKETING_EXACT.has(p)) return true;
    return MARKETING_SUBTREES.some((root) => p === root || p.startsWith(root + "/"));
  });

  $effect(() => {
    if (data?.geo) {
      getPresenceTracker()?.setLocation(data.geo);
    }
  });

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
    stage: () => import("$lib/features/stage/StageModule.svelte"),
  };

  function startActiveModulePreload(): void {
    if (typeof window === "undefined") return;
    // Dev mode: each ES module is a separate HTTP request. Preloading the
    // module chunk (150+ files for /create) contends with the DI container
    // fetch and slows both. Skip in dev - ModuleRenderer lazy loads anyway.
    // Prod mode: chunks are bundled; HTTP/2 multiplexes them at negligible
    // cost, so parallel preload is pure win.
    if (!import.meta.env.PROD) return;
    const segment = window.location.pathname.split("/")[1] ?? "";
    const loader = URL_TO_MODULE[segment];
    if (loader) {
      // Fire-and-forget. Cache warms up while DI/firebase/auth resolve in parallel.
      loader().catch(() => {
        // Preload failure is non-critical - ModuleRenderer retries on demand.
      });
    }
  }

  function startAppImports() {
    // Prod-only: also kick off the active module chunk so ModuleRenderer's
    // later dynamic import resolves from cache.
    startActiveModulePreload();
    const common = {
      bootProfiler: import("$lib/shared/analytics/boot-profiler"),
      di: import("$lib/shared/composition-root"),
      firebase: import("$lib/shared/auth/firebase"),
      authState: import("$lib/shared/auth/state/auth-state.svelte"),
      i18n: import("$lib/shared/i18n/i18n.svelte.js"),
      posthog: import("$lib/shared/analytics/services/posthog"),
      modalUrlState: import("$lib/shared/application/state/ui/modal-url-state.svelte"),
      cacheBuster: import("$lib/shared/utils/cache-buster"),
    };
    // Prod-only: preload MainApp too. In dev, AppShellLoader's own import() is
    // fast enough - adding it here pulls too many deps into initial parallel
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

  // Site mode detection - determines whether we load the heavy app stack
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

    // i18n is lightweight - safe for landing
    const { initI18n } = await import("$lib/shared/i18n/i18n.svelte.js");
    initI18n();

    // Analytics: PostHog (same instance as app mode - lightweight, no DI needed)
    const { initPostHog } = await import("$lib/shared/analytics/services/posthog");
    void initPostHog();

    // Landing doesn't need DI container or auth - mark ready immediately
    containerReady = true;

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewportHeight);
      }
      window.removeEventListener("resize", updateViewportHeight);
    };
  }

  /**
   * App mode init: full bootstrap - DI container, Firebase, auth, analytics.
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

    // Load composition root - triggers all service registrations
    bootProfiler.mark("di-container");
    await imports.di;
    bootProfiler.end("di-container");

    // Mark container ready so children can render immediately
    containerReady = true;

    // Preload TKA letter glyph images (canvas word headers fall back to plain
    // text until these are ready). Decoding ~70 SVGs into canvas-ready images is
    // main-thread work, so we defer it to idle instead of racing it against the
    // first paint and the active module's load. On a slow connection that
    // contention is exactly what makes the page feel janky on arrival.
    const preloadGlyphs = () => {
      import("$lib/shared/render/services/text-renderer")
        .then(({ textRenderer }) => textRenderer.preloadGlyphImages())
        .catch(() => {});
    };
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(preloadGlyphs);
    } else {
      setTimeout(preloadGlyphs, 0);
    }

    // Initialize native Capacitor plugins (status bar, keyboard, splash, lifecycle).
    // No-op on web - the isNative check inside returns immediately.
    const { getNativeInitializer } = await import("$lib/shared/platform/get-native-initializer");
    getNativeInitializer().initialize().catch((err: unknown) =>
      console.warn("[Layout] Native init skipped:", err)
    );

    // Initialize desktop Tauri features (window state, updater).
    // No-op on web/mobile - the isDesktop check inside returns immediately.
    const { getDesktopInitializer } = await import("$lib/shared/desktop/get-desktop-initializer");
    getDesktopInitializer().initialize().catch((err: unknown) =>
      console.warn("[Layout] Desktop init skipped:", err)
    );

    // Prefetch browse data so it's ready before the user navigates there.
    // Uses requestIdleCallback to avoid competing with the active module's load.
    //
    // On a constrained connection (data-saver, slow/congested mobile) we back off
    // the speculative network work entirely: it's a multi-MB download for tabs the
    // user may never open, and on 4G it steals bandwidth from whatever they're
    // actually doing — which is what makes animations stutter on arrival. Both the
    // gallery and the Creators tab still load on demand when actually opened.
    const constrainedConnection = isConstrainedConnection();
    const prefetchBrowseData = async () => {
      // Gallery: always warm from the IndexedDB cache (local, instant). On a
      // constrained connection, skip the fresh Firestore sync; otherwise sync in
      // the background so the gallery is up to date before the user opens it.
      try {
        const { getGalleryPrefetcher } = await import("$lib/features/browse/shared/get-gallery-prefetcher");
        const prefetcher = getGalleryPrefetcher();
        if (prefetcher && typeof prefetcher.prefetch === "function") {
          prefetcher
            .prefetch({ skipNetworkSync: constrainedConnection })
            .catch((err: unknown) =>
              console.warn("[Layout] Gallery prefetch failed:", err)
            );
        }
      } catch (err) {
        console.warn("[Layout] Gallery prefetcher not available:", err);
      }

      // Creators: purely speculative warming for the Creators tab. Skip it
      // entirely on a constrained connection — it loads when the tab is opened.
      if (!constrainedConnection) {
        import("$lib/features/browse/creators/state/creators-data-state.svelte")
          .then(({ creatorsDataState }) => {
            if (!creatorsDataState.isInitialized) {
              Promise.all([
                creatorsDataState.loadCreators(),
                creatorsDataState.loadFeaturedCreators(),
              ]).catch((err: unknown) =>
                console.warn("[Layout] Creators prefetch failed:", err)
              );
            }
          })
          .catch((err: unknown) =>
            console.warn("[Layout] Creators module import failed:", err)
          );
      }
    };

    if (typeof requestIdleCallback !== "undefined") {
      // timeout bounds the boot-window starvation: during startup the main
      // thread is saturated, so a no-timeout idle callback can be deferred
      // 8-27s. 2s caps how late the gallery warm starts.
      requestIdleCallback(prefetchBrowseData, { timeout: 2000 });
    } else {
      setTimeout(prefetchBrowseData, 0);
    }

    // Analytics: PostHog
    bootProfiler.mark("posthog");
    const { initPostHog } = await imports.posthog;
    void initPostHog();
    bootProfiler.end("posthog");

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
    // Don't print summary yet - wait for the active feature module to signalReady.
    // 3s timeout is the safety net if no module signals.
    bootProfiler.scheduleSummary(3000);

    const runDeferred = () => {
      // Web Vitals - analytics, never user-visible
      bootProfiler.mark("web-vitals");
      import("$lib/shared/analytics/web-vitals")
        .then(({ initWebVitals }) => initWebVitals())
        .catch((error) => console.warn("Web Vitals failed:", error))
        .finally(() => bootProfiler.end("web-vitals"));

      // Cloud thumbnail manifest - only needed when user visits browse
      bootProfiler.mark("thumbnail-manifest");
      import("$lib/shared/browse/services/cloud-thumbnail-cache")
        .then(({ loadManifest }) => loadManifest())
        .catch((error) => console.warn("Cloud thumbnail manifest failed:", error))
        .finally(() => bootProfiler.end("thumbnail-manifest"));

      // Secondary UI components (banners, prompts) - slot in when ready
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
    // Back-gesture guard: in standalone PWA mode, one accidental back swipe
    // exits the app. Push a dummy history entry and re-push on popstate so
    // the first swipe is absorbed. Rapid double-back still exits.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    let backGuardCleanup: (() => void) | undefined;
    if (isStandalone) {
      history.pushState({ __backGuard: true }, "");

      const onPopState = (e: PopStateEvent) => {
        if (e.state?.__backGuard) return;
        history.pushState({ __backGuard: true }, "");
      };

      window.addEventListener("popstate", onPopState);
      backGuardCleanup = () => window.removeEventListener("popstate", onPopState);
    }

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
        .then(() => {
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
      backGuardCleanup?.();
      appCleanup?.();
    };
  });

  // Upgrade from landing mode → app mode when navigating to an app route.
  // This happens when a user scans a QR code (/q/[code] = landing mode),
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

  <!-- Render children always - required for SSR/prerender of public routes.
       App routes opt out of SSR via their own +layout.ts (ssr = false).
       Marketing routes wrap children in the persistent MarketingChrome (one
       cosmic background + SiteHeader shared across landing/about/roots/support). -->
  {#if isMarketing}
    <MarketingChrome>
      {@render children()}
    </MarketingChrome>
  {:else}
    {@render children()}
  {/if}

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
