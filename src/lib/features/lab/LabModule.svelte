<!--
  LabModule.svelte - Consolidated experiments and UI prototypes

  A unified module for temporary experiments that would otherwise clutter
  the sidebar as individual modules. Each tab is a self-contained experiment.

  Navigation between tabs is handled by the sidebar - no internal tab bar needed.

  When experiments graduate to production, move them to their proper module.
  When experiments are abandoned, delete the tab component.
-->
<script lang="ts">
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { LAB_TABS } from "$lib/shared/navigation/config/tab-definitions";

  // Dynamic tab imports - add new experiments here
  const tabComponents: Record<string, () => Promise<{ default: any }>> = {
    "spell-layouts": () => import("./tabs/SpellLayoutsLab.svelte"),
    skew: () => import("$lib/features/skewlab/SkewLabModule.svelte"),
    poi: () => import("$lib/features/poi-lab/PoiLabModule.svelte"),
  };

  // Get current tab, default to first tab
  const activeTab = $derived(navigationState.activeTab || LAB_TABS[0]?.id || "spell-layouts");

  // Load the active tab component
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
          console.error(`Failed to load lab tab "${activeTab}":`, err);
          loadError = `Failed to load "${activeTab}" tab`;
          TabComponent = null;
        });
    } else {
      loadError = `Unknown tab: ${activeTab}`;
      TabComponent = null;
    }
  });
</script>

<div class="lab-module">
  {#if loadError}
    <div class="lab-error">
      <i class="fas fa-exclamation-triangle"></i>
      <span>{loadError}</span>
    </div>
  {:else if TabComponent}
    <TabComponent />
  {:else}
    <div class="lab-loading">
      <i class="fas fa-circle-notch fa-spin"></i>
      <span>Loading experiment...</span>
    </div>
  {/if}
</div>

<style>
  .lab-module {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .lab-loading,
  .lab-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 14px;
  }

  .lab-error {
    color: var(--semantic-error, #ef4444);
  }

  .lab-loading i,
  .lab-error i {
    font-size: 24px;
  }
</style>
