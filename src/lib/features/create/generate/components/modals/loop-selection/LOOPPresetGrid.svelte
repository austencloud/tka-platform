<!--
LOOPPresetGrid.svelte - Grid display for LOOP presets

Displays a scrollable grid of preset cards. Supports:
- System presets (from loop-presets.ts)
- User presets (from Firebase)
- Following presets (from followed users)
- Trending data (popularity stats)
-->
<script lang="ts">
  import type { LOOPPreset } from "../../../shared/domain/constants/loop-presets";
  import type {
    UserLOOPPreset,
    FollowingPreset,
    LOOPPopularityData,
  } from "../../../shared/domain/models/loop-selection-types";
  import LOOPPresetCard from "../LOOPPresetCard.svelte";
  import LOOPTrendingCard from "./LOOPTrendingCard.svelte";

  type PresetType = "system" | "user" | "following" | "trending";

  interface Props {
    type: PresetType;
    systemPresets?: LOOPPreset[];
    userPresets?: UserLOOPPreset[];
    followingPresets?: FollowingPreset[];
    trendingData?: LOOPPopularityData[];
    favorites?: string[];
    isLoading?: boolean;
    emptyMessage?: string;
    onSelectPreset?: (preset: LOOPPreset | UserLOOPPreset | FollowingPreset) => void;
    onSelectTrending?: (data: LOOPPopularityData) => void;
    onToggleFavorite?: (presetId: string) => void;
    columns?: number;
    cardVariant?: 'row' | 'card';
  }

  let {
    type,
    systemPresets = [],
    userPresets = [],
    followingPresets = [],
    trendingData = [],
    favorites = [],
    isLoading = false,
    emptyMessage = "No presets available",
    onSelectPreset,
    onSelectTrending,
    onToggleFavorite,
    columns = 1,
    cardVariant = 'row',
  }: Props = $props();

  function isFavorite(presetId: string): boolean {
    return favorites.includes(presetId);
  }
</script>

<div class="preset-grid" class:loading={isLoading}>
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading presets...</p>
    </div>
  {:else if type === "system" && systemPresets.length === 0}
    <div class="empty-state">
      <p>{emptyMessage}</p>
    </div>
  {:else if type === "user" && userPresets.length === 0}
    <div class="empty-state">
      <i class="fas fa-bookmark"></i>
      <p>{emptyMessage}</p>
    </div>
  {:else if type === "following" && followingPresets.length === 0}
    <div class="empty-state">
      <i class="fas fa-users"></i>
      <p>{emptyMessage}</p>
    </div>
  {:else if type === "trending" && trendingData.length === 0}
    <div class="empty-state">
      <i class="fas fa-fire"></i>
      <p>No trending data available yet</p>
    </div>
  {:else}
    <div
      class="grid-content"
      class:multi-column={columns > 1}
      style:--grid-columns={columns > 1 ? columns : undefined}
    >
      {#if type === "system"}
        {#each systemPresets as preset (preset.id)}
          <LOOPPresetCard
            {preset}
            onSelect={(p) => onSelectPreset?.(p)}
            isFavorite={isFavorite(preset.id)}
            {onToggleFavorite}
            variant={cardVariant}
          />
        {/each}
      {:else if type === "user"}
        {#each userPresets as preset (preset.id)}
          <LOOPPresetCard
            preset={{
              id: preset.id,
              name: preset.name,
              description: `Used ${preset.usageCount} times`,
              useCase: "",
              components: preset.components,
              difficulty: 1,
              icon: preset.icon || "💎",
            }}
            onSelect={() => onSelectPreset?.(preset)}
            isFavorite={false}
            variant={cardVariant}
          />
        {/each}
      {:else if type === "following"}
        {#each followingPresets as preset (preset.id + preset.creatorId)}
          <LOOPPresetCard
            preset={{
              id: preset.id,
              name: preset.name,
              description: `by ${preset.creatorName}`,
              useCase: "",
              components: preset.components,
              difficulty: 1,
              icon: preset.icon || "👤",
            }}
            onSelect={() => onSelectPreset?.(preset)}
            isFavorite={false}
            variant={cardVariant}
          />
        {/each}
      {:else if type === "trending"}
        {#each trendingData as data (data.loopType)}
          <div class="trending-cell">
            <LOOPTrendingCard
              {data}
              onSelect={onSelectTrending}
            />
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .preset-grid {
    display: flex;
    flex-direction: column;
    min-height: 100px;
  }

  .grid-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 240px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .grid-content.multi-column {
    display: grid;
    grid-template-columns: repeat(var(--grid-columns, 2), 1fr);
    gap: 8px;
    max-height: none;
  }

  .grid-content.multi-column .trending-cell {
    grid-column: 1 / -1;
  }

  .grid-content::-webkit-scrollbar {
    width: 6px;
  }

  .grid-content::-webkit-scrollbar-track {
    background: var(--scrollbar-track, transparent);
  }

  .grid-content::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.15));
    border-radius: 3px;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px 16px;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .empty-state i {
    font-size: 24px;
    opacity: 0.5;
  }

  .empty-state p,
  .loading-state p {
    margin: 0;
    font-size: var(--font-size-compact);
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: var(--theme-accent, #6366f1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
      border-top-color: var(--theme-text-dim);
    }
  }
</style>
