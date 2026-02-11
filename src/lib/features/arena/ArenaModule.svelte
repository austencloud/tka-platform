<!--
  ArenaModule.svelte - Community pairwise ranking system

  Three tabs:
  - Battle: vote on head-to-head matchups
  - Leaderboard: ranked sequences by community vote
  - Stats: personal voting history and statistics

  Navigation between tabs is handled by the sidebar.
-->
<script lang="ts">
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { ARENA_TABS } from "$lib/shared/navigation/config/tab-definitions";

  const tabComponents: Record<string, () => Promise<{ default: any }>> = {
    battle: () => import("./components/battle/ArenaBattleView.svelte"),
    leaderboard: () => import("./components/leaderboard/ArenaLeaderboardView.svelte"),
    stats: () => import("./components/detail/ArenaSequenceDetail.svelte"),
  };

  const activeTab = $derived(
    navigationState.activeTab || ARENA_TABS[0]?.id || "battle"
  );

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
              console.error(`Failed to load arena tab "${activeTab}":`, err);
              loadError = `Failed to load "${activeTab}" tab`;
              TabComponent = null;
            });
        } else {
          const mod = result as unknown as { default: any };
          if (mod?.default) {
            TabComponent = mod.default;
          } else {
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

<div class="arena-module">
  {#if loadError}
    <div class="arena-error" role="alert">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      <span>{loadError}</span>
    </div>
  {:else if TabComponent}
    <TabComponent />
  {:else}
    <div class="arena-loading" role="status" aria-live="polite" aria-busy="true">
      <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
      <span>Loading...</span>
    </div>
  {/if}
</div>

<style>
  .arena-module {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .arena-loading,
  .arena-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }

  .arena-error {
    color: var(--semantic-error, #ef4444);
  }

  .arena-loading i,
  .arena-error i {
    font-size: 24px;
  }
</style>
