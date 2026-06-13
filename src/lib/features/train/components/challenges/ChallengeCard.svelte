<!--
  ChallengeCard.svelte - Train Challenge Card (Refined 2026 Style)

  Sophisticated cards with colored accents rather than overwhelming gradients.
  Neutral bodies with colored top bars signal difficulty at a glance.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type {
    TrainChallenge,
    UserTrainChallengeProgress,
  } from "../../domain/models/train-challenge-models";
  import { calculateChallengeProgress } from "../../domain/models/train-challenge-models";
  import type { ChallengeDifficulty } from "$lib/shared/gamification/domain/models/achievement-models";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  interface Props {
    challenge: TrainChallenge;
    progress: UserTrainChallengeProgress | null;
    onStart?: (challengeId: string) => void;
  }

  let { challenge, progress, onStart }: Props = $props();

  // Haptic feedback service
  let hapticService: HapticFeedback | undefined;

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Calculated values
  const currentProgress = $derived(progress?.progress ?? 0);
  const targetProgress = $derived(challenge.requirement.target);
  const progressPercent = $derived(
    calculateChallengeProgress(currentProgress, targetProgress)
  );
  const isComplete = $derived(progress?.isCompleted ?? false);
  const isStarted = $derived(progress !== null);
  const xpReward = $derived(challenge.xpReward);
  const bonusXP = $derived(challenge.bonusXP ?? 0);

  // Refined color theme - accent colors for top bar and subtle tints
  const difficultyTheme = $derived.by(() => {
    const themes: Record<
      ChallengeDifficulty,
      {
        color: string;
        gradient: string;
        tint: string;
        glow: string;
      }
    > = {
      easy: {
        color: "var(--semantic-success)",
        gradient:
          "linear-gradient(90deg, var(--semantic-success) 0%, #34d399 100%)",
        tint: "rgba(16, 185, 129, 0.06)",
        glow: "rgba(16, 185, 129, 0.3)",
      },
      beginner: {
        color: "var(--semantic-success)",
        gradient:
          "linear-gradient(90deg, var(--semantic-success) 0%, #4ade80 100%)",
        tint: "rgba(34, 197, 94, 0.06)",
        glow: "rgba(34, 197, 94, 0.3)",
      },
      medium: {
        color: "var(--semantic-warning)",
        gradient:
          "linear-gradient(90deg, var(--semantic-warning) 0%, var(--semantic-warning) 100%)",
        tint: "rgba(245, 158, 11, 0.06)",
        glow: "rgba(245, 158, 11, 0.3)",
      },
      intermediate: {
        color: "#eab308",
        gradient: "linear-gradient(90deg, #eab308 0%, #facc15 100%)",
        tint: "rgba(234, 179, 8, 0.06)",
        glow: "rgba(234, 179, 8, 0.3)",
      },
      hard: {
        color: "#f97316",
        gradient: "linear-gradient(90deg, #f97316 0%, #fb923c 100%)",
        tint: "rgba(249, 115, 22, 0.06)",
        glow: "rgba(249, 115, 22, 0.3)",
      },
      advanced: {
        color: "var(--semantic-error)",
        gradient:
          "linear-gradient(90deg, var(--semantic-error) 0%, var(--semantic-error) 100%)",
        tint: "rgba(239, 68, 68, 0.06)",
        glow: "rgba(239, 68, 68, 0.3)",
      },
      expert: {
        color: "var(--semantic-error)",
        gradient:
          "linear-gradient(90deg, var(--semantic-error) 0%, var(--semantic-error) 100%)",
        tint: "rgba(220, 38, 38, 0.08)",
        glow: "rgba(220, 38, 38, 0.35)",
      },
    };
    return themes[challenge.difficulty] ?? themes.medium;
  });

  // Mode badge text
  const modeBadge = $derived.by(() => {
    const mode = challenge.requirement.metadata?.mode;
    if (!mode) return null;
    const modeLabels: Record<string, string> = {
      adaptive: "train_mode_adaptive",
      step_by_step: "train_mode_step_by_step",
      timed: "train_mode_timed",
    };
    const key = modeLabels[mode];
    return key ? t(key as Parameters<typeof t>[0]) : null;
  });

  function handleClick() {
    if (isComplete || !onStart) return;
    hapticService?.trigger("selection");
    onStart(challenge.id);
  }
</script>

<button
  class="challenge-card"
  class:complete={isComplete}
  class:clickable={!isComplete && onStart}
  style="--accent-color: {difficultyTheme.color}; --accent-gradient: {difficultyTheme.gradient}; --accent-tint: {difficultyTheme.tint}; --accent-glow: {difficultyTheme.glow}"
  onclick={handleClick}
  disabled={isComplete}
>
  <!-- Colored top accent bar -->
  <div class="accent-bar"></div>

  <!-- Card Content -->
  <div class="card-content">
    <!-- Header: Title + XP Badge -->
    <div class="card-header">
      <div class="header-content">
        <h3 class="card-title">{challenge.title}</h3>
        <p class="card-description">{challenge.description}</p>
      </div>
      <div class="xp-badge">
        <i class="fas fa-star" aria-hidden="true"></i>
        <span class="xp-value">{xpReward}</span>
        {#if bonusXP > 0 && !isComplete}
          <span class="bonus">+{bonusXP}</span>
        {/if}
      </div>
    </div>

    <!-- Tags -->
    <div class="tags-row">
      <span class="tag difficulty">
        {challenge.difficulty}
      </span>
      {#if modeBadge}
        <span class="tag mode">{modeBadge}</span>
      {/if}
    </div>

    <!-- Progress (if started) -->
    {#if isStarted}
      <div class="progress-section">
        <div class="progress-track">
          <div
            class="progress-fill"
            class:complete={isComplete}
            style="width: {progressPercent}%; background: var(--accent-gradient)"
          ></div>
        </div>
        <span class="progress-text">
          {#if isComplete}
            <i class="fas fa-check" aria-hidden="true"></i>
          {:else}
            {currentProgress}/{targetProgress}
          {/if}
        </span>
      </div>
    {/if}

    <!-- Action Footer -->
    <div class="card-footer">
      {#if isComplete}
        <div class="status-badge complete">
          <i class="fas fa-check-circle" aria-hidden="true"></i>
          <span>{t("train_completed")}</span>
        </div>
      {:else}
        <div class="action-hint">
          <span>{isStarted ? t("train_continue") : t("train_start")}</span>
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        </div>
      {/if}
    </div>
  </div>
</button>

<style>
  /* ============================================================================
     REFINED 2026 CHALLENGE CARD
     Neutral body with colored accent bar - sophisticated, not overwhelming
     ============================================================================ */
  .challenge-card {
    display: flex;
    flex-direction: column;
    min-height: 160px;
    background: var(--accent-tint);
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
    text-align: left;
    cursor: default;
    transition: all var(--duration-normal) ease;
    width: 100%;
    position: relative;
    overflow: hidden;
  }

  .challenge-card.clickable {
    cursor: pointer;
  }

  .challenge-card.clickable:hover {
    transform: translateY(-3px);
    border-color: var(--theme-stroke-strong, var(--theme-stroke-strong));
    box-shadow:
      0 12px 32px var(--theme-shadow, var(--theme-shadow)),
      0 0 0 1px var(--accent-color),
      0 0 40px var(--accent-glow);
  }

  .challenge-card.clickable:active {
    transform: translateY(-1px);
    transition: all var(--duration-instant) ease;
  }

  /* Completed state */
  .challenge-card.complete {
    background: color-mix(in srgb, var(--semantic-success) 8%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    opacity: 0.9;
  }

  .challenge-card.complete .accent-bar {
    background: linear-gradient(
      90deg,
      var(--semantic-success) 0%,
      color-mix(in srgb, var(--semantic-success) 70%, white) 100%
    );
  }

  /* Colored top accent bar */
  .accent-bar {
    height: 4px;
    background: var(--accent-gradient);
    flex-shrink: 0;
  }

  /* Card content wrapper */
  .card-content {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px 20px 20px;
    flex: 1;
  }

  /* Header */
  .card-header {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: flex-start;
  }

  .header-content {
    flex: 1;
    min-width: 0;
  }

  .card-title {
    margin: 0 0 6px;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text);
    line-height: 1.35;
    letter-spacing: -0.01em;
  }

  .card-description {
    margin: 0;
    font-size: var(--font-size-compact);
    line-height: 1.5;
    color: var(--theme-text-dim);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* XP Badge - Premium golden look */
  .xp-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-warning) 15%, transparent) 0%,
      color-mix(in srgb, var(--semantic-warning) 10%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--semantic-warning) 25%, transparent);
    border-radius: 12px;
    flex-shrink: 0;
  }

  .xp-badge i {
    font-size: var(--font-size-compact);
    color: var(--semantic-warning);
  }

  .xp-value {
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: color-mix(in srgb, var(--semantic-warning) 75%, white);
  }

  .xp-badge .bonus {
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--semantic-warning);
  }

  /* Tags */
  .tags-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .tag {
    padding: 5px 10px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-radius: 6px;
  }

  .tag.difficulty {
    background: color-mix(in srgb, var(--accent-color) 20%, transparent);
    color: var(--accent-color);
    border: 1px solid color-mix(in srgb, var(--accent-color) 30%, transparent);
  }

  .tag.mode {
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
    color: color-mix(in srgb, var(--theme-accent) 70%, white);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  /* Progress Section */
  .progress-section {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--theme-card-bg);
    border-radius: 10px;
    border: 1px solid var(--theme-stroke);
  }

  .progress-track {
    flex: 1;
    height: 6px;
    background: var(--theme-stroke);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 3px;
    transition: width var(--duration-dramatic) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .progress-fill.complete {
    background: linear-gradient(
      90deg,
      var(--semantic-success),
      color-mix(in srgb, var(--semantic-success) 70%, white)
    ) !important;
  }

  .progress-text {
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim, var(--theme-text-dim));
    min-width: 44px;
    text-align: right;
  }

  .progress-text i {
    color: color-mix(in srgb, var(--semantic-success) 70%, white);
  }

  /* Footer */
  .card-footer {
    display: flex;
    justify-content: flex-end;
    min-height: var(--min-touch-target);
    align-items: center;
    margin-top: auto;
  }

  .action-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--min-touch-target);
    padding: 0 18px;
    background: color-mix(in srgb, var(--accent-color) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-color) 25%, transparent);
    border-radius: 12px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--accent-color);
    transition: all var(--duration-normal) ease;
  }

  .challenge-card.clickable:hover .action-hint {
    background: color-mix(in srgb, var(--accent-color) 18%, transparent);
    border-color: color-mix(in srgb, var(--accent-color) 35%, transparent);
    gap: 10px;
  }

  .action-hint i {
    font-size: var(--font-size-compact);
    transition: transform var(--duration-normal) ease;
  }

  .challenge-card.clickable:hover .action-hint i {
    transform: translateX(3px);
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--min-touch-target);
    padding: 0 16px;
    border-radius: 12px;
    font-size: var(--font-size-compact);
    font-weight: 600;
  }

  .status-badge.complete {
    background: color-mix(in srgb, var(--semantic-success) 12%, transparent);
    color: color-mix(in srgb, var(--semantic-success) 70%, white);
    border: 1px solid color-mix(in srgb, var(--semantic-success) 20%, transparent);
  }

  .status-badge i {
    font-size: var(--font-size-sm);
  }

  /* ============================================================================
     RESPONSIVE ADJUSTMENTS
     ============================================================================ */
  @media (min-width: 481px) {
    .card-content {
      padding: 20px 22px 22px;
      gap: 16px;
    }

    .card-title {
      font-size: var(--font-size-base);
    }

    .card-description {
      font-size: var(--font-size-sm);
    }

    .xp-badge {
      padding: 8px 14px;
    }

    .xp-value {
      font-size: var(--font-size-sm);
    }

    .tag {
      padding: 6px 12px;
      font-size: var(--font-size-compact);
    }
  }

  @media (min-width: 641px) {
    .challenge-card {
      min-height: 170px;
    }

    .accent-bar {
      height: 5px;
    }

    .card-content {
      padding: 22px 24px 24px;
    }

    .card-title {
      font-size: var(--font-size-lg);
    }
  }

  /* ============================================================================
     LANDSLOOPE MOBILE - Compact with accessible touch targets
     ============================================================================ */
  @media (max-height: 500px) and (orientation: landscape) {
    .challenge-card {
      min-height: auto;
    }

    .card-content {
      padding: 14px 16px 16px;
      gap: 10px;
    }

    .card-title {
      font-size: var(--font-size-sm);
    }

    .card-description {
      -webkit-line-clamp: 1;
      line-clamp: 1;
    }

    .xp-badge {
      padding: 6px 10px;
    }

    .xp-value {
      font-size: var(--font-size-compact);
    }

    /* Visual size compact but touch target maintained at 48px */
    .action-hint,
    .status-badge {
      height: 40px;
      font-size: var(--font-size-compact);
      position: relative;
    }

    .action-hint::before,
    .status-badge::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      min-width: 100%;
      min-height: var(--min-touch-target);
    }
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .challenge-card,
    .progress-fill,
    .action-hint,
    .action-hint i {
      transition: none;
    }
  }
</style>
