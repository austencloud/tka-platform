<!--
PositionFilterCard.svelte - Card with inline pill toggles for position selection
Supports Alpha, Beta, Gamma starting positions
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";

  let {
    currentPosition = null,
    onPositionChange,
    gridColumnSpan = 2,
    cardIndex = 0,
  } = $props<{
    currentPosition: string | null;
    onPositionChange: (position: string | null) => void;
    gridColumnSpan?: number;
    cardIndex?: number;
  }>();

  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = tryResolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  const positions = [
    { id: "alpha", label: "α", fullName: "Alpha" },
    { id: "beta", label: "β", fullName: "Beta" },
    { id: "gamma", label: "γ", fullName: "Gamma" },
  ];

  function handlePositionClick(positionId: string) {
    hapticService?.trigger("selection");
    if (currentPosition === positionId) {
      onPositionChange(null);
    } else {
      onPositionChange(positionId);
    }
  }

  const displayValue = $derived(
    currentPosition
      ? (positions.find((p) => p.id === currentPosition)?.fullName ??
          currentPosition)
      : "Any"
  );
</script>

<div
  class="position-card"
  style="--card-index: {cardIndex}; grid-column: span {gridColumnSpan};"
  role="group"
  aria-label="Filter by starting position"
>
  <div class="card-header">
    <span class="card-title">Position</span>
  </div>

  <div class="current-value">{displayValue}</div>

  <div class="pill-toggle">
    {#each positions as position}
      <button
        class="pill-option"
        class:selected={currentPosition === position.id}
        onclick={() => handlePositionClick(position.id)}
        aria-label="{position.fullName} position"
        aria-pressed={currentPosition === position.id}
      >
        <span class="pill-symbol">{position.label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .position-card {
    container-type: size;
    container-name: position-card;

    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;

    /* Maintain reasonable proportions */
    aspect-ratio: 4 / 3;
    min-height: 80px;
    max-height: 140px;
    width: 100%;
    min-width: 0;

    padding: clamp(8px, 2cqh, 14px) clamp(6px, 2cqw, 10px);

    border-radius: 16px;
    background: linear-gradient(
      135deg,
      var(--theme-accent-strong, var(--theme-accent-strong)),
      var(--theme-accent-strong)
    );
    border: none;

    box-shadow:
      0 1px 2px
        color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent-strong)) 40%,
          transparent
        ),
      0 2px 4px
        color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent-strong)) 32%,
          transparent
        ),
      0 4px 8px
        color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent-strong)) 25%,
          transparent
        ),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);

    overflow: hidden;
    color: white;
    text-align: center;

    animation: cardEnter 0.4s ease-out;
    animation-delay: calc(var(--card-index) * 50ms);
    animation-fill-mode: backwards;
  }

  /* Glossy sheen overlay */
  .position-card::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.25) 0%,
      var(--theme-card-hover-bg) 40%,
      rgba(255, 255, 255, 0.04) 70%,
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
  }

  .card-title {
    font-size: clamp(8px, 2.5cqw, 11px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim);
  }

  .current-value {
    position: relative;
    z-index: 2;
    font-size: clamp(14px, 4cqw, 22px);
    font-weight: 700;
    letter-spacing: 0.3px;
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: clamp(4px, 1cqh, 8px) 0;
  }

  .pill-toggle {
    position: relative;
    z-index: 2;
    display: flex;
    gap: clamp(4px, 1cqw, 8px);
    background: rgba(0, 0, 0, 0.2);
    padding: clamp(3px, 0.8cqh, 5px);
    border-radius: 100px;
  }

  .pill-option {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: clamp(32px, 8cqw, 44px);
    min-height: clamp(28px, 6cqh, 36px);
    padding: 0 clamp(8px, 2cqw, 12px);
    background: transparent;
    border: none;
    border-radius: 100px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pill-option:hover:not(.selected) {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text);
  }

  .pill-option.selected {
    background: rgba(255, 255, 255, 0.95);
    color: var(--theme-accent-strong);
    box-shadow: 0 2px 8px var(--theme-shadow);
  }

  .pill-option:active {
    transform: scale(0.95);
  }

  .pill-symbol {
    font-size: clamp(12px, 3cqw, 16px);
    font-weight: 600;
  }

  @media (prefers-reduced-motion: reduce) {
    .position-card {
      animation: none;
    }
    .pill-option {
      transition: none;
    }
  }
</style>
