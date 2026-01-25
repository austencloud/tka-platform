<!--
BrowseModuleNavigation.svelte

Tab-based navigation for the Browse module.
Tabs: Sequences, Collections, Creators
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
    import { onMount } from "svelte";
  import type {
    BrowseModuleType,
    BrowseTabConfig,
  } from "./types/browse-tab-types";

  const { currentTab = "gallery", onTabChange = () => {} } = $props<{
    currentTab?: BrowseModuleType;
    onTabChange?: (tab: BrowseModuleType) => void;
  }>();

  let hapticService: IHapticFeedback;

  // Note: Library is now integrated into Sequences via scope toggle (Community / My Library)
  const tabs: BrowseTabConfig[] = [
    { id: "gallery", label: "Sequences", icon: "fa-layer-group" },
    { id: "collections", label: "Collections", icon: "fa-folder" },
    { id: "creators", label: "Creators", icon: "fa-users" },
  ];

  function handleTabClick(tabId: BrowseModuleType) {
    hapticService?.trigger("selection");
    onTabChange(tabId);
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });
</script>

<nav class="browse-tab-navigation" aria-label="Browse navigation">
  <div class="tabs-container">
    {#each tabs as tab}
      <button
        class="tab-button"
        class:active={currentTab === tab.id}
        class:disabled={tab.disabled}
        onclick={() => handleTabClick(tab.id)}
        disabled={tab.disabled}
        aria-label={tab.label}
        aria-current={currentTab === tab.id ? "page" : undefined}
      >
        <i class="fas {tab.icon}" aria-hidden="true"></i>
        <span class="tab-label">{tab.label}</span>
      </button>
    {/each}
  </div>
</nav>

<style>
  .browse-tab-navigation {
    width: 100%;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--theme-stroke);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
  }

  .browse-tab-navigation::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }

  .tabs-container {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
    min-width: min-content;
  }

  .tab-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    white-space: nowrap;
    min-width: fit-content;
  }

  .tab-button:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
    color: var(--theme-text);
  }

  .tab-button.active {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    color: white;
    box-shadow: 0 2px 8px var(--theme-shadow);
  }

  .tab-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tab-button i {
    font-size: var(--font-size-base);
  }

  /* Mobile optimization - hide labels on very small screens */
  @media (max-width: 380px) {
    .tab-label {
      display: none;
    }

    .tab-button {
      padding: 10px 12px;
    }
  }

  /* Tablet and desktop - more spacing */
  @media (min-width: 768px) {
    .tabs-container {
      gap: 8px;
      padding: 12px 16px;
    }

    .tab-button {
      padding: 12px 20px;
      font-size: var(--font-size-sm);
    }
  }
</style>
