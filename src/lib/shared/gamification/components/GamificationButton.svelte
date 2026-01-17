<script lang="ts">
  /**
   * Gamification Button Component
   *
   * Main entry point for the gamification system.
   * Shows current level, XP progress, and opens achievements panel.
   */

  import { onMount } from "svelte";
  import { container } from "../../di";
  import type { IHapticFeedback } from "../../application/services/contracts/IHapticFeedback";
  import type { IAchievementManager } from "../services/contracts/IAchievementManager";
  import type { UserXP } from "../domain/models/achievement-models";
  import { getLevelProgress } from "../domain/constants/xp-constants";
  import { auth } from "../../auth/firebase";

  // Props
  let { onclick = () => {} }: { onclick?: () => void } = $props();

  // State
  let achievementService: IAchievementManager | null = $state(null);
  let userXP: UserXP | null = $state(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let isLoggedIn = $state(false);
  let hapticService: IHapticFeedback | undefined;

  // Derived state for level progress
  let levelProgress = $derived.by(() => {
    if (!userXP) return null;
    return getLevelProgress(userXP.totalXP);
  });

  // Initialize
  onMount(() => {
    hapticService = container.items.hapticFeedback;
    let interval: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      try {
        achievementService = container.items.achievementManager;

        // Listen for auth state changes
        unsubscribe = auth.onAuthStateChanged((user) => {
          isLoggedIn = !!user;
          if (user) {
            loadUserXP();
          } else {
            userXP = null;
          }
        });

        isLoading = false;

        // Refresh XP every 30 seconds (only if logged in)
        interval = setInterval(() => {
          if (isLoggedIn) {
            loadUserXP();
          }
        }, 30000);
      } catch (err) {
        console.error("Failed to initialize GamificationButton:", err);
        error = "Failed to load";
        isLoading = false;
      }
    })();

    return () => {
      if (interval) clearInterval(interval);
      if (unsubscribe) unsubscribe();
    };
  });

  async function loadUserXP() {
    if (!achievementService || !isLoggedIn) return;
    try {
      userXP = await achievementService.getUserXP();
    } catch (err) {
      // Silently fail - user might not be logged in
      userXP = null;
    }
  }

  function handleClick() {
    hapticService?.trigger("selection");
    onclick();
  }
</script>

{#if isLoggedIn || isLoading}
  <button
    class="gamification-button glass-surface"
    onclick={handleClick}
    title="View Achievements & Challenges"
  >
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
      </div>
    {:else if error}
      <div class="error-state">
        <span class="icon">⚠️</span>
      </div>
    {:else}
      <!-- Simple trophy icon - minimal design -->
      <i class="fas fa-trophy icon-minimal" aria-hidden="true"></i>
      <!-- Optional: Small level badge for levels > 1 -->
      {#if levelProgress && levelProgress.currentLevel > 1}
        <span class="level-badge-minimal">{levelProgress.currentLevel}</span>
      {/if}
    {/if}
  </button>
{/if}

<style>
  .gamification-button {
    /* Match ProfileButton sizing - WCAG AAA minimum touch target */
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    border-radius: 50%;
    border: none;
    background: var(--theme-card-bg);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .gamification-button:hover {
    background: var(--theme-card-hover-bg);
    transform: scale(1.05);
  }

  .gamification-button:active {
    transform: scale(0.95);
  }

  /* Loading State */
  .loading-state,
  .error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--theme-stroke);
    border-top-color: var(--theme-text);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Minimal icon styling */
  .icon-minimal {
    font-size: var(--font-size-xl);
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
  }

  /* Small level badge - subtle notification style */
  .level-badge-minimal {
    position: absolute;
    top: -2px;
    right: -2px;
    background: linear-gradient(
      135deg,
      var(--theme-accent, var(--theme-accent)) 0%,
      var(--theme-accent-strong, var(--theme-accent-strong)) 100%
    );
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact);
    font-weight: 700;
    color: var(--theme-text, white);
    box-shadow: 0 1px 4px var(--theme-shadow, var(--theme-shadow));
    z-index: 2;
  }

  /* Accessibility */
  .gamification-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .gamification-button,
    .spinner {
      animation: none;
      transition: none;
    }

    .gamification-button:hover,
    .gamification-button:active {
      transform: none;
    }
  }

  /* High Contrast */
  @media (prefers-contrast: high) {
    .gamification-button {
      background: var(--theme-stroke-strong);
      border: 2px solid var(--theme-text, white);
    }
  }
</style>
