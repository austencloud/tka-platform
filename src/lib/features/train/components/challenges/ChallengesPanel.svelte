<!--
  ChallengesPanel.svelte - Train Challenges Panel

  Displays available train challenges with filtering and sorting.
  Modern mobile-first design with slide-up filter panel and 52px touch targets.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import { getTrainChallengeManager } from "$lib/features/train/get-train-challenge-manager";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type {
    TrainChallengeFilter,
    TrainChallengeSortBy,
  } from "../../domain/models/train-challenge-models";
  import {
    getDifficultySortIndex,
    type ChallengeDifficulty,
  } from "$lib/shared/gamification/domain/models/achievement-models";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { activeChallengeState } from "../../state/active-challenge-state.svelte";
  import { trainChallengesState } from "../../state/train-challenges-state.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import ChallengeCard from "./ChallengeCard.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // Services
  const challengeService = getTrainChallengeManager();
  const hapticService = getHapticFeedback();

  // Local UI state (filter preferences)
  let filter = $state<TrainChallengeFilter>("all");
  let sortBy = $state<TrainChallengeSortBy>("difficulty");
  let difficultyFilter = $state<ChallengeDifficulty | null>(null);

  // Filter panel state
  let isFilterPanelOpen = $state(false);

  // Get cached data from state (reactive getters)
  const challenges = $derived(trainChallengesState.challenges);
  const progressMap = $derived(trainChallengesState.progressMap);
  const loading = $derived(
    trainChallengesState.isLoading && !trainChallengesState.isLoaded
  );

  // Stats
  const stats = $derived.by(() => {
    const total = challenges.length;
    const completed = challenges.filter(
      (c) => progressMap.get(c.id)?.isCompleted
    ).length;
    const available = total - completed;

    return { total, completed, available };
  });

  // Active filter count for badge
  const activeFilterCount = $derived.by(() => {
    let count = 0;
    if (filter !== "all") count++;
    if (difficultyFilter !== null) count++;
    if (sortBy !== "difficulty") count++;
    return count;
  });

  // Filtered challenges
  const filteredChallenges = $derived.by(() => {
    let filtered = [...challenges];

    // Apply filter
    if (filter === "completed") {
      filtered = filtered.filter((c) => progressMap.get(c.id)?.isCompleted);
    } else if (filter === "available") {
      filtered = filtered.filter((c) => !progressMap.get(c.id)?.isCompleted);
    }

    // Apply difficulty filter
    if (difficultyFilter) {
      filtered = filtered.filter((c) => c.difficulty === difficultyFilter);
    }

    // Apply sorting
    switch (sortBy) {
      case "difficulty":
        filtered.sort(
          (a, b) =>
            getDifficultySortIndex(a.difficulty) -
            getDifficultySortIndex(b.difficulty)
        );
        break;
      case "xp":
        filtered.sort((a, b) => b.xpReward - a.xpReward);
        break;
      case "newest":
        filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case "expiring":
        filtered = filtered
          .filter((c) => c.endDate)
          .sort((a, b) => {
            if (!a.endDate || !b.endDate) return 0;
            return a.endDate.getTime() - b.endDate.getTime();
          });
        break;
    }

    return filtered;
  });

  // Load challenges (will use cache if already loaded)
  onMount(async () => {
    await trainChallengesState.loadChallenges(challengeService);
  });

  function handleChallengeStart(challengeId: string) {
    hapticService?.trigger("selection");
    // Find the challenge
    const challenge = challenges.find((c) => c.id === challengeId);
    if (!challenge) {
      console.error(`Challenge not found: ${challengeId}`);
      return;
    }

    // Set as active challenge
    activeChallengeState.setActiveChallenge(challenge);

    // Navigate to practice tab
    navigationState.setActiveTab("practice");
  }

  function clearAllFilters() {
    hapticService?.trigger("selection");
    filter = "all";
    sortBy = "difficulty";
    difficultyFilter = null;
  }

  function handleFilterChange(newFilter: TrainChallengeFilter) {
    hapticService?.trigger("selection");
    filter = newFilter;
  }

  function handleSortChange(newSort: TrainChallengeSortBy) {
    hapticService?.trigger("selection");
    sortBy = newSort;
  }

  function handleDifficultyChange(newDifficulty: ChallengeDifficulty | null) {
    hapticService?.trigger("selection");
    difficultyFilter = newDifficulty;
  }

  function openFilterPanel() {
    hapticService?.trigger("selection");
    isFilterPanelOpen = true;
  }

  function closeFilterPanel() {
    hapticService?.trigger("selection");
    isFilterPanelOpen = false;
  }
</script>

<div class="challenges-panel">
  <!-- Compact Single-Row Header -->
  <header class="header">
    <h1>{t("train_challenges_title")}</h1>

    <!-- Quick Filter Chips - Inline -->
    {#if !loading}
      <div class="quick-filters">
        <button
          class="chip"
          class:active={filter === "all"}
          onclick={() => handleFilterChange("all")}
        >
          {t("train_filter_all")}
        </button>
        <button
          class="chip"
          class:active={filter === "available"}
          onclick={() => handleFilterChange("available")}
        >
          {t("train_filter_available")}
        </button>
        <button
          class="chip"
          class:active={filter === "completed"}
          onclick={() => handleFilterChange("completed")}
        >
          {t("train_filter_done")}
        </button>
      </div>

      <button
        class="filter-button"
        class:has-filters={activeFilterCount > 0}
        onclick={openFilterPanel}
        aria-label="Open filters"
      >
        <i class="fas fa-sliders-h" aria-hidden="true"></i>
        {#if activeFilterCount > 0}
          <span class="filter-badge">{activeFilterCount}</span>
        {/if}
      </button>
    {/if}
  </header>

  <!-- Content -->
  <div class="content">
    {#if loading}
      <div
        class="loading-state"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <ProgressRing percent={-1} size={32} strokeWidth={3} />
        <p>{t("train_loading_challenges")}</p>
      </div>
    {:else if filteredChallenges.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <i class="fas fa-trophy" aria-hidden="true"></i>
        </div>
        <h2>{t("train_no_challenges")}</h2>
        <p>
          {#if filter === "completed"}
            {t("train_no_completed_yet")}
          {:else if filter === "available"}
            {t("train_all_completed")}
          {:else}
            {t("train_none_available")}
          {/if}
        </p>
        {#if activeFilterCount > 0}
          <button class="clear-filters-btn" onclick={clearAllFilters}>
            {t("train_clear_filters")}
          </button>
        {/if}
      </div>
    {:else}
      <div class="challenges-container">
        <div class="challenges-grid">
          {#each filteredChallenges as challenge (challenge.id)}
            <ChallengeCard
              {challenge}
              progress={progressMap.get(challenge.id) ?? null}
              onStart={handleChallengeStart}
            />
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Slide-Up Filter Panel -->
<Drawer
  bind:isOpen={isFilterPanelOpen}
  placement="bottom"
  class="filter-drawer"
>
  <div class="filter-panel">
    <div class="filter-panel-header">
      <h2>{t("train_filters_sort")}</h2>
      <button
        class="close-btn"
        onclick={closeFilterPanel}
        aria-label={t("action_close")}
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    <div class="filter-panel-content">
      <!-- Sort Options -->
      <section class="filter-section">
        <h3>{t("train_sort_by")}</h3>
        <div class="option-grid">
          <button
            class="option-btn"
            class:active={sortBy === "difficulty"}
            onclick={() => handleSortChange("difficulty")}
          >
            <i class="fas fa-layer-group" aria-hidden="true"></i>
            <span>{t("train_sort_difficulty")}</span>
          </button>
          <button
            class="option-btn"
            class:active={sortBy === "xp"}
            onclick={() => handleSortChange("xp")}
          >
            <i class="fas fa-star" aria-hidden="true"></i>
            <span>{t("train_sort_xp")}</span>
          </button>
          <button
            class="option-btn"
            class:active={sortBy === "newest"}
            onclick={() => handleSortChange("newest")}
          >
            <i class="fas fa-clock" aria-hidden="true"></i>
            <span>{t("train_sort_newest")}</span>
          </button>
        </div>
      </section>

      <!-- Difficulty Filter -->
      <section class="filter-section">
        <h3>{t("train_sort_difficulty")}</h3>
        <div class="option-grid">
          <button
            class="option-btn"
            class:active={difficultyFilter === null}
            onclick={() => handleDifficultyChange(null)}
          >
            <span>{t("train_difficulty_all")}</span>
          </button>
          <button
            class="option-btn difficulty-easy"
            class:active={difficultyFilter === "easy"}
            onclick={() => handleDifficultyChange("easy")}
          >
            <span>{t("train_difficulty_easy")}</span>
          </button>
          <button
            class="option-btn difficulty-medium"
            class:active={difficultyFilter === "medium"}
            onclick={() => handleDifficultyChange("medium")}
          >
            <span>{t("train_difficulty_medium")}</span>
          </button>
          <button
            class="option-btn difficulty-hard"
            class:active={difficultyFilter === "hard"}
            onclick={() => handleDifficultyChange("hard")}
          >
            <span>{t("train_difficulty_hard")}</span>
          </button>
          <button
            class="option-btn difficulty-expert"
            class:active={difficultyFilter === "expert"}
            onclick={() => handleDifficultyChange("expert")}
          >
            <span>{t("train_difficulty_expert")}</span>
          </button>
        </div>
      </section>
    </div>

    <div class="filter-panel-footer">
      <button class="reset-btn" onclick={clearAllFilters}>{t("train_reset_all")}</button>
      <button class="apply-btn" onclick={closeFilterPanel}>
        {t("train_show_results", { count: filteredChallenges.length.toString() })}
      </button>
    </div>
  </div>
</Drawer>

<style>
  /* ============================================================================
     BASE STYLES - 2026 Bento Grid with Vibrant Cards
     ============================================================================ */
  .challenges-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
  }

  /* Compact Single-Row Header */
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: transparent;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .header h1 {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--theme-text);
    letter-spacing: -0.02em;
    flex-shrink: 0;
  }

  /* Filter Button - 52px touch target */
  .filter-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    position: relative;
    flex-shrink: 0;
  }

  .filter-button:hover {
    background: var(--theme-stroke);
    color: var(--theme-text, white);
  }

  .filter-button:active {
    transform: scale(0.95);
  }

  .filter-button.has-filters {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.2),
      rgba(220, 38, 38, 0.15)
    );
    border-color: rgba(239, 68, 68, 0.4);
    color: var(--semantic-error);
  }

  .filter-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f43f5e, #ec4899);
    border-radius: 9px;
    font-size: var(--font-size-compact);
    font-weight: 700;
    color: white;
    padding: 0 5px;
  }

  /* Quick Filter Chips - Inline with header */
  .quick-filters {
    display: flex;
    gap: 6px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .quick-filters::-webkit-scrollbar {
    display: none;
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 52px;
    padding: 0 18px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 24px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .chip:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, var(--theme-text));
  }

  .chip:active {
    transform: scale(0.97);
  }

  .chip.active {
    background: linear-gradient(
      135deg,
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 25%,
        transparent
      ),
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 20%,
        transparent
      )
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 40%,
      transparent
    );
    color: var(--theme-text, white);
  }

  /* Content Area */
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .challenges-container {
    max-width: 1400px;
    margin: 0 auto;
  }

  .challenges-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Loading State */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 16px;
  }

  .loading-state p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 16px;
    text-align: center;
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      var(--theme-card-bg, var(--theme-card-bg)),
      var(--theme-card-bg)
    );
    border-radius: 24px;
    font-size: var(--font-size-3xl);
    color: var(--theme-stroke-strong);
  }

  .empty-state h2 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text, var(--theme-text));
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
    max-width: 280px;
    line-height: 1.5;
  }

  .clear-filters-btn {
    height: 52px;
    padding: 0 24px;
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke-strong, var(--theme-stroke-strong));
    border-radius: 24px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text, white);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .clear-filters-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 12%, transparent);
  }

  /* ============================================================================
     SLIDE-UP FILTER PANEL STYLES
     ============================================================================ */
  .filter-panel {
    display: flex;
    flex-direction: column;
    background: linear-gradient(
      180deg,
      rgba(25, 25, 40, 0.98),
      rgba(15, 15, 25, 1)
    );
    border-radius: 24px 24px 0 0;
    max-height: 80vh;
    overflow: hidden;
  }

  .filter-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .filter-panel-header h2 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--theme-text, white);
  }

  .close-btn {
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: none;
    border-radius: 14px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-lg);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .close-btn:hover {
    background: var(--theme-stroke);
    color: var(--theme-text, white);
  }

  .filter-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .filter-section {
    margin-bottom: 28px;
  }

  .filter-section:last-child {
    margin-bottom: 0;
  }

  .filter-section h3 {
    margin: 0 0 12px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .option-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  /* Option Buttons - 52px touch targets */
  .option-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 72px;
    padding: 12px 8px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .option-btn i {
    font-size: var(--font-size-xl);
    opacity: 0.7;
  }

  .option-btn span {
    font-size: var(--font-size-compact);
    font-weight: 500;
  }

  .option-btn:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, white);
  }

  .option-btn:active {
    transform: scale(0.97);
  }

  .option-btn.active {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 25%, transparent),
      color-mix(in srgb, var(--theme-accent) 20%, transparent)
    );
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    color: white;
  }

  .option-btn.active i {
    opacity: 1;
  }

  /* Difficulty-specific colors */
  .option-btn.difficulty-easy.active {
    background: linear-gradient(
      135deg,
      rgba(34, 197, 94, 0.2),
      rgba(22, 163, 74, 0.15)
    );
    border-color: rgba(34, 197, 94, 0.5);
  }

  .option-btn.difficulty-medium.active {
    background: linear-gradient(
      135deg,
      rgba(234, 179, 8, 0.2),
      rgba(202, 138, 4, 0.15)
    );
    border-color: rgba(234, 179, 8, 0.5);
  }

  .option-btn.difficulty-hard.active {
    background: linear-gradient(
      135deg,
      rgba(249, 115, 22, 0.2),
      rgba(234, 88, 12, 0.15)
    );
    border-color: rgba(249, 115, 22, 0.5);
  }

  .option-btn.difficulty-expert.active {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.2),
      rgba(220, 38, 38, 0.15)
    );
    border-color: rgba(239, 68, 68, 0.5);
  }

  /* Filter Panel Footer */
  .filter-panel-footer {
    display: flex;
    gap: 12px;
    padding: 16px 20px 24px;
    border-top: 1px solid var(--theme-stroke);
  }

  .reset-btn {
    flex: 0 0 auto;
    height: 52px;
    padding: 0 24px;
    background: transparent;
    border: 1px solid var(--theme-stroke-strong, var(--theme-stroke-strong));
    border-radius: 14px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .reset-btn:hover {
    background: var(--theme-card-bg);
    color: var(--theme-text, white);
  }

  .apply-btn {
    flex: 1;
    height: 52px;
    background: linear-gradient(
      135deg,
      var(--semantic-error),
      var(--semantic-error)
    );
    border: none;
    border-radius: 14px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: white;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .apply-btn:hover {
    filter: brightness(1.1);
  }

  .apply-btn:active {
    transform: scale(0.98);
  }

  /* ============================================================================
     LANDSLOOPE MOBILE - Compact layout with accessible touch targets
     ============================================================================ */
  @media (max-height: 500px) and (orientation: landscape) {
    .header {
      padding: 6px 12px;
      gap: 8px;
    }

    .header h1 {
      font-size: var(--font-size-base);
    }

    /* Visual size reduced but touch target maintained via pseudo-element */
    .filter-button {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      font-size: var(--font-size-sm);
      position: relative;
    }

    .filter-button::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      min-width: 52px;
      min-height: 52px;
    }

    /* Visual size reduced but touch target maintained via pseudo-element */
    .chip {
      height: 36px;
      padding: 0 12px;
      font-size: var(--font-size-compact);
      border-radius: 18px;
      position: relative;
    }

    .chip::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      min-width: 100%;
      min-height: 52px;
    }

    .content {
      padding: 10px 12px;
    }

    .challenges-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
  }

  /* ============================================================================
     TABLET (641px+)
     ============================================================================ */
  @media (min-width: 641px) {
    .header {
      padding: 18px 28px;
      gap: 16px;
    }

    .header h1 {
      font-size: var(--font-size-xl);
    }

    .chip {
      height: 52px;
      padding: 0 20px;
      font-size: var(--font-size-sm);
    }

    .content {
      padding: 24px 28px;
    }

    .challenges-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }

    .option-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  /* ============================================================================
     DESKTOP (1025px+)
     ============================================================================ */
  @media (min-width: 1025px) {
    .header {
      padding: 20px 36px;
    }

    .header h1 {
      font-size: var(--font-size-2xl);
    }

    .content {
      padding: 28px 36px;
    }

    .challenges-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }

    .option-grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .chip,
    .filter-button,
    .option-btn,
    .apply-btn,
    .reset-btn,
    .close-btn {
      transition: none;
    }

  }
</style>
