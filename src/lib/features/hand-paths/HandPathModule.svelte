<!--
  HandPathModule.svelte - Browse and build spatial hand paths

  Graduated from Lab (Mar 2026). Two tabs:
  - Path Explorer: browse unique hand paths across sequence library
  - Hand Path Builder: tap grid locations to draw and save hand paths

  Navigation between tabs is handled by the sidebar - no internal tab bar needed.
-->
<script lang="ts">
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { HAND_PATH_TABS } from "$lib/shared/navigation/config/tab-definitions";

  const tabComponents: Record<string, () => Promise<{ default: any }>> = {
    "hand-path-explorer": () => import("$lib/features/hand-path-explorer/HandPathExplorerLab.svelte"),
    "hand-path-builder": () => import("$lib/features/hand-path-builder/HandPathBuilderLab.svelte"),
  };

  const activeTab = $derived(navigationState.activeTab || HAND_PATH_TABS[0]?.id || "hand-path-explorer");

  let TabComponent = $state<any>(null);
  let loadError = $state<string | null>(null);

  $effect(() => {
    const loader = tabComponents[activeTab];
    if (loader) {
      loadError = null;
      try {
        const result = loader();
        if (result && typeof result.then === "function") {
          result
            .then((mod: { default: any }) => {
              TabComponent = mod.default;
            })
            .catch((err: Error) => {
              console.error(`Failed to load hand-path tab "${activeTab}":`, err);
              loadError = `Failed to load "${activeTab}" tab`;
              TabComponent = null;
            });
        } else {
          const mod = result as unknown as { default: any };
          if (mod && mod.default) {
            TabComponent = mod.default;
          } else {
            console.error(`Unexpected loader result for "${activeTab}":`, result);
            loadError = `Failed to load "${activeTab}" tab`;
            TabComponent = null;
          }
        }
      } catch (err) {
        console.error(`Error calling loader for "${activeTab}":`, err);
        loadError = `Failed to load "${activeTab}" tab`;
        TabComponent = null;
      }
    } else {
      loadError = `Unknown tab: ${activeTab}`;
      TabComponent = null;
    }
  });
</script>

<div class="hand-path-module">
  {#if loadError}
    <div class="hand-path-error">
      <i class="fas fa-exclamation-triangle"></i>
      <span>{loadError}</span>
    </div>
  {:else if TabComponent}
    <TabComponent />
  {:else}
    <div class="hand-path-loading">
      <i class="fas fa-circle-notch fa-spin"></i>
      <span>Loading hand paths...</span>
    </div>
  {/if}
</div>

<style>
  .hand-path-module {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .hand-path-loading,
  .hand-path-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 14px;
  }

  .hand-path-error {
    color: var(--semantic-error, #ef4444);
  }

  .hand-path-loading i,
  .hand-path-error i {
    font-size: 24px;
  }
</style>
