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
    isSelectingStart = false,
    entranceDelay = 0,
    onSelect,
    onHover,
  } = $props<{
    position: GridLocation;
    enabled: boolean;
    isCurrent: boolean;
    isSelectingStart?: boolean;
    entranceDelay?: number;
    onSelect: (position: GridLocation) => void;
    onHover?: (position: GridLocation | null) => void;
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
    [GridLocation.CENTER]: "C",
  };

  // Reactive label - updates when position changes
  const label = $derived(positionLabels[position as GridLocation] ?? "?");

  function handleClick() {
    if (enabled) {
      hapticService?.trigger("selection");
      onSelect(position);
    }
  }

  function handleMouseEnter() {
    if (enabled && isSelectingStart) {
      onHover?.(position);
    }
  }

  function handleMouseLeave() {
    if (enabled && isSelectingStart) {
      onHover?.(null);
    }
  }
</script>

<button
  class="grid-position-button"
  class:enabled
  class:disabled={!enabled}
  class:current={isCurrent}
  class:selecting-start={isSelectingStart && enabled}
  class:has-entrance={entranceDelay > 0}
  style:--entrance-delay="{entranceDelay}ms"
  disabled={!enabled}
  onclick={handleClick}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  aria-label={`Position ${label}`}
  aria-pressed={isCurrent}
>
  <span class="label">{label}</span>

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
    transition: all var(--duration-normal) ease;
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
    transition: transform var(--duration-instant) ease;
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
  }

  /* Selecting start state - subtle invitation to hover */
  .grid-position-button.selecting-start {
    border-style: dashed;
  }

  @media (hover: hover) {
    .grid-position-button.selecting-start:hover {
      border-style: solid;
      transform: scale(1.1);
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
    .current-indicator {
      transition: none;
      animation: none;
    }
  }
</style>
