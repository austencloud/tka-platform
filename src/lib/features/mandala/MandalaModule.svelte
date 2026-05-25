<!--
  MandalaModule.svelte - Mandala collection, meditation, and export
-->
<script lang="ts">
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { MANDALA_TABS } from "$lib/shared/navigation/config/tab-definitions";

  const tabComponents: Record<string, () => Promise<{ default: any }>> = {
    collection: () => import("./tabs/collection/CollectionTab.svelte"),
    meditate: () => import("./tabs/meditate/MeditateTab.svelte"),
    export: () => import("./tabs/export/ExportTab.svelte"),
  };

  const activeTab = $derived(navigationState.activeTab || MANDALA_TABS[0]?.id || "collection");

  let TabComponent = $state<any>(null);
  let loadError = $state<string | null>(null);

  $effect(() => {
    const loader = tabComponents[activeTab];
    if (loader) {
      loadError = null;
      loader()
        .then((mod) => {
          TabComponent = mod.default;
        })
        .catch((err) => {
          loadError = err.message;
        });
    } else {
      TabComponent = null;
      loadError = `Unknown tab: ${activeTab}`;
    }
  });
</script>

<div class="mandala-module">
  {#if loadError}
    <div class="error-state">
      <p>Failed to load tab: {loadError}</p>
    </div>
  {:else if TabComponent}
    <TabComponent />
  {:else}
    <div class="loading-state">
      <div class="loading-spinner"></div>
    </div>
  {/if}
</div>

<style>
  .mandala-module {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #f472b6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.6);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
