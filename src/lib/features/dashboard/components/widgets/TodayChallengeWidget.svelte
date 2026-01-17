<script lang="ts">
  /**
   * TodayChallengeWidget - 2026 Bento Box Style
   * Full-height card with rich amber accent
   */

  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { IChallengeCoordinator } from "$lib/shared/gamification/services/contracts/IChallengeCoordinator";
  import type {
    DailyChallenge,
    UserChallengeProgress,
  } from "$lib/shared/gamification/domain/models/achievement-models";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import DailyChallengeCard from "$lib/shared/community/challenges/components/DailyChallengeCard.svelte";

  let challenge = $state<DailyChallenge | null>(null);
  let progress = $state<UserChallengeProgress | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const coordinator = container.items.challengeCoordinator;
      if (coordinator) {
        await coordinator.initialize();
        const dashboard = await coordinator.getDashboard();
        challenge = dashboard.daily.challenge;
        progress = dashboard.daily.progress;
      }
    } catch (err) {
      console.error("[TodayChallengeWidget] Failed to load challenge:", err);
      error = "Unable to load challenge";
    }
    isLoading = false;
  });

  function viewAllChallenges() {
    handleModuleChange("train", "challenges");
  }
</script>

<div class="challenge-widget">
  <div class="widget-header">
    <div class="header-icon">
      <i class="fas fa-bolt" aria-hidden="true"></i>
    </div>
    <h3>Today's Challenge</h3>
  </div>

  <div class="widget-content">
    {#if isLoading}
      <div class="loading-state">
        <div class="skeleton"></div>
      </div>
    {:else if error}
      <div class="empty-state">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <p>{error}</p>
      </div>
    {:else if challenge}
      <DailyChallengeCard {challenge} {progress} compact />
    {:else}
      <div class="empty-state">
        <i class="fas fa-sun" aria-hidden="true"></i>
        <p>Check back later for today's challenge!</p>
      </div>
    {/if}
  </div>

  <button class="view-all-btn" onclick={viewAllChallenges}>
    <span>View All Challenges</span>
    <i class="fas fa-arrow-right" aria-hidden="true"></i>
  </button>
</div>

<style>
  .challenge-widget {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    padding: 24px;
    background: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 12%,
      var(--theme-panel-bg)
    );
    border: 1px solid var(--theme-stroke);
    border-radius: 24px;
    overflow: hidden;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  }

  .widget-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 25%,
      var(--theme-card-bg)
    );
    border-radius: 14px;
    color: var(--semantic-warning, var(--semantic-warning));
    font-size: var(--font-size-lg);
  }

  .widget-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .widget-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 80px;
  }

  .loading-state {
    width: 100%;
  }

  .skeleton {
    width: 100%;
    height: 80px;
    background: linear-gradient(
      90deg,
      color-mix(
          in srgb,
          var(--semantic-warning, var(--semantic-warning)) 8%,
          transparent
        )
        25%,
      color-mix(
          in srgb,
          var(--semantic-warning, var(--semantic-warning)) 15%,
          transparent
        )
        50%,
      color-mix(
          in srgb,
          var(--semantic-warning, var(--semantic-warning)) 8%,
          transparent
        )
        75%
    );
    background-size: 200% 100%;
    animation: shimmer 2s infinite ease-in-out;
    border-radius: 14px;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    text-align: center;
    padding: 20px;
  }

  .empty-state i {
    font-size: var(--font-size-3xl);
    color: color-mix(
      in srgb,
      var(--semantic-warning, var(--semantic-warning)) 40%,
      transparent
    );
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .view-all-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: var(--min-touch-target);
    padding: 14px 20px;
    background: linear-gradient(
      135deg,
      var(--semantic-warning, var(--semantic-warning)) 0%,
      color-mix(
          in srgb,
          var(--semantic-warning, var(--semantic-warning)) 80%,
          black
        )
        100%
    );
    border: none;
    border-radius: 14px;
    color: white;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    margin-top: auto;
  }

  .view-all-btn:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .view-all-btn i {
    font-size: var(--font-size-sm);
  }

  @media (max-width: 768px) {
    .challenge-widget {
      padding: 20px;
      border-radius: 20px;
    }

    .header-icon {
      width: 40px;
      height: 40px;
      font-size: var(--font-size-base);
    }

    .widget-header h3 {
      font-size: 1rem;
    }

    .view-all-btn {
      min-height: 44px;
      padding: 12px 16px;
      font-size: 0.875rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none;
      background: rgba(245, 158, 11, 0.1);
    }

    .view-all-btn {
      transition: none;
    }

    .view-all-btn:hover {
      transform: none;
    }
  }
</style>
