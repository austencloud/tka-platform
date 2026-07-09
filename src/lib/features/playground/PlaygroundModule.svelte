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

  type TabModule = { default: Component };

  // Add a tab here when a toy graduates into the Playground (one at a time).
  const tabComponents: Record<string, () => Promise<TabModule>> = {
    mandala: () => import("$lib/features/mandala/MandalaModule.svelte"),
    tunnels: () => import("$lib/features/tunnel-collection/TunnelCollectionModule.svelte"),
  };

  const activeTab = $derived(navigationState.activeTab || PLAYGROUND_TABS[0]?.id || "mandala");

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
