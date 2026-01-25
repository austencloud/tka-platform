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
  import { registerModuleCacheClear } from "../hmr-helper";
  import type { Component } from "svelte";
  import { onMount } from "svelte";

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
  onMount(() => {
    registerModuleCacheClear(() => {
      moduleCache.clear();
    });
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
    community: () =>
      import("../../features/community/Community.svelte"),
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
    // Skew Lab module - experimental skewed positions (admin-only, temporary)
    skewlab: () => import("../../features/skewlab/SkewLabModule.svelte"),
    // Poi Lab module - poi physics constraints with VTG terminology
    "poi-lab": () => import("../../features/poi-lab/PoiLabModule.svelte"),
    // ML Training module for prop detection model training
    "ml-training": () =>
      import("../../features/train/ml-training/components/MLTrainingModule.svelte"),
    // Prop Tracking Lab - Skel2TKA proof of concept (video → notation)
    "prop-tracking-lab": () =>
      import("../../features/train/prop-tracking-lab/components/PropTrackingLabModule.svelte"),
    // compose module
    compose: () => import("../../features/compose/ComposeModule.svelte"),
    // watch module - video browsing hub
    watch: () => import("../../features/watch/WatchModule.svelte"),
    // connect module - collaborative sync
    connect: () => import("../../features/connect/ConnectModule.svelte"),
    // settings module - accessed via gear icon in sidebar footer
    settings: () => import("../../features/settings/SettingsModule.svelte"),
    // Realm module - Unified 3D destination hub (Stage, Gallery, Worlds, etc.)
    realm: () => import("../../features/realm/RealmModule.svelte"),
    // Terrain Research Lab - temporary module for comparing terrain implementations
    "terrain-research": () =>
      import("../../features/terrain-research/TerrainResearchModule.svelte"),
    // Mandala generator - kaleidoscope art studio with TKA elements
    mandala: () =>
      import("../../features/mandala-generator/components/MandalaGeneratorModule.svelte"),
    // Background Builder - design and iterate on deep ocean background elements
    "background-builder": () =>
      import("../../features/background-builder/BackgroundBuilder.svelte"),
    // Landing Preview - iterate on landing page designs (admin-only)
    "landing-preview": () =>
      import("../../features/landing-preview/LandingPreviewModule.svelte"),
    // Tika module - AI tutor for TKA (standalone module)
    tika: () => import("../../features/tika/TikaModule.svelte"),
    // Moderation module - user reports dashboard (admin-only)
    moderation: () => import("../../features/moderation/ModerationModule.svelte"),
    // Lab module - consolidated experiments (Spell Layouts, Skew, Poi tabs)
    lab: () => import("../../features/lab/LabModule.svelte"),
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
</script>

{#if isModuleLoading}
  <!-- Loading state while module is being restored -->
  <div class="module-loading" role="status" aria-live="polite" aria-busy="true">
    <div class="loading-spinner" aria-hidden="true"></div>
    <p>Loading...</p>
  </div>
{:else}
  <!-- Transition container for overlaying content -->
  <div class="transition-container">
    {#key activeModule}
      <div class="module-content">
        {#await modulePromise}
          <!-- Loading state while module chunk is being fetched -->
          <div
            class="module-loading"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div class="loading-spinner" aria-hidden="true"></div>
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

  .loading-spinner {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 3px solid var(--theme-stroke);
    border-top: 3px solid var(--theme-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
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
    min-height: 48px;
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

  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation-duration: 3s;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
    }
  }
</style>
