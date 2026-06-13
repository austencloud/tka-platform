<script lang="ts">
  /**
   * WeeklyChallengeCard
   * Displays a weekly challenge with progress, bonus deadline, and completion status.
   */

  import type {
    WeeklyChallenge,
    UserWeeklyChallengeProgress,
  } from "$lib/shared/gamification/domain/models/challenge-models";

  interface Props {
    challenge: WeeklyChallenge;
    progress: UserWeeklyChallengeProgress | null;
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
  const bonusEarned = $derived(progress?.bonusEarned ?? false);
  const xpReward = $derived(challenge.xpReward);
  const bonusXP = $derived(
    challenge.bonusMultiplier
      ? Math.floor(xpReward * challenge.bonusMultiplier)
      : 0
  );

  // Time calculations
  const timeRemaining = $derived.by(() => {
    const now = new Date();
    const end = new Date(challenge.endDate);
    const ms = end.getTime() - now.getTime();
    if (ms <= 0) return null;

    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return { days, hours };
  });

  const bonusTimeRemaining = $derived.by(() => {
    if (!challenge.bonusDeadline) return null;

    const now = new Date();
    const deadline = new Date(challenge.bonusDeadline);
    const ms = deadline.getTime() - now.getTime();
    if (ms <= 0) return null;

    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return { days, hours };
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

<div class="weekly-challenge-card" class:compact class:complete={isComplete}>
  <!-- Header -->
  <div class="card-header">
    <div class="challenge-icon">
      <i class="fas fa-calendar-week" aria-hidden="true"></i>
    </div>
    <div class="challenge-title">
      <h3>{challenge.title}</h3>
      {#if !compact}
        <div class="badge-row">
          <span
            class="difficulty-badge"
            style="--badge-color: {difficultyColor}"
          >
            {challenge.difficulty}
          </span>
          <span class="week-badge">
            Week {challenge.weekNumber}
          </span>
        </div>
      {/if}
    </div>
    <div class="xp-rewards">
      <div class="xp-reward">
        <i class="fas fa-star" aria-hidden="true"></i>
        <span>{xpReward} XP</span>
      </div>
      {#if bonusXP > 0 && !isComplete}
        <div class="bonus-reward" class:expired={!bonusTimeRemaining}>
          <i class="fas fa-bolt" aria-hidden="true"></i>
          <span>+{bonusXP}</span>
        </div>
      {/if}
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
        <div class="completion-status">
          <i class="fas fa-check-circle" aria-hidden="true"></i>
          <span>Completed!</span>
          {#if bonusEarned}
            <span class="bonus-badge">Bonus Earned!</span>
          {/if}
        </div>
      {:else}
        <span>{currentProgress} / {targetProgress}</span>
      {/if}
    </div>
  </div>

  <!-- Time Remaining -->
  {#if !isComplete && !compact}
    <div class="time-info">
      {#if timeRemaining}
        <div class="time-block">
          <i class="fas fa-clock" aria-hidden="true"></i>
          <span>
            {timeRemaining.days}d {timeRemaining.hours}h remaining
          </span>
        </div>
      {/if}
      {#if bonusTimeRemaining && bonusXP > 0}
        <div class="bonus-time-block">
          <i class="fas fa-bolt" aria-hidden="true"></i>
          <span>
            Bonus: {bonusTimeRemaining.days}d {bonusTimeRemaining.hours}h left
          </span>
        </div>
      {:else if bonusXP > 0}
        <div class="bonus-time-block expired">
          <i class="fas fa-times-circle" aria-hidden="true"></i>
          <span>Bonus expired</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* ============================================================================
     BASE STYLES - iPhone SE (320px) Mobile-First
     ============================================================================ */
  .weekly-challenge-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    transition: all var(--duration-normal) ease;
  }

  .weekly-challenge-card.compact {
    padding: 10px;
    gap: 8px;
  }

  .weekly-challenge-card.complete {
    border-color: color-mix(in srgb, var(--semantic-success, #22c55e) 30%, transparent);
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 8%, transparent);
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .challenge-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, var(--theme-accent-strong, #8b5cf6), color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 70%, #000));
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
    gap: 4px;
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

  .badge-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
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
  }

  .week-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    border-radius: 3px;
    background: color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 20%, transparent);
    color: var(--theme-accent-strong, #8b5cf6);
  }

  .xp-rewards {
    display: flex;
    flex-direction: column;
    gap: 3px;
    align-items: flex-end;
    flex-shrink: 0;
  }

  .xp-reward {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 15%, transparent);
    border-radius: 16px;
    color: var(--theme-accent-strong, #8b5cf6);
    font-size: var(--font-size-compact);
    font-weight: 600;
  }

  .bonus-reward {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px 6px;
    background: color-mix(in srgb, var(--semantic-warning, #f59e0b) 15%, transparent);
    border-radius: 16px;
    color: var(--semantic-warning, #f59e0b);
    font-size: var(--font-size-compact);
    font-weight: 600;
  }

  .bonus-reward.expired {
    opacity: 0.5;
    text-decoration: line-through;
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
    background: linear-gradient(90deg, var(--theme-accent-strong, #8b5cf6), color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 80%, #000));
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

  .completion-status {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .completion-status .fa-check-circle {
    color: var(--semantic-success);
  }

  .bonus-badge {
    padding: 1px 6px;
    background: color-mix(in srgb, var(--semantic-warning, #f59e0b) 20%, transparent);
    border-radius: 3px;
    color: var(--semantic-warning, #f59e0b);
    font-size: var(--font-size-compact);
    font-weight: 600;
  }

  .time-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .time-block,
  .bonus-time-block {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .bonus-time-block {
    color: var(--semantic-warning);
  }

  .bonus-time-block.expired {
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
  }

  /* ============================================================================
     LARGE MOBILE (481px+)
     ============================================================================ */
  @media (min-width: 481px) {
    .weekly-challenge-card {
      gap: 14px;
      padding: 16px;
      border-radius: 14px;
    }

    .weekly-challenge-card.compact {
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
      gap: 5px;
    }

    .challenge-title h3 {
      font-size: var(--font-size-sm);
    }

    .compact .challenge-title h3 {
      font-size: var(--font-size-compact);
    }

    .badge-row {
      gap: 7px;
    }

    .difficulty-badge,
    .week-badge {
      padding: 2px 7px;
      font-size: var(--font-size-compact);
    }

    .xp-rewards {
      gap: 4px;
    }

    .xp-reward {
      gap: 5px;
      padding: 5px 10px;
      font-size: var(--font-size-compact);
    }

    .bonus-reward {
      padding: 4px 8px;
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

    .completion-status {
      gap: 7px;
    }

    .bonus-badge {
      padding: 2px 7px;
      font-size: var(--font-size-compact);
    }

    .time-info {
      flex-direction: row;
      gap: 12px;
    }

    .time-block,
    .bonus-time-block {
      gap: 6px;
      font-size: var(--font-size-compact);
    }
  }

  /* ============================================================================
     TABLET (641px+)
     ============================================================================ */
  @media (min-width: 641px) {
    .weekly-challenge-card {
      gap: 16px;
      padding: 20px;
      border-radius: 16px;
    }

    .weekly-challenge-card.compact {
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

    .challenge-title {
      gap: 6px;
    }

    .challenge-title h3 {
      font-size: var(--font-size-base);
      white-space: normal;
    }

    .compact .challenge-title h3 {
      font-size: var(--font-size-sm);
    }

    .badge-row {
      gap: 8px;
    }

    .difficulty-badge,
    .week-badge {
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

    .bonus-reward {
      gap: 4px;
      padding: 4px 10px;
      font-size: var(--font-size-compact);
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

    .completion-status {
      gap: 8px;
    }

    .bonus-badge {
      padding: 2px 8px;
      font-size: var(--font-size-compact);
      border-radius: 4px;
    }

    .time-info {
      gap: 16px;
    }

    .time-block,
    .bonus-time-block {
      font-size: var(--font-size-compact);
    }
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .weekly-challenge-card,
    .progress-fill {
      transition: none;
    }
  }
</style>
