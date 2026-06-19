<!--
  StreakBadge

  Compact streak display for the dashboard header.
  Shows flame icon with current streak count.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { onMount } from "svelte";
  import { getStreakTracker } from "$lib/shared/gamification/get-streak-tracker";

  let currentStreak = $state(0);
  let isActive = $state(false);
  let isLoading = $state(true);

  onMount(async () => {
    try {
      const streakTracker = getStreakTracker();

      await streakTracker.initialize();
      const stats = await streakTracker.getStreakStats();
      const status = await streakTracker.checkStreakStatus();

      currentStreak = stats.currentStreak;
      isActive = status.isActive;
    } catch (error) {
      console.error("[StreakBadge] Failed to load streak:", error);
    }

    isLoading = false;
  });
</script>

<div
  class="streak-badge"
  class:active={isActive}
  class:loading={isLoading}
  title={isActive ? t('watch_streak_active', { count: currentStreak }) : t('watch_streak_start')}
>
  <div class="flame-container">
    <svg class="flame-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 23c-4.97 0-9-4.03-9-9 0-3.53 2.04-6.87 5.36-8.55.68-.34 1.48.18 1.41.93-.06.6.07 1.22.38 1.76.32.55.79 1.02 1.41 1.34a.75.75 0 0 0 1.1-.7c-.02-1.22.36-2.42 1.1-3.37.77-.98 1.9-1.63 3.15-1.78.71-.08 1.23.62.97 1.28-.3.76-.46 1.58-.46 2.4 0 2.1 1.05 3.98 2.66 5.13.21.15.34.4.34.66 0 4.97-4.03 9-9 9z"
        fill="currentColor"
      />
      <path
        class="flame-inner"
        d="M12 21c-2.76 0-5-2.24-5-5 0-1.95 1.12-3.79 2.94-4.71.37-.19.82.1.77.51-.04.32.04.66.21.96.17.3.43.56.77.73.34.18.74-.05.76-.44-.01-.67.2-1.33.6-1.85.42-.54 1.04-.9 1.73-.98.39-.04.68.34.53.7-.17.42-.25.87-.25 1.32 0 1.16.58 2.19 1.46 2.82.12.08.19.22.19.36 0 2.76-2.24 5-5 5z"
        fill="var(--flame-inner-color, var(--semantic-warning, #f59e0b))"
      />
    </svg>
    {#if isActive}
      <div class="glow"></div>
    {/if}
  </div>
  <span class="streak-count">{isLoading ? "–" : currentStreak}</span>
</div>

<style>
  .streak-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    transition:
      background 0.3s ease,
      border-color 0.3s ease;
  }

  .streak-badge.active {
    background: var(--semantic-warning-bg, rgba(245, 158, 11, 0.1));
    border-color: var(--semantic-warning-border, rgba(245, 158, 11, 0.3));
  }

  .streak-badge.loading {
    opacity: 0.6;
  }

  .flame-container {
    position: relative;
    width: 20px;
    height: 20px;
  }

  .flame-icon {
    width: 100%;
    height: 100%;
    color: var(--theme-text-dim, #9ca3af);
    transition: color var(--duration-emphasis, 200ms) ease;
  }

  .active .flame-icon {
    color: var(--semantic-warning, #f59e0b);
    /* Hot yellow core of the flame gradient - a deliberate two-tone flame
       highlight, not a theme color, so it stays distinct from the orange. */
    --flame-inner-color: #ffeb3b;
    animation: flameFlicker 2s ease-in-out infinite;
  }

  @keyframes flameFlicker {
    0%,
    100% {
      transform: scale(1) rotate(0deg);
    }
    25% {
      transform: scale(1.02) rotate(-1deg);
    }
    50% {
      transform: scale(0.98) rotate(1deg);
    }
    75% {
      transform: scale(1.01) rotate(-0.5deg);
    }
  }

  .flame-inner {
    opacity: 0.9;
  }

  .glow {
    position: absolute;
    inset: -4px;
    background: radial-gradient(circle, var(--semantic-warning-glow, rgba(245, 158, 11, 0.4)) 0%, transparent 70%);
    border-radius: 50%;
    animation: glowPulse 2s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes glowPulse {
    0%,
    100% {
      opacity: 0.6;
      transform: scale(1);
    }
    50% {
      opacity: 0.9;
      transform: scale(1.1);
    }
  }

  .streak-count {
    font-size: var(--font-size-sm, 14px);
    font-weight: 700;
    color: var(--theme-text-dim, #9ca3af);
    min-width: 1rem;
    text-align: center;
    transition: color var(--duration-emphasis, 200ms) ease;
  }

  .active .streak-count {
    color: var(--semantic-warning, #f59e0b);
  }

  @media (prefers-reduced-motion: reduce) {
    .active .flame-icon {
      animation: none;
    }

    .glow {
      animation: none;
      opacity: 0.7;
    }
  }
</style>
