<!--
LOOPPresetsSection.svelte - Displays curated presets and user favorites
Organized by tabs: Featured, All, Favorites
-->
<script lang="ts">
  import { LOOP_PRESETS, getFeaturedPresets, type LOOPPreset } from "../../shared/domain/constants/loop-presets";
  import LOOPPresetCard from "./LOOPPresetCard.svelte";

  let { onSelectPreset, favorites = [], onToggleFavorite } = $props<{
    onSelectPreset: (preset: LOOPPreset) => void;
    favorites?: string[];
    onToggleFavorite?: (presetId: string) => void;
  }>();

  type TabId = "featured" | "all" | "favorites";
  let activeTab = $state<TabId>("featured");

  const featuredPresets = $derived(getFeaturedPresets());
  const favoritePresets = $derived(
    LOOP_PRESETS.filter((p) => favorites.includes(p.id))
  );

  const tabs: { id: TabId; label: string; count?: number }[] = $derived([
    { id: "featured", label: "Recommended", count: featuredPresets.length },
    { id: "all", label: "All Presets", count: LOOP_PRESETS.length },
    { id: "favorites", label: "Favorites", count: favoritePresets.length },
  ]);

  const displayedPresets = $derived.by(() => {
    switch (activeTab) {
      case "featured":
        return featuredPresets;
      case "all":
        return [...LOOP_PRESETS];
      case "favorites":
        return favoritePresets;
    }
  });

  function isFavorite(presetId: string): boolean {
    return favorites.includes(presetId);
  }
</script>

<div class="presets-section">
  <div class="tabs">
    {#each tabs as tab}
      <button
        class="tab"
        class:active={activeTab === tab.id}
        onclick={() => (activeTab = tab.id)}
        aria-pressed={activeTab === tab.id}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <div class="presets-list">
    {#if displayedPresets.length === 0}
      <div class="empty-state">
        {#if activeTab === "favorites"}
          <p>No favorites yet. Star presets you use often!</p>
        {:else}
          <p>No presets available.</p>
        {/if}
      </div>
    {:else}
      {#each displayedPresets as preset (preset.id)}
        <LOOPPresetCard
          {preset}
          onSelect={onSelectPreset}
          isFavorite={isFavorite(preset.id)}
          {onToggleFavorite}
        />
      {/each}
    {/if}
  </div>
</div>

<style>
  .presets-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
    padding: 3px;
  }

  .tab {
    flex: 1;
    padding: 6px 10px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-xs);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .tab:hover {
    color: var(--theme-text, white);
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.05));
  }

  .tab.active {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, white);
    font-weight: 600;
  }

  .presets-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 180px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .empty-state {
    text-align: center;
    padding: 16px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-compact);
  }
</style>
