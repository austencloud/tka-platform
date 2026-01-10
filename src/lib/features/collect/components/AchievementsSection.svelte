<!--
  AchievementsSection.svelte - Achievements summary in Collection module

  Displays:
  - Compact stats (Level, XP, Achievements count, Streak)
  - Recent 3 achievements
  - "View All" button that opens AchievementsBrowser panel
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { getLevelProgress } from "$lib/shared/gamification/domain/constants/xp-constants";
  import type { IAchievementManager } from "$lib/shared/gamification/services/contracts/IAchievementManager";
  import type { IStreakTracker } from "$lib/shared/gamification/services/contracts/IStreakTracker";
  import type { ILeaderboardManager } from "$lib/shared/community/services/contracts/ILeaderboardManager";
  import type { LeaderboardCategory } from "$lib/shared/community/domain/models/leaderboard-models";
  import AchievementsBrowser from "$lib/shared/gamification/components/AchievementsBrowser.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // Services
  let achievementService: IAchievementManager | null = $state(null);
  let streakService: IStreakTracker | null = $state(null);
  let leaderboardService: ILeaderboardManager | null = $state(null);
  let hapticService: IHapticFeedback | undefined;

  // State
  let stats = $state<any>(null);
  let recentAchievements = $state<any[]>([]);
  let currentStreak = $state(0);
  let isLoading = $state(true);
  let isBrowserOpen = $state(false);

  // Personal rankings state
  interface UserRanks {
    xp: number | null;
    level: number | null;
    sequences: number | null;
    achievements: number | null;
    streak: number | null;
  }
  let userRanks = $state<UserRanks>({
    xp: null,
    level: null,
    sequences: null,
    achievements: null,
    streak: null,
  });
  let isLoadingRanks = $state(false);

  // Container-aware sizing
  let sectionElement: HTMLElement | null = $state(null);
  let containerWidth = $state(0);
  let isCompact = $derived(containerWidth < 500);

  // Track dimensions
  $effect(() => {
    if (!sectionElement) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidth = entry.contentRect.width;
      }
    });

    resizeObserver.observe(sectionElement);
    return () => resizeObserver.disconnect();
  });

  // Initialize services
  onMount(async () => {
    hapticService = container.items.hapticFeedback;
    try {
      achievementService = container.items.achievementManager;
      streakService = container.items.streakTracker;
      leaderboardService = container.items.leaderboardManager;
      await loadData();
      // Load ranks in background (non-blocking)
      loadUserRanks();
    } catch (err) {
      console.error("Failed to initialize AchievementsSection:", err);
      isLoading = false;
    }
  });

  async function loadData() {
    if (!achievementService || !streakService || !authState.isAuthenticated) {
      isLoading = false;
      return;
    }

    try {
      isLoading = true;
      const [statsData, achievementsData, streakData] = await Promise.all([
        achievementService.getStats(),
        achievementService.getAllAchievements(),
        streakService.getCurrentStreak(),
      ]);

      stats = statsData;
      currentStreak = streakData.currentStreak;

      // Get recent 3 completed achievements
      recentAchievements = achievementsData
        .filter((a) => a.userProgress?.isCompleted)
        .sort(
          (a, b) =>
            (b.userProgress?.unlockedAt?.getTime() || 0) -
            (a.userProgress?.unlockedAt?.getTime() || 0)
        )
        .slice(0, 3);
    } catch (err) {
      console.error("Failed to load achievements data:", err);
    } finally {
      isLoading = false;
    }
  }

  function openBrowser() {
    hapticService?.trigger("selection");
    isBrowserOpen = true;
  }

  function closeBrowser() {
    hapticService?.trigger("selection");
    isBrowserOpen = false;
  }

  async function loadUserRanks() {
    if (!leaderboardService || !authState.isAuthenticated) return;

    isLoadingRanks = true;
    try {
      // Fetch ranks in parallel
      const [xpRank, levelRank, sequencesRank, achievementsRank, streakRank] =
        await Promise.all([
          leaderboardService.getCurrentUserRank("xp"),
          leaderboardService.getCurrentUserRank("level"),
          leaderboardService.getCurrentUserRank("sequences"),
          leaderboardService.getCurrentUserRank("achievements"),
          leaderboardService.getCurrentUserRank("streak"),
        ]);

      userRanks = {
        xp: xpRank,
        level: levelRank,
        sequences: sequencesRank,
        achievements: achievementsRank,
        streak: streakRank,
      };
    } catch (err) {
      console.error("Failed to load user ranks:", err);
    } finally {
      isLoadingRanks = false;
    }
  }

  // Check if any ranks are available
  let hasRanks = $derived(
    userRanks.xp !== null ||
      userRanks.level !== null ||
      userRanks.sequences !== null ||
      userRanks.achievements !== null ||
      userRanks.streak !== null
  );
</script>

<div class="achievements-section" bind:this={sectionElement}>
  {#if isLoading}
    <div class="loading-container">
      <div class="spinner"></div>
      <p>{t("gamification_loading_achievements")}</p>
    </div>
  {:else if !authState.isAuthenticated}
    <div class="auth-required">
      <i class="fas fa-lock" aria-hidden="true"></i>
      <h3>{t("auth_sign_in_required")}</h3>
      <p>{t("gamification_sign_in_achievements")}</p>
    </div>
  {:else}
    <!-- Stats Grid -->
    <div class="stats-grid" class:compact={isCompact}>
      <div class="stat-card glass-surface">
        <div class="stat-icon">
          <i class="fas fa-star" aria-hidden="true"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{stats?.currentLevel || 0}</div>
          <div class="stat-label">{t("gamification_level")}</div>
        </div>
      </div>

      <div class="stat-card glass-surface">
        <div class="stat-icon">
          <i class="fas fa-magic-wand-sparkles" aria-hidden="true"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{stats?.totalXP.toLocaleString() || 0}</div>
          <div class="stat-label">Total XP</div>
        </div>
      </div>

      <div class="stat-card glass-surface">
        <div class="stat-icon">
          <i class="fas fa-trophy" aria-hidden="true"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">
            {stats?.achievementsUnlocked || 0}/{stats?.totalAchievements || 0}
          </div>
          <div class="stat-label">{t("gamification_achievements")}</div>
        </div>
      </div>

      <div class="stat-card glass-surface">
        <div class="stat-icon">
          <i class="fas fa-fire" aria-hidden="true"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{currentStreak}</div>
          <div class="stat-label">{t("gamification_streak")}</div>
        </div>
      </div>
    </div>

    <!-- Your Rankings (subtle, personal progress focus) -->
    {#if hasRanks}
      <div class="rankings-section">
        <div class="section-header">
          <h3>
            <i class="fas fa-chart-line" aria-hidden="true"></i> Your Rankings
          </h3>
        </div>
        <div class="rankings-grid" class:compact={isCompact}>
          {#if userRanks.xp !== null}
            <div class="rank-badge glass-surface">
              <span class="rank-value">#{userRanks.xp}</span>
              <span class="rank-label">XP</span>
            </div>
          {/if}
          {#if userRanks.level !== null}
            <div class="rank-badge glass-surface">
              <span class="rank-value">#{userRanks.level}</span>
              <span class="rank-label">Level</span>
            </div>
          {/if}
          {#if userRanks.sequences !== null}
            <div class="rank-badge glass-surface">
              <span class="rank-value">#{userRanks.sequences}</span>
              <span class="rank-label">Sequences</span>
            </div>
          {/if}
          {#if userRanks.achievements !== null}
            <div class="rank-badge glass-surface">
              <span class="rank-value">#{userRanks.achievements}</span>
              <span class="rank-label">Achievements</span>
            </div>
          {/if}
          {#if userRanks.streak !== null}
            <div class="rank-badge glass-surface">
              <span class="rank-value">#{userRanks.streak}</span>
              <span class="rank-label">Streak</span>
            </div>
          {/if}
        </div>
      </div>
    {:else if isLoadingRanks}
      <div class="rankings-section">
        <div class="section-header">
          <h3>
            <i class="fas fa-chart-line" aria-hidden="true"></i> Your Rankings
          </h3>
        </div>
        <div class="rankings-loading">
          <span>Loading rankings...</span>
        </div>
      </div>
    {/if}

    <!-- Recent Achievements -->
    <div class="recent-section">
      <div class="section-header">
        <h3>
          <i class="fas fa-trophy" aria-hidden="true"></i> Recent Achievements
        </h3>
        <button class="view-all-button" onclick={openBrowser}>
          View All <i class="fas fa-arrow-right" aria-hidden="true"></i>
        </button>
      </div>

      {#if recentAchievements.length === 0}
        <div class="empty-state">
          <i class="fas fa-trophy" aria-hidden="true"></i>
          <p>No achievements unlocked yet</p>
          <p class="hint">
            Complete challenges to earn your first achievement!
          </p>
        </div>
      {:else}
        <div class="collect-achievements-grid">
          {#each recentAchievements as achievement}
            <div class="achievement-item glass-surface">
              <div class="achievement-icon">
                <i class="fas {achievement.icon}" aria-hidden="true"></i>
              </div>
              <div class="achievement-info">
                <h4>{achievement.title}</h4>
                <p>{achievement.description}</p>
                <span class="achievement-xp">+{achievement.xpReward} XP</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Full Achievements Browser Panel -->
<AchievementsBrowser isOpen={isBrowserOpen} onClose={closeBrowser} />

<style>
  .achievements-section {
    container-type: inline-size;
    container-name: achievements-section;
    display: flex;
    flex-direction: column;
    gap: clamp(16px, 4cqi, 24px);
    padding: clamp(16px, 4cqi, 24px);
    height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .achievements-section::-webkit-scrollbar {
    width: 8px;
  }

  .achievements-section::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }

  /* Loading & Empty States */
  .loading-container,
  .auth-required,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: clamp(24px, 6cqi, 48px);
    text-align: center;
    gap: clamp(12px, 3cqi, 16px);
  }

  .spinner {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 4px solid rgba(255, 255, 255, 0.2);
    border-top-color: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .auth-required i,
  .empty-state i {
    font-size: clamp(32px, 8cqi, 48px);
    opacity: 0.5;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(
      auto-fit,
      minmax(clamp(140px, 30cqi, 200px), 1fr)
    );
    gap: clamp(12px, 3cqi, 16px);
  }

  @container achievements-section (max-width: 600px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @container achievements-section (max-width: 352px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2cqi, 12px);
    padding: clamp(12px, 3cqi, 16px);
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
    color: rgba(255, 255, 255, 0.95);
    line-height: 1.2;
  }

  .stat-label {
    font-size: clamp(10px, 2.5cqi, 12px);
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 2px;
  }

  /* Rankings Section */
  .rankings-section {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3cqi, 16px);
  }

  .rankings-grid {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(8px, 2cqi, 12px);
  }

  .rank-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: clamp(10px, 2.5cqi, 14px) clamp(14px, 3.5cqi, 20px);
    border-radius: clamp(10px, 2.5cqi, 14px);
    min-width: clamp(70px, 18cqi, 90px);
    border: 1px solid var(--theme-stroke);
  }

  .rank-value {
    font-size: clamp(16px, 4cqi, 20px);
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    line-height: 1.2;
  }

  .rank-label {
    font-size: clamp(10px, 2.5cqi, 12px);
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 2px;
  }

  .rankings-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(12px, 3cqi, 16px);
    color: var(--theme-text-dim);
    font-size: clamp(12px, 3cqi, 14px);
  }

  /* Recent Achievements Section */
  .recent-section {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3cqi, 16px);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: clamp(8px, 2cqi, 12px);
    flex-wrap: wrap;
  }

  .section-header h3 {
    font-size: clamp(16px, 4cqi, 20px);
    font-weight: 600;
    margin: 0;
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5cqi, 8px);
  }

  .view-all-button {
    padding: clamp(8px, 2cqi, 10px) clamp(12px, 3cqi, 16px);
    border-radius: clamp(8px, 2cqi, 10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font-size: clamp(12px, 3cqi, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5cqi, 8px);
  }

  .view-all-button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }

  .view-all-button:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  /* Achievements Grid */
  .collect-achievements-grid {
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 2.5cqi, 12px);
  }

  .achievement-item {
    display: flex;
    gap: clamp(12px, 3cqi, 16px);
    padding: clamp(12px, 3cqi, 16px);
    border-radius: clamp(12px, 3cqi, 16px);
    border: 1px solid rgba(76, 175, 80, 0.3);
  }

  .achievement-icon {
    font-size: clamp(28px, 7cqi, 36px);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(48px, 12cqi, 60px);
    height: clamp(48px, 12cqi, 60px);
  }

  .achievement-info {
    flex: 1;
    min-width: 0;
  }

  .achievement-info h4 {
    font-size: clamp(14px, 3.5cqi, 16px);
    font-weight: 600;
    margin: 0 0 clamp(4px, 1cqi, 6px);
    color: rgba(255, 255, 255, 0.95);
  }

  .achievement-info p {
    font-size: clamp(12px, 3cqi, 14px);
    color: var(--theme-text-dim);
    margin: 0 0 clamp(6px, 1.5cqi, 8px);
    line-height: 1.4;
  }

  .achievement-xp {
    font-size: clamp(11px, 2.8cqi, 13px);
    font-weight: 600;
    color: #ffd700;
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }

    .spinner {
      animation: none;
    }
  }
</style>
