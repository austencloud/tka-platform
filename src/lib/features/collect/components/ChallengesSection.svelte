<!--
  ChallengesSection.svelte - Daily challenges and active quests

  Displays:
  - Today's daily challenge with progress
  - Active quests list
  - Challenge completion tracking
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import type { IDailyChallengeManager } from "$lib/shared/gamification/services/contracts/IDailyChallengeManager";
  import type {
    DailyChallenge,
    UserChallengeProgress,
  } from "$lib/shared/gamification/domain/models/achievement-models";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // Services
  let challengeService: IDailyChallengeManager | null = $state(null);

  // State
  let dailyChallenge = $state<DailyChallenge | null>(null);
  let challengeProgress = $state<UserChallengeProgress | null>(null);
  let isLoading = $state(true);

  // Container-aware sizing
  let sectionElement: HTMLElement | null = $state(null);
  let containerWidth = $state(0);
  let isCompact = $derived(containerWidth < 500);

  // Derived
  let challengeProgressPercent = $derived.by(() => {
    if (!dailyChallenge || !challengeProgress) return 0;
    return Math.round(
      (challengeProgress.progress / dailyChallenge.requirement.target) * 100
    );
  });

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
    try {
      challengeService = container.items.dailyChallengeManager;
      await loadData();
    } catch (err) {
      console.error("Failed to initialize ChallengesSection:", err);
      isLoading = false;
    }
  });

  async function loadData() {
    if (!challengeService || !authState.isAuthenticated) {
      isLoading = false;
      return;
    }

    try {
      isLoading = true;
      const [challenge, progress] = await Promise.all([
        challengeService.getTodayChallenge(),
        challengeService.getChallengeProgress(),
      ]);

      dailyChallenge = challenge;
      challengeProgress = progress;
    } catch (err) {
      console.error("Failed to load challenges data:", err);
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="challenges-section" bind:this={sectionElement}>
  {#if isLoading}
    <div class="loading-container">
      <div class="spinner"></div>
      <p>{t("gamification_loading_challenges")}</p>
    </div>
  {:else if !authState.isAuthenticated}
    <div class="auth-required">
      <i class="fas fa-lock" aria-hidden="true"></i>
      <h3>{t("auth_sign_in_required")}</h3>
      <p>{t("gamification_sign_in_challenges")}</p>
    </div>
  {:else if !dailyChallenge}
    <div class="empty-state">
      <i class="fas fa-calendar-check" aria-hidden="true"></i>
      <h3>{t("gamification_no_challenge_today")}</h3>
      <p>Check back tomorrow for a new daily challenge!</p>
    </div>
  {:else}
    <!-- Daily Challenge Card -->
    <div class="daily-challenge glass-surface">
      <div class="challenge-header">
        <h3>
          <i class="fas fa-bullseye" aria-hidden="true"></i> {t("gamification_daily_challenge")}
        </h3>
        <span class="difficulty-badge {dailyChallenge.difficulty}">
          {dailyChallenge.difficulty}
        </span>
      </div>

      <h4 class="challenge-title">{dailyChallenge.title}</h4>
      <p class="challenge-description">{dailyChallenge.description}</p>

      <div class="challenge-progress">
        <div class="progress-bar">
          <div
            class="progress-fill"
            style="width: {challengeProgressPercent}%"
          ></div>
        </div>
        <span class="progress-text">
          {challengeProgressPercent}% ({challengeProgress?.progress ||
            0}/{dailyChallenge.requirement.target})
        </span>
      </div>

      <div class="challenge-reward">
        <i class="fas fa-trophy" aria-hidden="true"></i>
        +{dailyChallenge.xpReward} XP
      </div>
    </div>

    <!-- Active Quests (Coming Soon) -->
    <div class="quests-section">
      <h3><i class="fas fa-scroll" aria-hidden="true"></i> {t("gamification_active_quests")}</h3>
      <div class="coming-soon">
        <i class="fas fa-hourglass-half" aria-hidden="true"></i>
        <p>Quest system {t("status_coming_soon").toLowerCase()}!</p>
        <p class="hint">Complete longer challenges for bigger rewards</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .challenges-section {
    container-type: inline-size;
    container-name: challenges-section;
    display: flex;
    flex-direction: column;
    gap: clamp(16px, 4cqi, 24px);
    padding: clamp(16px, 4cqi, 24px);
    height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .challenges-section::-webkit-scrollbar {
    width: 8px;
  }

  .challenges-section::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }

  /* Loading & Empty States */
  .loading-container,
  .auth-required,
  .empty-state,
  .coming-soon {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: clamp(24px, 6cqi, 50px);
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
  .empty-state i,
  .coming-soon i {
    font-size: clamp(32px, 8cqi, 50px);
    opacity: 0.5;
  }

  /* Daily Challenge Card */
  .daily-challenge {
    padding: clamp(16px, 4cqi, 24px);
    border-radius: clamp(12px, 3cqi, 16px);
    border: 2px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .challenge-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: clamp(8px, 2cqi, 12px);
    margin-bottom: clamp(10px, 2.5cqi, 12px);
    flex-wrap: wrap;
  }

  .challenge-header h3 {
    font-size: clamp(16px, 4cqi, 18px);
    font-weight: 600;
    margin: 0;
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5cqi, 8px);
  }

  .difficulty-badge {
    padding: clamp(4px, 1cqi, 6px) clamp(10px, 2.5cqi, 12px);
    border-radius: clamp(8px, 2cqi, 12px);
    font-size: clamp(10px, 2.5cqi, 11px);
    font-weight: 600;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .difficulty-badge.beginner {
    background: rgba(76, 175, 80, 0.2);
    color: #4caf50;
  }

  .difficulty-badge.intermediate {
    background: rgba(255, 152, 0, 0.2);
    color: #ff9800;
  }

  .difficulty-badge.advanced {
    background: rgba(244, 67, 54, 0.2);
    color: #f44336;
  }

  .challenge-title {
    font-size: clamp(15px, 3.8cqi, 18px);
    font-weight: 600;
    margin: 0 0 clamp(8px, 2cqi, 10px);
    line-height: 1.3;
  }

  .challenge-description {
    font-size: clamp(13px, 3.2cqi, 14px);
    color: var(--theme-text-dim);
    margin-bottom: clamp(12px, 3cqi, 16px);
    line-height: 1.5;
  }

  .challenge-progress {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5cqi, 8px);
    margin-bottom: clamp(10px, 2.5cqi, 12px);
  }

  .progress-bar {
    height: clamp(8px, 2cqi, 10px);
    background: rgba(255, 255, 255, 0.1);
    border-radius: clamp(4px, 1cqi, 5px);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    transition: width var(--transition-normal);
  }

  .progress-text {
    font-size: clamp(12px, 3cqi, 13px);
    color: var(--theme-text-dim);
  }

  .challenge-reward {
    font-weight: 600;
    font-size: clamp(13px, 3.2cqi, 15px);
    color: #ffd700;
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5cqi, 8px);
  }

  /* Quests Section */
  .quests-section {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3cqi, 16px);
  }

  .quests-section h3 {
    font-size: clamp(16px, 4cqi, 18px);
    font-weight: 600;
    margin: 0;
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5cqi, 8px);
  }

  .hint {
    font-size: clamp(12px, 3cqi, 14px);
    opacity: 0.7;
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
