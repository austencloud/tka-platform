<script lang="ts">
  /**
   * Achievements Browser Component (Responsive Optimized)
   *
   * Full-screen achievement browser panel with:
   * - Container query support for adaptive layouts
   * - Fluid typography using clamp()
   * - WCAG AAA touch targets (48px minimum)
   * - ResizeObserver for dynamic sizing
   * - Compact/extra-compact modes for mobile
   * - Full accessibility support
   * - Category filtering and complete achievement list
   */

  import { onMount } from "svelte";
  import { container } from "../../di";
  import { authState } from "../../auth/state/authState.svelte";
  import { getLevelProgress } from "../domain/constants/xp-constants";
  import Drawer from "../../foundation/ui/Drawer.svelte";
  import type {
    Achievement,
    DailyChallenge,
    UserAchievement,
    UserChallengeProgress,
  } from "../domain/models/achievement-models";
  import type { IAchievementManager } from "../services/contracts/IAchievementManager";
  import type { IDailyChallengeManager } from "../services/contracts/IDailyChallengeManager";
  import type { IStreakTracker } from "../services/contracts/IStreakTracker";

  // Props
  let {
    isOpen = false,
    onClose = () => {},
  }: { isOpen: boolean; onClose: () => void } = $props();

  // Services
  let achievementService: IAchievementManager | null = $state(null);
  let challengeService: IDailyChallengeManager | null = $state(null);
  let streakService: IStreakTracker | null = $state(null);

  // State
  let stats = $state<any>(null);
  let achievements = $state<
    Array<Achievement & { userProgress: UserAchievement | null }>
  >([]);
  let dailyChallenge = $state<DailyChallenge | null>(null);
  let challengeProgress = $state<UserChallengeProgress | null>(null);
  let currentStreak = $state(0);
  let selectedCategory = $state<Achievement["category"]>("creator");
  let isLoading = $state(true);
  let hasLoadedData = $state(false);

  // Container-aware sizing state
  let panelElement: HTMLElement | null = $state(null);
  let containerWidth = $state(0);
  let _containerHeight = $state(0);

  // Derived - Responsive sizing classes
  let isCompact = $derived(containerWidth < 400);
  let isExtraCompact = $derived(containerWidth < 350);
  let isMobile = $derived(containerWidth < 600);

  // Derived - Data
  let _levelProgress = $derived.by(() => {
    if (!stats) return null;
    return getLevelProgress(stats.totalXP);
  });

  let filteredAchievements = $derived.by(() => {
    return achievements.filter((a) => a.category === selectedCategory);
  });

  let challengeProgressPercent = $derived.by(() => {
    if (!dailyChallenge || !challengeProgress) return 0;
    return Math.round(
      (challengeProgress.progress / dailyChallenge.requirement.target) * 100
    );
  });

  // Initialize services on mount
  onMount(async () => {
    try {
      achievementService = container.items.achievementManager;
      challengeService = container.items.dailyChallengeManager;
      streakService = container.items.streakTracker;
    } catch (err) {
      console.error("Failed to initialize AchievementsPanel services:", err);
      isLoading = false;
    }
  });

  // Track panel dimensions using ResizeObserver
  $effect(() => {
    if (!panelElement) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidth = entry.contentRect.width;
        _containerHeight = entry.contentRect.height;
      }
    });

    resizeObserver.observe(panelElement);

    return () => {
      resizeObserver.disconnect();
    };
  });

  // Load data when panel opens and user is authenticated
  $effect(() => {
    if (isOpen && authState.isAuthenticated && !hasLoadedData) {
      loadData();
    }
  });

  async function loadData() {
    if (!achievementService || !challengeService || !streakService) return;
    if (!authState.isAuthenticated) {
      console.warn("⚠️ Cannot load gamification data: User not authenticated");
      isLoading = false;
      return;
    }

    try {
      isLoading = true;
      [stats, achievements, dailyChallenge, challengeProgress] =
        await Promise.all([
          achievementService.getStats(),
          achievementService.getAllAchievements(),
          challengeService.getTodayChallenge(),
          challengeService.getChallengeProgress(),
        ]);

      const streakData = await streakService.getCurrentStreak();
      currentStreak = streakData.currentStreak;
      hasLoadedData = true;
    } catch (err) {
      console.error("Failed to load gamification data:", err);
    } finally {
      isLoading = false;
    }
  }

  function handleClose() {
    onClose();
  }

  function selectCategory(category: Achievement["category"]) {
    selectedCategory = category;
  }

  // Category icons
  const categoryIcons: Record<Achievement["category"], string> = {
    creator: "fa-palette",
    scholar: "fa-book",
    practitioner: "fa-dumbbell",
    explorer: "fa-magnifying-glass",
    performer: "fa-video",
    trainer: "fa-stopwatch",
    contributor: "fa-comment",
  };

  // Category names
  const categoryNames: Record<Achievement["category"], string> = {
    creator: "Creator",
    scholar: "Scholar",
    practitioner: "Practitioner",
    explorer: "Explorer",
    performer: "Performer",
    trainer: "Trainer",
    contributor: "Contributor",
  };
</script>

<Drawer
  {isOpen}
  onclose={handleClose}
  ariaLabel="Achievements & Challenges"
  class="achievements-sheet"
>
  {#snippet children()}
    <div
      class="achievements-panel"
      class:compact={isCompact}
      class:extra-compact={isExtraCompact}
      class:mobile={isMobile}
      bind:this={panelElement}
    >
      <!-- Header -->
      <div class="panel-header">
        <h2 class="panel-title">
          <i class="fas fa-trophy" aria-hidden="true"></i>
          {#if !isExtraCompact}
            Achievements & Challenges
          {:else}
            Achievements
          {/if}
        </h2>
        <button
          class="close-button"
          onclick={handleClose}
          aria-label="Close achievements panel">×</button
        >
      </div>

      {#if isLoading}
        <div class="loading-container">
          <div class="spinner-large"></div>
          <p>Loading your progress...</p>
        </div>
      {:else}
        <!-- Stats Section -->
        <div class="stats-section">
          <div class="stat-card glass-surface">
            <div class="stat-icon">
              <i class="fas fa-star" aria-hidden="true"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{stats?.currentLevel || 0}</div>
              <div class="stat-label">Level</div>
            </div>
          </div>

          <div class="stat-card glass-surface">
            <div class="stat-icon">
              <i class="fas fa-magic-wand-sparkles" aria-hidden="true"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {stats?.totalXP.toLocaleString() || 0}
              </div>
              <div class="stat-label">Total XP</div>
            </div>
          </div>

          <div class="stat-card glass-surface">
            <div class="stat-icon">
              <i class="fas fa-bullseye" aria-hidden="true"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {stats?.achievementsUnlocked || 0}/{stats?.totalAchievements ||
                  0}
              </div>
              <div class="stat-label">Achievements</div>
            </div>
          </div>

          <div class="stat-card glass-surface">
            <div class="stat-icon">
              <i class="fas fa-fire" aria-hidden="true"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{currentStreak}</div>
              <div class="stat-label">Day Streak</div>
            </div>
          </div>
        </div>

        <!-- Daily Challenge -->
        {#if dailyChallenge}
          <div class="daily-challenge glass-surface">
            <div class="challenge-header">
              <h3>
                <i class="fas fa-bullseye" aria-hidden="true"></i> Daily Challenge
              </h3>
              <span class="difficulty-badge {dailyChallenge.difficulty}"
                >{dailyChallenge.difficulty}</span
              >
            </div>
            <p class="challenge-title">{dailyChallenge.title}</p>
            <p class="challenge-description">{dailyChallenge.description}</p>
            <div class="challenge-progress">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  style="width: {challengeProgressPercent}%"
                ></div>
              </div>
              <span class="progress-text"
                >{challengeProgressPercent}% ({challengeProgress?.progress ||
                  0}/{dailyChallenge.requirement.target})</span
              >
            </div>
            <div class="challenge-reward">+{dailyChallenge.xpReward} XP</div>
          </div>
        {/if}

        <!-- Category Tabs -->
        <div class="category-tabs">
          {#each Object.entries(categoryNames) as [category, name]}
            <button
              class="category-tab"
              class:active={selectedCategory === category}
              onclick={() =>
                selectCategory(category as Achievement["category"])}
              aria-label={`Filter by ${name} achievements`}
              aria-pressed={selectedCategory === category}
            >
              <span class="tab-icon" aria-hidden="true"
                ><i
                  class="fas {categoryIcons[
                    category as Achievement['category']
                  ]}"
                  aria-hidden="true"
                ></i></span
              >
              <span class="tab-name">{name}</span>
            </button>
          {/each}
        </div>

        <!-- Achievements List -->
        <div class="achievements-list">
          {#each filteredAchievements as achievement}
            {@const userProgress = achievement.userProgress}
            {@const isCompleted = userProgress?.isCompleted || false}
            {@const progress = userProgress?.progress || 0}
            {@const progressPercent = Math.round(
              (progress / achievement.requirement.target) * 100
            )}

            <div
              class="achievement-card glass-surface"
              class:completed={isCompleted}
            >
              <div class="achievement-icon">
                <i class="fas {achievement.icon}" aria-hidden="true"></i>
              </div>
              <div class="achievement-content">
                <div class="achievement-header">
                  <h4 class="achievement-title">{achievement.title}</h4>
                  <span class="tier-badge {achievement.tier}"
                    >{achievement.tier}</span
                  >
                </div>
                <p class="achievement-description">{achievement.description}</p>
                <div class="achievement-progress">
                  {#if isCompleted}
                    <span class="completed-badge">✓ Completed</span>
                  {:else}
                    <div class="progress-bar-small">
                      <div
                        class="progress-fill-small"
                        style="width: {progressPercent}%"
                      ></div>
                    </div>
                    <span class="progress-text-small"
                      >{progress}/{achievement.requirement.target}</span
                    >
                  {/if}
                </div>
              </div>
              <div class="achievement-xp">+{achievement.xpReward} XP</div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/snippet}
</Drawer>

<style>
  /* Drawer wrapper styling */
  :global(.achievements-sheet) {
    max-height: 95vh;
    height: 95vh;
  }

  /* Panel with container query support */
  .achievements-panel {
    container-type: inline-size;
    container-name: achievements-panel;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: color-mix(in srgb, var(--theme-panel-bg) 95%, transparent);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  /* Header - Fluid responsive design */
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: clamp(12px, 3cqi, 24px);
    gap: clamp(8px, 2cqi, 16px);
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
  }

  .panel-title {
    font-size: clamp(16px, 4cqi, 24px);
    font-weight: 700;
    color: color-mix(in srgb, var(--theme-text, white) 95%, transparent);
    margin: 0;
    display: flex;
    align-items: center;
    gap: clamp(8px, 2cqi, 12px);
  }

  /* WCAG AAA Touch target (48px minimum) */
  .close-button {
    min-width: var(--min-touch-target, 48px);
    min-height: var(--min-touch-target, 48px);
    width: clamp(48px, 10cqi, 48px);
    height: clamp(48px, 10cqi, 48px);
    border-radius: 50%;
    border: none;
    background: var(--theme-card-bg);
    color: color-mix(in srgb, var(--theme-text, white) 80%, transparent);
    font-size: clamp(24px, 6cqi, 28px);
    line-height: 1;
    cursor: pointer;
    transition: var(--transition-fast);
    flex-shrink: 0;
  }

  .close-button:hover {
    background: var(--theme-stroke-strong);
    transform: rotate(90deg);
  }

  .close-button:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .close-button:active {
    transform: scale(0.95);
  }

  /* Loading */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl);
    gap: var(--spacing-md);
  }

  .spinner-large {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 4px solid var(--theme-stroke);
    border-top-color: var(--theme-text);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Stats Section - Container-aware responsive grid */
  .stats-section {
    display: grid;
    grid-template-columns: repeat(
      auto-fit,
      minmax(clamp(120px, 25cqi, 180px), 1fr)
    );
    gap: clamp(8px, 2cqi, 16px);
    padding: clamp(12px, 3cqi, 24px);
  }

  /* Switch to 2-column on narrow containers */
  @container achievements-panel (max-width: 500px) {
    .stats-section {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* Single column on very narrow containers */
  @container achievements-panel (max-width: 300px) {
    .stats-section {
      grid-template-columns: 1fr;
    }
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5cqi, 12px);
    padding: clamp(10px, 2.5cqi, 16px);
    border-radius: clamp(12px, 3cqi, 16px);
  }

  .stat-icon {
    font-size: clamp(24px, 6cqi, 32px);
    flex-shrink: 0;
  }

  .stat-content {
    flex: 1;
    min-width: 0;
  }

  .stat-value {
    font-size: clamp(18px, 4.5cqi, 24px);
    font-weight: 700;
    color: color-mix(in srgb, var(--theme-text, white) 95%, transparent);
    line-height: 1.2;
  }

  .stat-label {
    font-size: clamp(10px, 2.5cqi, 12px);
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 2px;
  }

  /* Daily Challenge - Fluid spacing */
  .daily-challenge {
    margin: 0 clamp(12px, 3cqi, 24px) clamp(12px, 3cqi, 24px);
    padding: clamp(12px, 3cqi, 24px);
    border-radius: clamp(12px, 3cqi, 16px);
    border: 2px solid
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 30%,
        transparent
      );
  }

  .challenge-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: clamp(8px, 2cqi, 12px);
    margin-bottom: clamp(8px, 2cqi, 12px);
    flex-wrap: wrap;
  }

  .challenge-header h3 {
    font-size: clamp(14px, 3.5cqi, 18px);
    margin: 0;
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5cqi, 8px);
  }

  .difficulty-badge {
    padding: clamp(3px, 1cqi, 4px) clamp(10px, 2.5cqi, 12px);
    border-radius: clamp(8px, 2cqi, 12px);
    font-size: clamp(9px, 2.2cqi, 11px);
    font-weight: 600;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .difficulty-badge.beginner {
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    color: var(--semantic-success);
  }

  .difficulty-badge.intermediate {
    background: color-mix(in srgb, var(--semantic-warning) 20%, transparent);
    color: var(--semantic-warning);
  }

  .difficulty-badge.advanced {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    color: var(--semantic-error);
  }

  .challenge-title {
    font-size: clamp(13px, 3.2cqi, 16px);
    font-weight: 600;
    margin: clamp(6px, 1.5cqi, 8px) 0;
    line-height: 1.4;
  }

  .challenge-description {
    font-size: clamp(12px, 3cqi, 14px);
    color: color-mix(in srgb, var(--theme-text, white) 70%, transparent);
    margin-bottom: clamp(10px, 2.5cqi, 16px);
    line-height: 1.5;
  }

  .challenge-progress {
    display: flex;
    flex-direction: column;
    gap: clamp(4px, 1cqi, 6px);
  }

  .progress-bar {
    height: clamp(6px, 1.5cqi, 8px);
    background: var(--theme-card-bg);
    border-radius: clamp(3px, 0.8cqi, 4px);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--theme-accent, var(--theme-accent)) 0%,
      var(--theme-accent-strong, var(--theme-accent-strong)) 100%
    );
    transition: width var(--transition-normal);
  }

  .progress-text {
    font-size: clamp(10px, 2.5cqi, 12px);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .challenge-reward {
    margin-top: clamp(6px, 1.5cqi, 8px);
    font-weight: 600;
    font-size: clamp(12px, 3cqi, 14px);
    color: var(--semantic-warning);
  }

  /* Category Tabs - Responsive with touch targets */
  .category-tabs {
    display: flex;
    gap: clamp(6px, 1.5cqi, 8px);
    padding: 0 clamp(12px, 3cqi, 24px) clamp(10px, 2.5cqi, 16px);
    overflow-x: auto;
  }

  .category-tabs {
    @apply themed-scrollbar;
  }

  .category-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 1.5cqi, 8px);
    padding: clamp(8px, 2cqi, 10px) clamp(12px, 3cqi, 16px);
    min-height: var(--min-touch-target, 48px);
    border-radius: clamp(10px, 2.5cqi, 14px);
    border: 1px solid var(--theme-stroke-strong);
    background: var(--theme-card-bg, var(--theme-card-bg));
    color: color-mix(in srgb, var(--theme-text, white) 70%, transparent);
    cursor: pointer;
    transition: var(--transition-fast);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .category-tab:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-1px);
  }

  .category-tab:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .category-tab:active {
    transform: scale(0.98);
  }

  .category-tab.active {
    background: linear-gradient(
      135deg,
      var(--theme-accent, var(--theme-accent)) 0%,
      var(--theme-accent-strong, var(--theme-accent-strong)) 100%
    );
    border-color: transparent;
    color: var(--theme-text, white);
  }

  .tab-icon {
    font-size: clamp(14px, 3.5cqi, 16px);
    display: flex;
    align-items: center;
  }

  .tab-name {
    font-size: clamp(11px, 2.8cqi, 13px);
    font-weight: 500;
  }

  /* Hide labels on compact mode, show icons only */
  @container achievements-panel (max-width: 500px) {
    .category-tab .tab-name {
      display: none;
    }

    .category-tab {
      min-width: var(--min-touch-target, 48px);
      padding: clamp(8px, 2cqi, 10px);
    }
  }

  /* Achievements List - Scrollable area with fluid spacing */
  .achievements-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 clamp(12px, 3cqi, 24px) clamp(12px, 3cqi, 24px);
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 2.5cqi, 16px);
  }

  .achievements-list {
    @apply themed-scrollbar;
  }

  .achievement-card {
    display: flex;
    gap: clamp(10px, 2.5cqi, 16px);
    padding: clamp(10px, 2.5cqi, 16px);
    border-radius: clamp(12px, 3cqi, 16px);
    transition: var(--transition-fast);
    border: 1px solid transparent;
  }

  .achievement-card:hover {
    background: var(--theme-card-bg);
    border-color: var(--theme-stroke, var(--theme-stroke));
  }

  .achievement-card.completed {
    border-color: color-mix(in srgb, var(--semantic-success) 30%, transparent);
    background: color-mix(in srgb, var(--semantic-success) 5%, transparent);
  }

  .achievement-icon {
    font-size: clamp(28px, 7cqi, 40px);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(40px, 10cqi, 48px);
    height: clamp(40px, 10cqi, 48px);
  }

  .achievement-content {
    flex: 1;
    min-width: 0;
  }

  .achievement-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: clamp(6px, 1.5cqi, 8px);
    margin-bottom: clamp(4px, 1cqi, 6px);
    flex-wrap: wrap;
  }

  .achievement-title {
    font-size: clamp(13px, 3.2cqi, 16px);
    font-weight: 600;
    margin: 0;
    line-height: 1.3;
    flex: 1;
    min-width: 0;
  }

  .tier-badge {
    padding: clamp(2px, 0.5cqi, 3px) clamp(6px, 1.5cqi, 8px);
    border-radius: clamp(6px, 1.5cqi, 8px);
    font-size: clamp(9px, 2.2cqi, 10px);
    font-weight: 600;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tier-badge.bronze {
    background: color-mix(in srgb, #cd7f32 20%, transparent);
    color: #cd7f32;
  }

  .tier-badge.silver {
    background: color-mix(in srgb, #c0c0c0 20%, transparent);
    color: #c0c0c0;
  }

  .tier-badge.gold {
    background: color-mix(in srgb, var(--semantic-warning) 20%, transparent);
    color: var(--semantic-warning);
  }

  .tier-badge.platinum {
    background: color-mix(in srgb, #e5e4e2 20%, transparent);
    color: #e5e4e2;
  }

  .achievement-description {
    font-size: clamp(11px, 2.8cqi, 14px);
    color: color-mix(in srgb, var(--theme-text, white) 70%, transparent);
    margin-bottom: clamp(6px, 1.5cqi, 8px);
    line-height: 1.4;
  }

  /* Hide description on extra-compact mode */
  @container achievements-panel (max-width: 352px) {
    .achievement-description {
      display: none;
    }
  }

  .achievement-progress {
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5cqi, 8px);
  }

  .completed-badge {
    color: var(--semantic-success);
    font-weight: 600;
    font-size: clamp(11px, 2.8cqi, 14px);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .progress-bar-small {
    flex: 1;
    height: clamp(4px, 1cqi, 6px);
    background: var(--theme-card-bg);
    border-radius: clamp(2px, 0.5cqi, 3px);
    overflow: hidden;
    min-width: 60px;
  }

  .progress-fill-small {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--theme-accent, var(--theme-accent)) 0%,
      var(--theme-accent-strong, var(--theme-accent-strong)) 100%
    );
    transition: width var(--transition-normal);
  }

  .progress-text-small {
    font-size: clamp(10px, 2.5cqi, 12px);
    color: var(--theme-text-dim, var(--theme-text-dim));
    white-space: nowrap;
  }

  .achievement-xp {
    flex-shrink: 0;
    font-weight: 600;
    font-size: clamp(11px, 2.8cqi, 14px);
    color: var(--semantic-warning);
    white-space: nowrap;
  }

  /* Compact mode adjustments */
  @container achievements-panel (max-width: 400px) {
    .panel-header {
      padding: clamp(10px, 2.5cqi, 12px);
    }

    .stat-card {
      padding: clamp(8px, 2cqi, 10px);
    }

    .achievement-card {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .achievement-header {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
  }

  /* Extra compact mode */
  @container achievements-panel (max-width: 352px) {
    .daily-challenge {
      margin: 0 clamp(8px, 2cqi, 12px) clamp(8px, 2cqi, 12px);
      padding: clamp(10px, 2.5cqi, 12px);
    }

    .challenge-header h3 {
      font-size: clamp(12px, 3cqi, 14px);
    }
  }

  /* Reduced Motion Support */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }

    .spinner-large {
      animation: none;
    }

    .close-button:hover,
    .category-tab:hover,
    .achievement-card:hover {
      transform: none !important;
    }
  }

  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .panel-header {
      border-bottom-color: var(--theme-stroke-strong);
    }

    .category-tab {
      border-color: var(--theme-stroke-strong);
    }

    .achievement-card {
      border-color: var(--theme-stroke-strong);
    }
  }
</style>
