<!--
GridPositionButton.svelte - Individual position button in the 3x3 grid

Displays a position label (N, E, S, W, NE, SE, SW, NW, or C for center)
Supports enabled/disabled states and highlights current position.
-->
<script lang="ts">
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";

  const {
    position,
    enabled,
    isCurrent,
    showGhostHand = false,
    ghostHandColor = "blue",
    isGhostFadingOut = false,
    isGhostFadingIn = false,
    entranceDelay = 0,
    onSelect,
  } = $props<{
    position: GridLocation;
    enabled: boolean;
    isCurrent: boolean;
    showGhostHand?: boolean;
    ghostHandColor?: "blue" | "red";
    isGhostFadingOut?: boolean;
    isGhostFadingIn?: boolean;
    entranceDelay?: number;
    onSelect: (position: GridLocation) => void;
  }>();

  // Access haptic feedback service from ITI container
  const hapticService = container.items.hapticFeedback as IHapticFeedback;

  // Map GridLocation to display label
  const positionLabels: Record<GridLocation, string> = {
    [GridLocation.NORTH]: "N",
    [GridLocation.EAST]: "E",
    [GridLocation.SOUTH]: "S",
    [GridLocation.WEST]: "W",
    [GridLocation.NORTHEAST]: "NE",
    [GridLocation.SOUTHEAST]: "SE",
    [GridLocation.SOUTHWEST]: "SW",
    [GridLocation.NORTHWEST]: "NW",
  };

  // Reactive label - updates when position changes
  const label = $derived(positionLabels[position as GridLocation] ?? "?");

  // Ghost hand color
  const ghostFill = $derived(ghostHandColor === "red" ? "#ef4444" : "#3b82f6");

  function handleClick() {
    if (enabled) {
      hapticService?.trigger("selection");
      onSelect(position);
    }
  }
</script>

<button
  class="grid-position-button"
  class:enabled
  class:disabled={!enabled}
  class:current={isCurrent}
  class:has-ghost={showGhostHand && enabled}
  class:has-entrance={entranceDelay > 0}
  style:--entrance-delay="{entranceDelay}ms"
  disabled={!enabled}
  onclick={handleClick}
  aria-label={`Position ${label}`}
  aria-pressed={isCurrent}
>
  <span class="label" class:hidden={showGhostHand && enabled}>{label}</span>

  <!-- Ghost hand icon for start position selection -->
  {#if showGhostHand && enabled}
    <div
      class="ghost-hand"
      class:fading-out={isGhostFadingOut}
      class:fading-in={isGhostFadingIn}
    >
      <svg
        class="ghost-hand-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 75 100"
      >
        <path
          fill={ghostFill}
          d="M11.17 44.59h3.37V12.7a5.61 5.61 0 1 1 11.2-.01v31.9h3.32V5.72A5.5 5.5 0 0 1 34.66 0a5.55 5.55 0 0 1 5.58 5.77v38.81h3.32V13.56c0-2.99 1.95-5.19 4.97-5.64 3.08-.45 6.18 2.1 6.19 5.15q.02 5.73 0 11.46v38.13c0 .79.16 1.47.94 1.87.85.44 1.73.15 2.27-.77l6.41-10.87c1.64-2.79 4.42-3.73 7.43-2.48 3.04 1.26 4.15 4.73 2.41 7.7L65.3 73.19c-2.17 3.68-4.29 7.4-6.55 11.03a18 18 0 0 1-2.81 3.27 46 46 0 0 1-14.76 9.87c-5.01 2.03-10.23 3.03-15.63 2.51-9.85-.94-17.1-5.78-21.71-14.35A32 32 0 0 1 .26 73a76 76 0 0 1-.25-6.23L0 25.08a5.6 5.6 0 0 1 5.74-5.7 5.5 5.5 0 0 1 5.42 5.41z"
        />
      </svg>
    </div>
  {/if}

  {#if isCurrent}
    <div class="current-indicator"></div>
  {/if}
</button>

<style>
  .grid-position-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;

    /* Size */
    width: 100%;
    height: 100%;
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);

    /* Typography */
    font-size: var(--font-size-base);
    font-weight: 600;

    /* Base styling - themed */
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--theme-text-dim);
  }

  /* Enabled state - themed accent with subtle blue tint */
  .grid-position-button.enabled {
    background: var(--theme-card-bg);
    border-color: var(--theme-accent);
    color: var(--theme-text);
    box-shadow: 0 0 12px var(--theme-shadow);
  }

  /* Disabled state - themed */
  .grid-position-button.disabled {
    background: var(--theme-card-bg);
    border-color: var(--theme-stroke);
    color: var(--theme-text-dim);
    cursor: not-allowed;
    opacity: 0.4;
  }

  /* Current position highlight - themed accent */
  .grid-position-button.current {
    box-shadow:
      0 0 0 3px var(--theme-accent),
      0 0 20px var(--theme-shadow);
    border-color: var(--theme-accent-strong);
    transform: scale(1.05);
  }

  /* Hover effects */
  @media (hover: hover) {
    .grid-position-button.enabled:hover:not(.current) {
      transform: scale(1.08);
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-accent-strong);
      box-shadow: 0 4px 12px var(--theme-shadow);
    }
  }

  .grid-position-button.enabled:active {
    transform: scale(0.95);
    transition: transform 0.1s ease;
  }

  /* Staggered entrance animation - pop in with attention pulse (enabled only) */
  .grid-position-button.has-entrance.enabled {
    animation:
      button-pop-in 0.5s cubic-bezier(0.34, 1.3, 0.64, 1) both,
      button-ready-pulse 0.6s ease-out 0.4s both;
    animation-delay: var(--entrance-delay, 0ms);
  }

  /* Quick pop with slight overshoot */
  @keyframes button-pop-in {
    0% {
      opacity: 0;
      transform: scale(0.7);
    }
    70% {
      opacity: 1;
      transform: scale(1.05);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Subtle "I'm ready" glow pulse after appearing */
  @keyframes button-ready-pulse {
    0% {
      box-shadow:
        0 0 0 0 var(--theme-accent),
        0 0 12px var(--theme-shadow);
    }
    50% {
      box-shadow:
        0 0 0 4px var(--theme-accent),
        0 0 20px var(--theme-accent);
    }
    100% {
      box-shadow:
        0 0 0 0 transparent,
        0 0 12px var(--theme-shadow);
    }
  }

  /* Label */
  .label {
    position: relative;
    z-index: 1;
    transition: opacity 0.2s ease;
  }

  .label.hidden {
    opacity: 0;
    position: absolute;
  }

  /* Ghost hand for start position selection */
  .ghost-hand {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.5;
    transition:
      opacity 0.3s ease,
      transform 0.3s ease;
    /* Gentle pulse animation to invite interaction */
    animation: ghost-pulse 2.5s ease-in-out infinite;
  }

  .ghost-hand-icon {
    width: 50%;
    height: 50%;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
  }

  /* Subtle pulse: breathes between 40% and 60% opacity with slight scale */
  @keyframes ghost-pulse {
    0%,
    100% {
      opacity: 0.4;
      transform: scale(1);
    }
    50% {
      opacity: 0.65;
      transform: scale(1.05);
    }
  }

  /* Hover: ghost becomes more visible, pause pulse */
  .grid-position-button.has-ghost:hover .ghost-hand {
    opacity: 0.85;
    transform: scale(1.1);
    animation: none; /* Stop pulsing on hover - user is engaged */
  }

  /* Fade out animation for non-selected ghosts */
  .ghost-hand.fading-out {
    animation: ghost-fade-out 0.4s ease forwards;
  }

  @keyframes ghost-fade-out {
    0% {
      opacity: 0.5;
      transform: scale(1);
    }
    100% {
      opacity: 0;
      transform: scale(0.8);
    }
  }

  /* Fade in animation for selected ghost */
  .ghost-hand.fading-in {
    animation: ghost-fade-in 0.4s ease forwards;
  }

  @keyframes ghost-fade-in {
    0% {
      opacity: 0.5;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Current indicator (pulsing ring) - themed */
  .current-indicator {
    position: absolute;
    inset: -6px;
    border: 2px solid var(--theme-accent);
    border-radius: 12px;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    pointer-events: none;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
    .grid-position-button,
    .current-indicator,
    .label {
      transition: none;
      animation: none;
    }

    .ghost-hand {
      transition: none;
      animation: none;
      opacity: 0.5; /* Static opacity when animations disabled */
    }

    .ghost-hand.fading-out,
    .ghost-hand.fading-in {
      animation: none;
    }
  }
</style>
