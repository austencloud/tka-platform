<!--
  SocialModule.svelte - Community map and nearby spinner sync.
  Tabs appear in the sidebar. Navigation handled by the nav system.
-->
<script lang="ts">
  import type { Component } from "svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { SOCIAL_TABS } from "$lib/shared/navigation/config/tab-definitions";

  const tabComponents: Record<string, () => Promise<{ default: Component }>> = {
    community: () => import("$lib/features/community/Community.svelte"),
    connect: () => import("$lib/features/connect/ConnectModule.svelte"),
    // Creators relocated Browse -> Social (2026-07-08). Its canonical feature
    // folder moved afterward, so this lazy import must follow the component.
    creators: () =>
      import("$lib/features/creators/components/CreatorsPanel.svelte"),
  };

  const activeTab = $derived(navigationState.activeTab || SOCIAL_TABS[0]?.id || "community");

  let TabComponent = $state<Component | null>(null);
  let loadError = $state<string | null>(null);

  $effect(() => {
    const loader = tabComponents[activeTab];
    if (loader) {
      loadError = null;
      loader()
        .then((mod: { default: Component }) => {
          TabComponent = mod.default;
        })
        .catch((err: Error) => {
          console.error(`Failed to load social tab "${activeTab}":`, err);
          loadError = `Failed to load "${activeTab}" tab`;
          TabComponent = null;
        });
    } else {
      if (navigationState.currentModule === "social") {
        loadError = `Unknown tab: ${activeTab}`;
      }
      TabComponent = null;
    }
  });
</script>

<div class="social-module">
  {#if loadError}
    <div class="load-error">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      <span>{loadError}</span>
    </div>
  {:else if TabComponent}
    <TabComponent />
  {:else}
    <div class="loading" role="status" aria-live="polite" aria-label="Loading">
      <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
    </div>
  {/if}
</div>

<style>
  .social-module {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
