<script lang="ts">
  /**
   * DailyChallengeCard
   * Displays a daily challenge with progress bar and completion status.
   */

  import type {
    DailyChallenge,
    UserChallengeProgress,
  } from "$lib/shared/gamification/domain/models/achievement-models";

  interface Props {
    challenge: DailyChallenge;
    progress: UserChallengeProgress | null;
    compact?: boolean;
    onComplete?: () => void;
  }

  let { challenge, progress, compact = false, onComplete }: Props = $props();

  // Calculated values
  const currentProgress = $derived(progress?.progress ?? 0);
  const targetProgress = $derived(challenge.requirement.target);
  const progressPercent = $derived(
    Math.min(100, Math.round((currentProgress / targetProgress) * 100))
  );
  const isComplete = $derived(progress?.isCompleted ?? false);
  const xpReward = $derived(challenge.xpReward);

  // Time remaining until midnight
  const timeRemaining = $derived.by(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const ms = midnight.getTime() - now.getTime();
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes };
  });

  // Difficulty colors
  const difficultyColors: Record<string, string> = {
    easy: "var(--semantic-success)",
    medium: "var(--semantic-warning)",
    hard: "var(--semantic-error)",
  };

  const difficultyColor = $derived(
    difficultyColors[challenge.difficulty] ?? "#6b7280"
  );
</script>

<div class="daily-challenge-card" class:compact class:complete={isComplete}>
  <!-- Header -->
  <div class="card-header">
    <div class="challenge-icon">
      <i class="fas fa-sun" aria-hidden="true"></i>
    </div>
    <div class="challenge-title">
      <h3>{challenge.title}</h3>
      {#if !compact}
        <span class="difficulty-badge" style="--badge-color: {difficultyColor}">
          {challenge.difficulty}
        </span>
      {/if}
    </div>
    <div class="xp-reward">
      <i class="fas fa-star" aria-hidden="true"></i>
      <span>{xpReward} XP</span>
    </div>
  </div>

  <!-- Description -->
  {#if !compact}
    <p class="challenge-description">{challenge.description}</p>
  {/if}

  <!-- Progress -->
  <div class="progress-section">
    <div class="progress-bar">
      <div
        class="progress-fill"
        style="width: {progressPercent}%"
        class:complete={isComplete}
      ></div>
    </div>
    <div class="progress-text">
      {#if isComplete}
        <i class="fas fa-check-circle" aria-hidden="true"></i>
        <span>Completed!</span>
      {:else}
        <span>{currentProgress} / {targetProgress}</span>
        <span class="time-remaining">
          <i class="fas fa-clock" aria-hidden="true"></i>
          {timeRemaining.hours}h {timeRemaining.minutes}m left
        </span>
      {/if}
    </div>
  </div>
</div>

<style>
  /* ============================================================================
     BASE STYLES - iPhone SE (320px) Mobile-First
     ============================================================================ */
  .daily-challenge-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    transition: all var(--duration-normal) ease;
  }

  .daily-challenge-card.compact {
    padding: 10px;
    gap: 8px;
  }

  .daily-challenge-card.complete {
    border-color: color-mix(in srgb, var(--semantic-success, #22c55e) 30%, transparent);
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 8%, transparent);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .challenge-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, var(--semantic-warning), #f97316);
    border-radius: 10px;
    color: white;
    font-size: var(--font-size-sm);
    flex-shrink: 0;
  }

  .compact .challenge-icon {
    width: 32px;
    height: 32px;
    font-size: var(--font-size-compact);
    border-radius: 8px;
  }

  .challenge-title {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .challenge-title h3 {
    margin: 0;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compact .challenge-title h3 {
    font-size: var(--font-size-compact);
  }

  .difficulty-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--badge-color) 20%, transparent);
    color: var(--badge-color);
    width: fit-content;
  }

  .xp-reward {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: color-mix(in srgb, var(--semantic-warning, #f59e0b) 15%, transparent);
    border-radius: 16px;
    color: var(--semantic-warning, #f59e0b);
    font-size: var(--font-size-compact);
    font-weight: 600;
    flex-shrink: 0;
  }

  .compact .xp-reward {
    padding: 3px 6px;
    font-size: var(--font-size-compact);
  }

  .challenge-description {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    line-height: 1.4;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .progress-bar {
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--semantic-warning), #f97316);
    border-radius: 3px;
    transition: width var(--duration-emphasis) ease;
  }

  .progress-fill.complete {
    background: linear-gradient(90deg, var(--semantic-success, #22c55e), color-mix(in srgb, var(--semantic-success, #22c55e) 80%, #000));
  }

  .progress-text {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    gap: 8px;
  }

  .progress-text .fa-check-circle {
    color: var(--semantic-success);
    margin-right: 4px;
  }

  .time-remaining {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--theme-text-dim);
    white-space: nowrap;
  }

  .time-remaining i {
    font-size: var(--font-size-compact);
  }

  /* ============================================================================
     LARGE MOBILE (481px+)
     ============================================================================ */
  @media (min-width: 481px) {
    .daily-challenge-card {
      gap: 14px;
      padding: 16px;
      border-radius: 14px;
    }

    .daily-challenge-card.compact {
      padding: 14px;
      gap: 10px;
    }

    .card-header {
      gap: 12px;
    }

    .challenge-icon {
      width: 40px;
      height: 40px;
      font-size: var(--font-size-base);
      border-radius: 11px;
    }

    .compact .challenge-icon {
      width: 34px;
      height: 34px;
      font-size: var(--font-size-compact);
    }

    .challenge-title {
      gap: 4px;
    }

    .challenge-title h3 {
      font-size: var(--font-size-sm);
    }

    .compact .challenge-title h3 {
      font-size: var(--font-size-compact);
    }

    .difficulty-badge {
      padding: 2px 7px;
      font-size: var(--font-size-compact);
    }

    .xp-reward {
      gap: 5px;
      padding: 5px 10px;
      font-size: var(--font-size-compact);
    }

    .compact .xp-reward {
      padding: 4px 8px;
      font-size: var(--font-size-compact);
    }

    .challenge-description {
      font-size: var(--font-size-compact);
      line-height: 1.5;
    }

    .progress-section {
      gap: 8px;
    }

    .progress-bar {
      height: 7px;
    }

    .progress-text {
      font-size: var(--font-size-compact);
    }

    .time-remaining i {
      font-size: var(--font-size-compact);
    }
  }

  /* ============================================================================
     TABLET (641px+)
     ============================================================================ */
  @media (min-width: 641px) {
    .daily-challenge-card {
      gap: 16px;
      padding: 20px;
      border-radius: 16px;
    }

    .daily-challenge-card.compact {
      padding: 16px;
      gap: 12px;
    }

    .challenge-icon {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-lg);
      border-radius: 12px;
    }

    .compact .challenge-icon {
      width: 36px;
      height: 36px;
      font-size: var(--font-size-sm);
      border-radius: 10px;
    }

    .challenge-title h3 {
      font-size: var(--font-size-base);
      white-space: normal;
    }

    .compact .challenge-title h3 {
      font-size: var(--font-size-sm);
    }

    .difficulty-badge {
      padding: 2px 8px;
      font-size: var(--font-size-compact);
      letter-spacing: 0.5px;
      border-radius: 4px;
    }

    .xp-reward {
      gap: 6px;
      padding: 6px 12px;
      font-size: var(--font-size-compact);
      border-radius: 20px;
    }

    .compact .xp-reward {
      padding: 4px 10px;
      font-size: var(--font-size-compact);
    }

    .challenge-description {
      font-size: var(--font-size-sm);
      line-clamp: 3;
      -webkit-line-clamp: 3;
    }

    .progress-bar {
      height: 8px;
      border-radius: 4px;
    }

    .progress-fill {
      border-radius: 4px;
    }

    .progress-text {
      font-size: var(--font-size-compact);
    }

    .time-remaining {
      gap: 6px;
    }

    .time-remaining i {
      font-size: var(--font-size-compact);
    }
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .daily-challenge-card,
    .progress-fill {
      transition: none;
    }
  }
</style>
