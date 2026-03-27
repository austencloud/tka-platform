<!--
  RealmModule.svelte — 3D destinations as sidebar tabs.
  Each tab lazy-loads its destination component.
-->
<script lang="ts">
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { REALM_TABS } from "$lib/shared/navigation/config/tab-definitions";

  const tabComponents: Record<string, () => Promise<{ default: any }>> = {
    "realm-world": () => import("./RealmDestination.svelte"),
    museum: () => import("./destinations/museum/MuseumDestination.svelte"),
    "3d-controls": () => import("./tools/3d-controls/ThreeDControlsLab.svelte"),
  };

  const activeTab = $derived(navigationState.activeTab || REALM_TABS[0]?.id || "realm-world");

  let TabComponent = $state<any>(null);
  let loadError = $state<string | null>(null);

  $effect(() => {
    const loader = tabComponents[activeTab];
    if (loader) {
      loadError = null;
      loader()
        .then((mod: { default: any }) => {
          TabComponent = mod.default;
        })
        .catch((err: Error) => {
          console.error(`Failed to load realm tab "${activeTab}":`, err);
          loadError = `Failed to load "${activeTab}" tab`;
          TabComponent = null;
        });
    } else {
      loadError = `Unknown tab: ${activeTab}`;
      TabComponent = null;
    }
  });
</script>

<div class="realm-module">
  {#if loadError}
    <div class="load-error">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      <span>{loadError}</span>
    </div>
  {:else if TabComponent}
    <TabComponent />
  {:else}
    <div class="loading">
      <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
    </div>
  {/if}
</div>

<style>
  .realm-module {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--theme-panel-bg, #12121c);
  }

  .load-error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 100%;
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 1.5rem;
  }
</style>
