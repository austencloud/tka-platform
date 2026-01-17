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
   */
  import { isModuleActive } from "../application/state/ui/ui-state.svelte";
  import type { Component } from "svelte";

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

  // Dynamic import functions for each module (enables code-splitting)
  const moduleLoaders: Record<
    string,
    () => Promise<{ default: Component<any> }>
  > = {
    dashboard: () =>
      import("../../features/dashboard/components/Dashboard.svelte"),
    create: () =>
      import("../../features/create/shared/components/CreateModule.svelte"),
    discover: () =>
      import("../../features/discover/shared/components/DiscoverModule.svelte"),
    // library module retired - backwards compat redirects to discover
    library: () =>
      import("../../features/discover/shared/components/DiscoverModule.svelte"),
    // community module retired - creators moved to discover, challenges to dashboard
    learn: () => import("../../features/learn/LearnTab.svelte"),
    premium: () => import("../../features/premium/PremiumModule.svelte"),
    // "animate" is a backwards-compat alias - deep links and old bookmarks may use it
    animate: () => import("../../features/compose/ComposeModule.svelte"),
    train: () => import("../../features/train/components/TrainModule.svelte"),
    // library module retired - functionality now in Discover > Sequences via scope toggle
    // inbox module retired - Messages/notifications accessible via Dashboard widget drawer
    // edit module retired - Edit is now a slide-out panel, not a standalone module
    choreo_card: () =>
      import("../../features/choreo-card/components/ChoreoCardTab.svelte"),
    // Backwards compatibility alias for old bookmarks/deep links
    word_card: () =>
      import("../../features/choreo-card/components/ChoreoCardTab.svelte"),
    write: () => import("../../features/write/components/WriteTab.svelte"),
    // account module retired - merged into dashboard (profile widget handles auth, library is a Discover tab)
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
    // compose module
    compose: () => import("../../features/compose/ComposeModule.svelte"),
    // settings module - accessed via gear icon in sidebar footer
    settings: () => import("../../features/settings/SettingsModule.svelte"),
    // Realm module - Unified 3D destination hub (Stage, Gallery, Worlds, etc.)
    realm: () => import("../../features/realm/RealmModule.svelte"),
    // Mandala generator - kaleidoscope art studio with TKA elements
    mandala: () =>
      import("../../features/mandala-generator/components/MandalaGeneratorModule.svelte"),
    // Background Builder - design and iterate on deep ocean background elements
    "background-builder": () =>
      import("../../features/background-builder/BackgroundBuilder.svelte"),
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
