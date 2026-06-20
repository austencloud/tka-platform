<script lang="ts">
  /**
   * ModuleRenderer
   * Domain: Module Content Rendering
   *
   * Responsibilities:
   * - Render active module content with LAZY LOADING
   * - Handle module transitions with simple, clean fade
   * - Coordinate with child module components via callbacks
   * - Provide loading states
   * - Code-split modules to reduce initial bundle size
   * - Handle HMR-related module loading failures gracefully
   */
  import { isModuleActive } from "../application/state/ui/ui-state.svelte";
  import { getIsTransitioning } from "../application/state/ui/ui-state.svelte";
  import { registerModuleCacheClear } from "../hmr-helper";
  import type { Component } from "svelte";
  import { onMount, onDestroy } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import ModuleSkeleton from "$lib/shared/modules/skeletons/ModuleSkeleton.svelte";
  import { authState } from "../auth/state/auth-state.svelte";
  import { resolveAccessTier, resolveOptimisticAccessTier } from "../auth/domain/access-tier";
  import { readBootSnapshot } from "$lib/shared/application/services/boot-snapshot";
  import { isModuleAccessible } from "../auth/domain/guest-access-config";
  import { isPremiumOrAbove } from "../auth/domain/models/user-role";
  import AuthNudge from "../auth/components/AuthNudge.svelte";
  import type { AuthNudgeTrigger } from "../auth/domain/auth-nudge-trigger";
  import { authDrawerState } from "../auth/state/auth-drawer-state.svelte";
  import { switchModule } from "../application/state/ui/module-state";
  import { MODULE_DEFINITIONS } from "../navigation/config/module-definitions";
  import {
    createKeepAliveController,
    type KeepAliveController,
  } from "./keep-alive-controller";

  // Only assign view-transition-name during module switches.
  // If set permanently, ANY view transition on the page captures this element.
  const vtName = $derived(getIsTransitioning() ? 'module-content' : undefined);

  interface Props {
    activeModule: string | null;
    isModuleLoading: boolean;
    onTabAccessibilityChange: (canAccess: boolean) => void;
    onCurrentWordChange: (word: string) => void;
    onLearnHeaderChange: (header: string) => void;
  }

  let {
    activeModule,
    isModuleLoading,
    onTabAccessibilityChange,
    onCurrentWordChange,
    onLearnHeaderChange,
  }: Props = $props();

  // Cache for loaded modules to avoid re-importing. SvelteMap (not a plain Map)
  // so markup reading moduleCache.get()/.has() reactively re-renders when a
  // chunk finishes loading and calls .set() - critical for the keep-alive host
  // below, whose component arrives asynchronously after first render.
  const moduleCache = new SvelteMap<string, Component<any>>();

  // ── Keep-alive host wiring ────────────────────────────────────────────────
  // Certain heavy modules (museum = Three.js/Threlte) must survive module
  // switches instead of being destroyed/recreated by {#key activeModule}.
  // The controller tracks mount/visibility/eviction; we render those modules in
  // a persistent host below the keyed block and bypass the keyed path for them.
  const KEEP_ALIVE_MODULES = ["museum"];

  // Reactive tick: bumped by the controller's onChange so derived reads re-run.
  let keepAliveVersion = $state(0);
  const keepAlive: KeepAliveController = createKeepAliveController(
    KEEP_ALIVE_MODULES,
    { onChange: () => (keepAliveVersion += 1) },
  );

  // Drive the controller from activeModule, and make sure mounted keep-alive
  // modules have their component class loaded into moduleCache.
  $effect(() => {
    keepAlive.setActiveModule(activeModule);
    for (const id of keepAlive.mountedModules()) {
      if (!moduleCache.has(id)) {
        loadModule(id)
          .then(() => (keepAliveVersion += 1))
          .catch(() => {});
      }
    }
  });

  // Mounted keep-alive module ids (re-derived whenever the controller changes).
  const mountedKeepAlive = $derived.by(() => {
    keepAliveVersion; // dependency
    return keepAlive.mountedModules();
  });

  // Which keep-alive module is currently visible (tracked via keepAliveVersion so
  // the host's display toggle reacts when visibility flips without the list
  // changing). Direct keepAlive.isVisible() calls in markup are NOT reactive.
  const visibleId = $derived.by(() => {
    keepAliveVersion; // dependency
    return mountedKeepAlive.find((id) => keepAlive.isVisible(id)) ?? null;
  });

  // Register cache clearing callback for HMR
  // When Vite does an HMR update, clear our cache to prevent stale chunk issues
  let deregisterCacheClear: (() => void) | undefined;
  let preloadTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    deregisterCacheClear = registerModuleCacheClear(() => {
      moduleCache.clear();
    });

    // Preload heavy modules (museum = Three.js/Threlte) during idle time.
    // Skip when museum is disabled at compile time (prod builds without museum).
    if (typeof __FEATURE_MUSEUM__ === "undefined" || __FEATURE_MUSEUM__) {
      preloadTimer = setTimeout(() => {
        const idle =
          (window as any).requestIdleCallback ??
          ((cb: () => void) => setTimeout(cb, 100));
        idle(() => {
          if (activeModule !== "museum" && !moduleCache.has("museum")) {
            loadModule("museum").catch(() => {});
          }
        });
      }, 3000);
    }
  });

  onDestroy(() => {
    deregisterCacheClear?.();
    clearTimeout(preloadTimer);
    keepAlive.dispose();
  });

  // Dynamic import functions for each module (enables code-splitting)
  // NOTE: Dashboard removed - Create is now the default landing module
  const moduleLoaders: Record<
    string,
    () => Promise<{ default: Component<any> }>
  > = {
    // dashboard removed - redirect to create via module ID migrations
    create: () =>
      import("../../features/create/shared/components/CreateModule.svelte"),
    browse: () =>
      import("../../features/browse/shared/components/BrowseModule.svelte"),
    // library module retired - backwards compat redirects to browse
    library: () =>
      import("../../features/browse/shared/components/BrowseModule.svelte"),
    // community graduated to Social module (Mar 2026)
    community: () => import("../../features/social/SocialModule.svelte"),
    learn: () => import("../../features/learn/LearnTab.svelte"),
    premium: () => import("../../features/premium/PremiumModule.svelte"),
    // "animate" is a backwards-compat alias - deep links and old bookmarks may use it
    animate: () => import("../../features/compose/ComposeModule.svelte"),
    train: () => import("../../features/train/components/TrainModule.svelte"),
    // library module retired - functionality now in Browse > Sequences via scope toggle
    // inbox module retired - Messages/notifications accessible via Dashboard widget drawer
    // edit module retired - Edit is now a slide-out panel, not a standalone module
    choreo_card: () =>
      import("../../features/choreo-card/components/ChoreoCardTab.svelte"),
    // Backwards compatibility alias for old bookmarks/deep links
    word_card: () =>
      import("../../features/choreo-card/components/ChoreoCardTab.svelte"),
    write: () => import("../../features/write/components/WriteTab.svelte"),
    // account module retired - merged into dashboard (profile widget handles auth, library is a Browse tab)
    feedback: () =>
      import("../../features/feedback/components/FeedbackModule.svelte"),
    admin: () =>
      import("../../features/admin/components/AdminDashboard.svelte"),
    // ml-training removed (Mar 2026)
    // Prop Tracking Lab - Skel2TKA proof of concept (video → notation)
    "prop-tracking-lab": () =>
      import("../../features/train/prop-tracking-lab/components/PropTrackingLabModule.svelte"),
    // compose module
    compose: () => import("../../features/compose/ComposeModule.svelte"),
    // watch module - video browsing hub
    watch: () => import("../../features/watch/WatchModule.svelte"),
    // arena module - community pairwise ranking
    arena: () => import("../../features/arena/ArenaModule.svelte"),
    // connect graduated to Social module (Mar 2026)
    connect: () => import("../../features/social/SocialModule.svelte"),
    // Social module - Community + Connect (graduated from Lab Mar 2026)
    social: () => import("../../features/social/SocialModule.svelte"),
    // settings module - accessed via gear icon in sidebar footer
    settings: () => import("../../features/settings/SettingsModule.svelte"),
    // Tika module - AI tutor for TKA (standalone module)
    tika: () => import("../../features/tika/TikaModule.svelte"),
    // Moderation module - user reports dashboard (admin-only)
    moderation: () => import("../../features/moderation/ModerationModule.svelte"),
    // festivals module - discover and apply to flow festivals
    festivals: () => import("../../features/festivals/FestivalModule.svelte"),
    // Levels module - L4-L7 position labs + Poi (graduated from Lab Mar 2026)
    levels: () => import("../../features/levels/LevelsModule.svelte"),
    // Hand Paths module - graduated from Lab (Mar 2026)
    "hand-paths": () => import("../../features/hand-paths/HandPathModule.svelte"),
    // Video module - Video Trails, Video Lab, Skel2TKA (graduated from Lab Mar 2026)
    video: () => import("../../features/video/VideoModule.svelte"),
    // Lab module - ALL experiments consolidated here (Skew, Poi, Realm, Terrain, Mandala, Backgrounds, Landing)
    lab: () => import("../../features/lab/LabModule.svelte"),
    // ========================================================================
    // BACKWARDS COMPAT: Old standalone experimental modules now redirect to Lab
    // ========================================================================
    skewlab: () => import("../../features/levels/LevelsModule.svelte"),
    "poi-lab": () => import("../../features/levels/LevelsModule.svelte"),
    retro: () => import("../../features/retro/RetroModule.svelte"),
    // The Archive - tile-based museum explorer
    museum: () => import("../../features/museum/MuseumModule.svelte"),
    mandala: () => import("../../features/mandala/MandalaModule.svelte"),
    "background-builder": () => import("../../features/lab/LabModule.svelte"),
    "landing-preview": () => import("../../features/lab/LabModule.svelte"),
    // Stage module - multi-performer formation locomotion
    stage: () => import("../../features/stage/StageModule.svelte"),
    // ========================================================================
    // REMOVED: Standalone 3D modules (now accessible via Realm destinations)
    // ========================================================================
    // gallery3d → Removed, use Realm → Gallery destination
    // infinite-worlds → Removed, use Realm → Worlds destination
    // museum → Removed (Museum Navigator archived, use Realm → Gallery)
  };

  // Load module with caching
  async function loadModule(
    moduleName: string
  ): Promise<Component<any> | null> {
    if (!moduleName || !moduleLoaders[moduleName]) return null;

    // Return cached module if available
    if (moduleCache.has(moduleName)) {
      console.debug(`[ModuleLoad] ${moduleName}: cache hit (0ms)`);
      return moduleCache.get(moduleName)!;
    }

    // Load and cache the component
    // Services are already registered synchronously via ITI container
    // Instrument the chunk fetch+eval — this is exactly how long the
    // "Loading <module>..." label stays on screen.
    const loadStart = performance.now();
    try {
      performance.mark(`module-chunk:${moduleName}:start`);
    } catch {
      /* mark API unavailable */
    }
    const { default: ModuleComponent } = await moduleLoaders[moduleName]();
    const chunkMs = Math.round(performance.now() - loadStart);
    try {
      performance.mark(`module-chunk:${moduleName}:end`);
      performance.measure(
        `module-chunk:${moduleName}`,
        `module-chunk:${moduleName}:start`,
        `module-chunk:${moduleName}:end`,
      );
    } catch {
      /* measure API unavailable */
    }
    console.debug(
      `%c[ModuleLoad] ${moduleName}: chunk fetch+eval ${chunkMs}ms`,
      chunkMs > 400 ? "color:#ff7043;font-weight:bold" : "color:inherit",
    );
    moduleCache.set(moduleName, ModuleComponent);

    // Signal the boot profiler that the initial module chunk has arrived -
    // this is the "user sees real app content" moment. The profiler is
    // idempotent: only the first signal prints the summary, later module
    // switches are no-ops (they're navigation, not boot).
    import("$lib/shared/analytics/boot-profiler").then(({ bootProfiler }) =>
      bootProfiler.signalReady(moduleName),
    );

    return ModuleComponent;
  }

  // Reactive module loading based on activeModule
  let modulePromise = $derived(
    activeModule ? loadModule(activeModule) : Promise.resolve(null)
  );

  const _snapshotTier = readBootSnapshot()?.tier ?? null;
  const _realTier = $derived(
    resolveAccessTier(authState.isAuthenticated, authState.isAnonymous, isPremiumOrAbove(authState.role))
  );
  const accessTier = $derived(
    resolveOptimisticAccessTier(authState.loading, _realTier, _snapshotTier)
  );

  const isModuleBlocked = $derived(
    activeModule ? !isModuleAccessible(activeModule, accessTier) : false
  );

  function getModuleNudgeTrigger(moduleId: string): AuthNudgeTrigger {
    const triggerMap: Record<string, AuthNudgeTrigger> = {
      learn: "module:learn",
      settings: "module:settings",
    };
    return triggerMap[moduleId] ?? "module:library";
  }
</script>

{#if isModuleLoading}
  <!-- Loading state while module is being restored -->
  {#if activeModule === "museum"}
    <div class="museum-skeleton" role="status" aria-live="polite" aria-busy="true">
      <div class="museum-skeleton-icon">
        <i class="fas fa-landmark" aria-hidden="true"></i>
      </div>
      <p class="museum-skeleton-title">Entering The Archive...</p>
      <div class="museum-skeleton-track">
        <div class="museum-skeleton-fill"></div>
      </div>
    </div>
  {:else}
    <ModuleSkeleton moduleKey={activeModule} />
  {/if}
{:else}
  {#if isModuleBlocked}
    <div class="module-gate" style="display: flex; align-items: center; justify-content: center; height: 100%;">
      <AuthNudge
        trigger={getModuleNudgeTrigger(activeModule!)}
        onCreateAccount={() => authDrawerState.show("signup")}
        onLogin={() => authDrawerState.show("signin")}
        onDismiss={() => switchModule("create")}
      />
    </div>
  {:else if activeModule && keepAlive.isKeepAlive(activeModule)}
    <!-- Keep-alive modules render in the persistent host below; the keyed path
         is bypassed so they are never destroyed on switch. -->
    <div class="transition-container"></div>
  {:else}
    <!-- Transition container for overlaying content -->
    <div class="transition-container">
      {#key activeModule}
        <div class="module-content" style:view-transition-name={vtName}>
          {#await modulePromise}
            <!-- Loading state while module chunk is being fetched -->
            {#if activeModule === "museum"}
              <div class="museum-skeleton" role="status" aria-live="polite" aria-busy="true">
                <div class="museum-skeleton-icon">
                  <i class="fas fa-landmark" aria-hidden="true"></i>
                </div>
                <p class="museum-skeleton-title">Entering The Archive...</p>
                <div class="museum-skeleton-track">
                  <div class="museum-skeleton-fill"></div>
                </div>
              </div>
            {:else}
              <ModuleSkeleton moduleKey={activeModule} />
            {/if}
          {:then LoadedModule}
            {#if LoadedModule}
              {#if isModuleActive("create")}
                <LoadedModule {onTabAccessibilityChange} {onCurrentWordChange} />
              {:else if isModuleActive("learn")}
                <LoadedModule onHeaderChange={onLearnHeaderChange} />
              {:else}
                <LoadedModule />
              {/if}
            {:else if activeModule}
              <!-- Module name is set but component didn't load - show error with retry -->
              <div class="module-error" role="alert">
                <p>Module "{activeModule}" failed to load</p>
                <button
                  class="reload-button"
                  onclick={() => window.location.reload()}
                  type="button"
                >
                  Reload Page
                </button>
              </div>
            {/if}
          {:catch error}
            <div class="module-error" role="alert">
              <p>Failed to load module</p>
              <p class="error-details">{error?.message || "Unknown error"}</p>
              <button
                class="reload-button"
                onclick={() => window.location.reload()}
                type="button"
              >
                Reload Page
              </button>
            </div>
          {/await}
        </div>
      {/key}
    </div>
  {/if}
{/if}

<!-- Persistent keep-alive modules: mounted once, hidden via display, never
     destroyed by {#key activeModule}. Each receives a `visible` prop so it can
     pause heavy work (render loop, sim) while hidden. -->
{#each mountedKeepAlive as moduleId (moduleId)}
  <!-- moduleCache is a SvelteMap, so this lookup re-renders when loadModule()
       finishes and calls .set() asynchronously. With a plain Map the host stayed
       blank whenever the chunk resolved after first render (e.g. the heavy museum
       chunk). The (moduleId) key preserves the component instance - no remount. -->
  {@const Loaded = moduleCache.get(moduleId)}
  {#if Loaded}
    <div
      class="keep-alive-host"
      style:display={moduleId === visibleId ? "flex" : "none"}
      aria-hidden={moduleId !== visibleId}
    >
      <Loaded visible={moduleId === visibleId} />
    </div>
  {/if}
{/each}

<style>
  /* Container for overlaying transitions */
  .transition-container {
    position: relative;
    width: 100%;
    height: 100%;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .keep-alive-host {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    flex-direction: column;
    overflow: hidden;
  }

  .module-content {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100%;
    height: 100%;
  }

  .module-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 200px;
    color: var(--semantic-error);
  }

  .module-error p {
    margin: 0 0 8px 0;
    font-size: var(--font-size-base);
  }

  .module-error .error-details {
    font-size: var(--font-size-compact);
    opacity: 0.7;
  }

  .module-error .reload-button {
    margin-top: 16px;
    padding: 12px 24px;
    min-height: var(--min-touch-target);
    min-width: 120px;
    background: var(--theme-accent, #6366f1);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .module-error .reload-button:hover {
    background: var(--theme-accent-hover, #4f46e5);
  }

  .module-error .reload-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Museum-themed loading skeleton */
  .museum-skeleton {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: #0a0a0a;
    color: rgba(200, 180, 140, 0.8);
    font-family: Georgia, "Times New Roman", serif;
    gap: 16px;
  }

  .museum-skeleton-icon {
    font-size: 36px;
    opacity: 0.5;
    animation: museum-pulse 2s ease-in-out infinite;
  }

  .museum-skeleton-title {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }

  .museum-skeleton-track {
    width: 160px;
    height: 2px;
    border-radius: 1px;
    background: rgba(200, 180, 140, 0.12);
    overflow: hidden;
  }

  .museum-skeleton-fill {
    height: 100%;
    width: 30%;
    background: rgba(200, 180, 140, 0.6);
    border-radius: 1px;
    animation: museum-shimmer 1.5s ease-in-out infinite;
  }

  @keyframes museum-pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.6; }
  }

  @keyframes museum-shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(433%); }
  }

</style>
