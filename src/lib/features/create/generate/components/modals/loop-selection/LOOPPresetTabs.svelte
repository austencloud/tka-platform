<!--
LOOPPresetTabs.svelte - Tab switcher for preset browser

Displays 3 tabs:
1. My Presets - User-created presets (requires auth)
2. Trending - Popular LOOP types from public sequences
3. Following - Presets from followed users (requires auth)
-->
<script lang="ts">
  import type { LOOPPresetTab } from "../../../shared/domain/models/loop-selection-types";

  interface Props {
    activeTab: LOOPPresetTab;
    onTabChange: (tab: LOOPPresetTab) => void;
    myPresetsCount?: number;
    trendingCount?: number;
    followingCount?: number;
    isAuthenticated?: boolean;
  }

  let {
    activeTab,
    onTabChange,
    myPresetsCount = 0,
    trendingCount = 0,
    followingCount = 0,
    isAuthenticated = false,
  }: Props = $props();

  interface TabConfig {
    id: LOOPPresetTab;
    label: string;
    icon: string;
    count: number;
    requiresAuth: boolean;
  }

  const tabs: TabConfig[] = $derived([
    {
      id: "my-presets" as LOOPPresetTab,
      label: "My Presets",
      icon: "fa-bookmark",
      count: myPresetsCount,
      requiresAuth: true,
    },
    {
      id: "trending" as LOOPPresetTab,
      label: "Trending",
      icon: "fa-fire",
      count: trendingCount,
      requiresAuth: false,
    },
    {
      id: "following" as LOOPPresetTab,
      label: "Following",
      icon: "fa-users",
      count: followingCount,
      requiresAuth: true,
    },
  ]);

  function handleTabClick(tab: TabConfig) {
    if (tab.requiresAuth && !isAuthenticated) {
      // Don't switch to auth-required tabs if not authenticated
      return;
    }
    onTabChange(tab.id);
  }
</script>

<div class="tabs-container" role="tablist" aria-label="Preset categories">
  {#each tabs as tab}
    <button
      class="tab"
      class:active={activeTab === tab.id}
      class:disabled={tab.requiresAuth && !isAuthenticated}
      onclick={() => handleTabClick(tab)}
      role="tab"
      aria-selected={activeTab === tab.id}
      aria-controls="panel-{tab.id}"
      disabled={tab.requiresAuth && !isAuthenticated}
      title={tab.requiresAuth && !isAuthenticated
        ? "Sign in to access"
        : tab.label}
    >
      <i class="fas {tab.icon}" aria-hidden="true"></i>
      <span class="tab-label">{tab.label}</span>
      {#if tab.count > 0}
        <span class="count-badge">{tab.count}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .tabs-container {
    display: flex;
    gap: 4px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 4px;
  }

  .tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    min-height: 40px;
  }

  .tab:hover:not(:disabled) {
    color: var(--theme-text, white);
    background: rgba(255, 255, 255, 0.05);
  }

  .tab.active {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, white);
    font-weight: 600;
  }

  .tab:disabled,
  .tab.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tab i {
    font-size: var(--font-size-sm);
  }

  .tab-label {
    white-space: nowrap;
  }

  .count-badge {
    background: var(--theme-accent, #6366f1);
    color: white;
    font-size: var(--font-size-xs);
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 20px;
    text-align: center;
  }

  /* Compact on small screens */
  @media (max-width: 480px) {
    .tab-label {
      display: none;
    }

    .tab {
      padding: 8px;
    }

    .tab i {
      font-size: var(--font-size-base);
    }
  }
</style>
