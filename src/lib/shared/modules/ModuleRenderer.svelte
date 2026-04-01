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
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { authState } from "../auth/state/authState.svelte";
  import { resolveAccessTier } from "../auth/domain/AccessTier";
  import { isModuleAccessible } from "../auth/domain/guest-access-config";
  import { isPremiumOrAbove } from "../auth/domain/models/UserRole";
  import AuthNudge from "../auth/components/AuthNudge.svelte";
  import type { AuthNudgeTrigger } from "../auth/domain/AuthNudgeTrigger";
  import { authDrawerState } from "../auth/state/auth-drawer-state.svelte";
  import { switchModule } from "../application/state/ui/module-state";

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

  // Cache for loaded modules to avoid re-importing
  const moduleCache = new Map<string, Component<any>>();

  // Register cache clearing callback for HMR
  // When Vite does an HMR update, clear our cache to prevent stale chunk issues
  let deregisterCacheClear: (() => void) | undefined;
  onMount(() => {
    deregisterCacheClear = registerModuleCacheClear(() => {
      moduleCache.clear();
    });
  });
  onDestroy(() => {
    deregisterCacheClear?.();
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
    realm: () => import("../../features/realm/RealmModule.svelte"),
    // 2D Museum Walker - tile-based museum explorer
    "museum-2d": () => import("../../features/museum-2d/Museum2DModule.svelte"),
    mandala: () => import("../../features/lab/LabModule.svelte"),
    "background-builder": () => import("../../features/lab/LabModule.svelte"),
    "landing-preview": () => import("../../features/lab/LabModule.svelte"),
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
      return moduleCache.get(moduleName)!;
    }

    // Load and cache the component
    // Services are already registered synchronously via ITI container
    const { default: ModuleComponent } = await moduleLoaders[moduleName]();
    moduleCache.set(moduleName, ModuleComponent);
    return ModuleComponent;
  }

  // Reactive module loading based on activeModule
  let modulePromise = $derived(
    activeModule ? loadModule(activeModule) : Promise.resolve(null)
  );

  const accessTier = $derived(
    resolveAccessTier(authState.isAuthenticated, isPremiumOrAbove(authState.role))
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
  <div class="module-loading" role="status" aria-live="polite" aria-busy="true">
    <ProgressRing percent={-1} size={32} strokeWidth={3} />
    <p>Loading...</p>
  </div>
{:else}
  {#if isModuleBlocked}
    <div class="module-gate" style="display: flex; align-items: center; justify-content: center; height: 100%;">
      <AuthNudge
        trigger={getModuleNudgeTrigger(activeModule!)}
        onCreateAccount={() => authDrawerState.show()}
        onDismiss={() => switchModule("create")}
      />
    </div>
  {:else}
    <!-- Transition container for overlaying content -->
    <div class="transition-container">
      {#key activeModule}
        <div class="module-content" style:view-transition-name={vtName}>
          {#await modulePromise}
            <!-- Loading state while module chunk is being fetched -->
            <div
              class="module-loading"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <ProgressRing percent={-1} size={32} strokeWidth={3} />
              <p>Loading module...</p>
            </div>
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

  .module-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 200px;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .module-loading :global(.progress-ring) {
    margin-bottom: 16px;
  }

  .module-loading p {
    margin: 0;
    font-size: var(--font-size-sm);
    opacity: 0.7;
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

</style>
