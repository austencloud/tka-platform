<!--
  PlaygroundModule.svelte — user-facing home for experimental toys and projects.

  The user-facing counterpart to the admin-only Lab: experiments that are still
  rough but ready for people to play with. Populated one tab at a time, on
  request — not a bulk migration. Each tab is a self-contained experience loaded
  on demand. First inhabitant: Mandala.

  Navigation between tabs is handled by the sidebar - no internal tab bar needed.
-->
<script lang="ts">
  import type { Component } from "svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { PLAYGROUND_TABS } from "$lib/shared/navigation/config/tab-definitions";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";

  type TabModule = { default: Component };

  // Add a tab here when a toy graduates into the Playground (one at a time).
  const tabComponents: Record<string, () => Promise<TabModule>> = {
    mandala: () => import("$lib/features/mandala/MandalaModule.svelte"),
    tunnels: () => import("$lib/features/tunnel-collection/TunnelCollectionModule.svelte"),
    scenes: () => import("$lib/features/scene-3d-collection/Scene3DCollectionModule.svelte"),
  };

  const activeTab = $derived(navigationState.activeTab || PLAYGROUND_TABS[0]?.id || "mandala");
  const activeTabLabel = $derived(
    PLAYGROUND_TABS.find((t) => t.id === activeTab)?.label ?? "",
  );

  // The Art module has no nav entry of its own (navHidden) — users arrive via
  // the Library's Art shelf, so this bar is their visible way back. Routed
  // through the coordinator (real module switch + history push), same as the
  // shelf cards on the way in.
  function backToLibrary() {
    void handleModuleChange("browse", "library");
  }

  let TabComponent = $state<Component | null>(null);
  let loadError = $state<string | null>(null);

  $effect(() => {
    const loader = tabComponents[activeTab];
    if (loader) {
      loadError = null;
      // import() always returns a Promise — resolve it and swap in the component.
      loader()
        .then((mod) => {
          TabComponent = mod.default;
        })
        .catch((err: unknown) => {
          console.error(`Failed to load playground tab "${activeTab}":`, err);
          loadError = `Failed to load "${activeTab}" tab`;
          TabComponent = null;
        });
    } else {
      if (navigationState.currentModule === "playground") {
        loadError = `Unknown tab: ${activeTab}`;
      }
      TabComponent = null;
    }
  });
</script>

<div class="playground-module">
  <header class="art-bar">
    <button type="button" class="back-to-library" onclick={backToLibrary}>
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
      <span>Library</span>
    </button>
    <span class="art-bar-title">{activeTabLabel}</span>
  </header>
  {#if loadError}
    <div class="playground-error">
      <i class="fas fa-exclamation-triangle"></i>
      <span>{loadError}</span>
    </div>
  {:else if TabComponent}
    <TabComponent />
  {:else}
    <div class="playground-loading">
      <i class="fas fa-circle-notch fa-spin"></i>
      <span>Loading playground...</span>
    </div>
  {/if}
</div>

<style>
  .playground-module {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* Fixed-height bar: content below never shifts as tab labels change. */
  .art-bar {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 48px;
    padding: 0 12px;
    background: var(--theme-panel-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .back-to-library {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 999px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .back-to-library:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
  }

  .art-bar-title {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    font-size: 14px;
    font-weight: 600;
  }

  .playground-loading,
  .playground-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 14px;
  }

  .playground-error {
    color: var(--semantic-error, #ef4444);
  }

  .playground-loading i,
  .playground-error i {
    font-size: 24px;
  }
</style>
