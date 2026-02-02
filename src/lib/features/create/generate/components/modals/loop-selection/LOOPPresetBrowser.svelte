<!--
LOOPPresetBrowser.svelte - Tabbed preset discovery browser

3 tabs for discovering LOOP presets:
1. My Presets - User's saved presets (requires auth)
2. Trending - Popular LOOP types from public sequences
3. Following - Presets from followed users (requires auth)

Also includes the legacy system presets as a fallback.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { LOOP_PRESETS, type LOOPPreset } from "../../../shared/domain/constants/loop-presets";
  import type {
    LOOPPresetTab,
    UserLOOPPreset,
    FollowingPreset,
    LOOPPopularityData,
  } from "../../../shared/domain/models/loop-selection-types";
  import type { LOOPComponent } from "../../../shared/domain/models/generate-models";
  import type { LOOPType } from "../../../circular/domain/models/circular-models";
  import { loopTypeResolver } from "../../../shared/services/implementations/LOOPTypeResolver";
  import LOOPPresetTabs from "./LOOPPresetTabs.svelte";
  import LOOPPresetGrid from "./LOOPPresetGrid.svelte";

  interface Props {
    onSelectComponents: (components: LOOPComponent[]) => void;
    favorites?: string[];
    onToggleFavorite?: (presetId: string) => void;
    presetColumns?: number;
    cardVariant?: 'row' | 'card';
  }

  let { onSelectComponents, favorites = [], onToggleFavorite, presetColumns = 1, cardVariant = 'row' }: Props = $props();

  // State
  let activeTab = $state<LOOPPresetTab>("trending");
  let myPresets = $state<UserLOOPPreset[]>([]);
  let trendingData = $state<LOOPPopularityData[]>([]);
  let followingPresets = $state<FollowingPreset[]>([]);
  let isLoadingMyPresets = $state(false);
  let isLoadingTrending = $state(false);
  let isLoadingFollowing = $state(false);

  // Derived
  const user = $derived(authState.user);
  const isAuthenticated = $derived(!!user);

  // Services (accessed lazily to avoid SSR issues)
  let loopPresetRepository: typeof container.items.loopPresetRepository | null = null;
  let loopPopularityAggregator: typeof container.items.loopPopularityAggregator | null = null;
  let loopFollowingLoader: typeof container.items.loopFollowingLoader | null = null;

  onMount(() => {
    // Access services after mount to avoid SSR issues
    loopPresetRepository = container.items.loopPresetRepository;
    loopPopularityAggregator = container.items.loopPopularityAggregator;
    loopFollowingLoader = container.items.loopFollowingLoader;

    // Load initial data
    loadTrending();
  });

  // Load data when tab changes
  $effect(() => {
    if (activeTab === "my-presets" && isAuthenticated && user) {
      loadMyPresets();
    } else if (activeTab === "trending") {
      loadTrending();
    } else if (activeTab === "following" && isAuthenticated && user) {
      loadFollowing();
    }
  });

  async function loadMyPresets() {
    if (!loopPresetRepository || !user) return;
    isLoadingMyPresets = true;
    try {
      myPresets = await loopPresetRepository.getUserPresets(user.uid);
    } catch (error) {
      console.error("Failed to load user presets:", error);
    } finally {
      isLoadingMyPresets = false;
    }
  }

  async function loadTrending() {
    if (!loopPopularityAggregator) return;
    isLoadingTrending = true;
    try {
      trendingData = await loopPopularityAggregator.getTopPopular(10);
    } catch (error) {
      console.error("Failed to load trending data:", error);
    } finally {
      isLoadingTrending = false;
    }
  }

  async function loadFollowing() {
    if (!loopFollowingLoader || !user) return;
    isLoadingFollowing = true;
    try {
      followingPresets = await loopFollowingLoader.loadFollowingPresets(
        user.uid,
        20
      );
    } catch (error) {
      console.error("Failed to load following presets:", error);
    } finally {
      isLoadingFollowing = false;
    }
  }

  function handleSelectPreset(preset: LOOPPreset | UserLOOPPreset | FollowingPreset) {
    onSelectComponents(preset.components);
  }

  function handleSelectTrending(data: LOOPPopularityData) {
    const components = loopTypeResolver.parseComponents(data.loopType as LOOPType);
    onSelectComponents(Array.from(components));
  }

  function handleTabChange(tab: LOOPPresetTab) {
    activeTab = tab;
  }
</script>

<div class="preset-browser">
  <LOOPPresetTabs
    {activeTab}
    onTabChange={handleTabChange}
    myPresetsCount={myPresets.length}
    trendingCount={trendingData.length}
    followingCount={followingPresets.length}
    {isAuthenticated}
  />

  <div class="tab-content" role="tabpanel" id="panel-{activeTab}">
    {#if activeTab === "my-presets"}
      {#if !isAuthenticated}
        <div class="auth-prompt">
          <i class="fas fa-lock"></i>
          <p>Sign in to save your own presets</p>
        </div>
      {:else}
        <LOOPPresetGrid
          type="user"
          userPresets={myPresets}
          isLoading={isLoadingMyPresets}
          emptyMessage="Create presets by saving your favorite combinations"
          onSelectPreset={handleSelectPreset}
          columns={presetColumns}
          {cardVariant}
        />
      {/if}
    {:else if activeTab === "trending"}
      <LOOPPresetGrid
        type="trending"
        {trendingData}
        isLoading={isLoadingTrending}
        onSelectTrending={handleSelectTrending}
        columns={presetColumns}
        {cardVariant}
      />

      <!-- Fallback to system presets if no trending data -->
      {#if !isLoadingTrending && trendingData.length === 0}
        <div class="fallback-section">
          <h4>Recommended Presets</h4>
          <LOOPPresetGrid
            type="system"
            systemPresets={LOOP_PRESETS.filter((p) => p.featured)}
            {favorites}
            onSelectPreset={handleSelectPreset}
            {onToggleFavorite}
            columns={presetColumns}
            {cardVariant}
          />
        </div>
      {/if}
    {:else if activeTab === "following"}
      {#if !isAuthenticated}
        <div class="auth-prompt">
          <i class="fas fa-users"></i>
          <p>Sign in to see presets from people you follow</p>
        </div>
      {:else}
        <LOOPPresetGrid
          type="following"
          {followingPresets}
          isLoading={isLoadingFollowing}
          emptyMessage="Follow other creators to discover their presets"
          onSelectPreset={handleSelectPreset}
          columns={presetColumns}
          {cardVariant}
        />
      {/if}
    {/if}
  </div>
</div>

<style>
  .preset-browser {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tab-content {
    min-height: 120px;
  }

  .auth-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px 16px;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    border: 1px dashed var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .auth-prompt i {
    font-size: 24px;
    opacity: 0.6;
  }

  .auth-prompt p {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  .fallback-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .fallback-section h4 {
    margin: 0 0 10px 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }
</style>
