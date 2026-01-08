<!--
LevelFilterCard.svelte - Card with inline stepper for difficulty level selection
Supports levels 1-3 with TKA color gradients (sky blue, silver, gold)
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";

  let {
    currentLevel = null,
    onLevelChange,
    gridColumnSpan = 2,
    cardIndex = 0,
  } = $props<{
    currentLevel: number | null;
    onLevelChange: (level: number | null) => void;
    gridColumnSpan?: number;
    cardIndex?: number;
  }>();

  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = tryResolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  // TKA Level colors matching the existing pattern
  const levelConfig: Record<
    number,
    { name: string; gradient: string; shadowColor: string }
  > = {
    1: {
      name: "No Turns",
      gradient: `radial-gradient(ellipse at top left,
        rgb(186, 230, 253) 0%,
        rgb(125, 211, 252) 30%,
        rgb(56, 189, 248) 70%,
        rgb(14, 165, 233) 100%)`,
      shadowColor: "199deg 89% 48%",
    },
    2: {
      name: "Whole Turns",
      gradient: `radial-gradient(ellipse at top left,
        rgb(226, 232, 240) 0%,
        rgb(148, 163, 184) 30%,
        rgb(100, 116, 139) 70%,
        rgb(71, 85, 105) 100%)`,
      shadowColor: "215deg 16% 35%",
    },
    3: {
      name: "Half Turns",
      gradient: `radial-gradient(ellipse at top left,
        rgb(254, 240, 138) 0%,
        rgb(253, 224, 71) 20%,
        rgb(250, 204, 21) 40%,
        rgb(234, 179, 8) 60%,
        rgb(202, 138, 4) 80%,
        rgb(161, 98, 7) 100%)`,
      shadowColor: "45deg 93% 47%",
    },
  };

  // Default styling when no level selected
  const defaultGradient =
    "linear-gradient(135deg, var(--semantic-info), #1d4ed8)";
  const defaultShadowColor = "217deg 91% 60%";

  const currentConfig = $derived(
    currentLevel ? levelConfig[currentLevel] : null
  );
  const gradient = $derived(currentConfig?.gradient ?? defaultGradient);
  const shadowColor = $derived(
    currentConfig?.shadowColor ?? defaultShadowColor
  );
  const displayValue = $derived(
    currentLevel ? `Level ${currentLevel}` : "All Levels"
  );
  const description = $derived(currentConfig?.name ?? "Any difficulty");
  const textColor = $derived(
    currentLevel === 1 || currentLevel === 3 ? "black" : "white"
  );

  function handleDecrement() {
    hapticService?.trigger("selection");
    if (currentLevel === null) {
      onLevelChange(3);
    } else if (currentLevel > 1) {
      onLevelChange(currentLevel - 1);
    } else {
      onLevelChange(null);
    }
  }

  function handleIncrement() {
    hapticService?.trigger("selection");
    if (currentLevel === null) {
      onLevelChange(1);
    } else if (currentLevel < 3) {
      onLevelChange(currentLevel + 1);
    } else {
      onLevelChange(null);
    }
  }

  const canDecrement = $derived(true);
  const canIncrement = $derived(true);
</script>

<div
  class="level-card"
  style="--card-gradient: {gradient}; --shadow-color: {shadowColor}; --text-color: {textColor}; --card-index: {cardIndex}; grid-column: span {gridColumnSpan};"
  role="group"
  aria-label="Filter by difficulty level"
>
  <div class="card-header">
    <span class="card-title">Level</span>
  </div>

  <div class="stepper-controls">
    <button
      class="stepper-zone decrement"
      class:disabled={!canDecrement}
      onclick={handleDecrement}
      aria-label="Previous level"
      disabled={!canDecrement}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>

    <div class="value-display">
      <span class="level-value">{displayValue}</span>
      <span class="level-description">{description}</span>
    </div>

    <button
      class="stepper-zone increment"
      class:disabled={!canIncrement}
      onclick={handleIncrement}
      aria-label="Next level"
      disabled={!canIncrement}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  </div>
</div>

<style>
  .level-card {
    container-type: size;
    container-name: level-card;

    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;

    /* Maintain reasonable proportions - wider than tall */
    aspect-ratio: 4 / 3;
    min-height: 80px;
    max-height: 140px;
    width: 100%;
    min-width: 0;

    padding: clamp(8px, 2cqh, 14px) clamp(4px, 1cqw, 8px);

    border-radius: 16px;
    background: var(--card-gradient);
    border: none;

    box-shadow:
      0 1px 2px hsl(var(--shadow-color) / 0.15),
      0 2px 4px hsl(var(--shadow-color) / 0.12),
      0 4px 8px hsl(var(--shadow-color) / 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);

    transition: background 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    color: var(--text-color);
    text-align: center;

    animation: cardEnter 0.4s ease-out;
    animation-delay: calc(var(--card-index) * 50ms);
    animation-fill-mode: backwards;
  }

  /* Glossy sheen overlay */
  .level-card::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.3) 0%,
      rgba(255, 255, 255, 0.15) 40%,
      var(--theme-card-bg) 70%,
      rgba(255, 255, 255, 0) 100%
    );
    border-radius: 16px 16px 0 0;
    pointer-events: none;
    z-index: 1;
  }

  @keyframes cardEnter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .card-header {
    position: relative;
    z-index: 2;
    width: 100%;
    margin-bottom: clamp(4px, 1cqh, 8px);
  }

  .card-title {
    font-size: clamp(8px, 2.5cqw, 11px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.7;
  }

  .stepper-controls {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    flex: 1;
    gap: clamp(4px, 1cqw, 8px);
  }

  .stepper-zone {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(28px, 8cqw, 40px);
    height: clamp(28px, 8cqh, 40px);
    background: rgba(255, 255, 255, 0.15);
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    color: inherit;
  }

  .stepper-zone svg {
    width: clamp(14px, 4cqw, 20px);
    height: clamp(14px, 4cqw, 20px);
  }

  .stepper-zone:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(1.05);
  }

  .stepper-zone:active:not(.disabled) {
    transform: scale(0.95);
  }

  .stepper-zone.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .value-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-width: 0;
    gap: clamp(2px, 0.5cqh, 4px);
  }

  .level-value {
    font-size: clamp(14px, 4cqw, 22px);
    font-weight: 700;
    letter-spacing: 0.3px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    white-space: nowrap;
  }

  .level-description {
    font-size: clamp(9px, 2.5cqw, 12px);
    opacity: 0.8;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .level-card {
      animation: none;
      transition: none;
    }
    .stepper-zone {
      transition: none;
    }
  }
</style>
