<!--
FavoritesCard.svelte - Toggle card for favorites filter
Filter-specific card (not used in Generate)
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  let {
    isActive = false,
    disabled = false,
    gridColumnSpan = 2,
    cardIndex = 0,
    onToggle,
  }: {
    isActive?: boolean;
    disabled?: boolean;
    gridColumnSpan?: number;
    cardIndex?: number;
    onToggle: (active: boolean) => void;
  } = $props();

  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = container.items.hapticFeedback ?? null;
  });

  function handleToggle() {
    if (disabled) return;
    hapticService?.trigger("selection");
    onToggle(!isActive);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!disabled && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      handleToggle();
    }
  }

  const displayValue = $derived(isActive ? "On" : "Off");
</script>

<div
  class="favorites-card"
  class:active={isActive}
  class:disabled
  style="--card-index: {cardIndex}; grid-column: span {gridColumnSpan};"
  role="button"
  tabindex={disabled ? -1 : 0}
  aria-pressed={isActive}
  aria-label="Filter by favorites: {isActive ? 'active' : 'inactive'}"
  onclick={handleToggle}
  onkeydown={handleKeydown}
>
  <div class="card-header">
    <span class="card-title">Favorites</span>
  </div>

  <div class="heart-container">
    <svg
      class="heart-icon"
      class:filled={isActive}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={isActive ? "currentColor" : "none"}
        stroke="currentColor"
        stroke-width="2"
      />
    </svg>
  </div>

  <div class="status-text">{displayValue}</div>
</div>

<style>
  .favorites-card {
    container-type: size;
    container-name: favorites-card;

    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;

    /* Fill grid cell like Generate does */
    height: 100%;
    min-height: 80px;
    min-width: 0;

    padding: clamp(6px, 2cqh, 12px) clamp(4px, 1.5cqw, 8px);

    border-radius: 16px;
    background: radial-gradient(
      ellipse at top left,
      #4b5563 0%,
      #374151 40%,
      #1f2937 100%
    );
    border: none;
    cursor: pointer;
    color: white;
    text-align: center;

    /* Layered shadows matching Generate */
    box-shadow:
      0 1px 2px hsl(220deg 13% 20% / 0.15),
      0 2px 4px hsl(220deg 13% 20% / 0.12),
      0 4px 8px hsl(220deg 13% 20% / 0.1),
      inset 0 1px 0 var(--theme-stroke);

    transition:
      box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      background 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: visible;

    animation: cardEnter var(--duration-dramatic) ease-out;
  }

  .favorites-card.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .favorites-card.active {
    background: radial-gradient(
      ellipse at top left,
      #f472b6 0%,
      #ec4899 40%,
      #be185d 100%
    );
    box-shadow:
      0 1px 2px hsl(330deg 81% 45% / 0.15),
      0 2px 4px hsl(330deg 81% 45% / 0.12),
      0 4px 8px hsl(330deg 81% 45% / 0.1),
      0 0 20px hsl(330deg 81% 60% / 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  /* Glossy sheen overlay */
  .favorites-card::after {
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
      transparent 70%,
      rgba(255, 255, 255, 0) 100%
    );
    border-radius: 16px 16px 0 0;
    pointer-events: none;
    z-index: 1;
  }

  @media (hover: hover) {
    .favorites-card:not(.disabled):hover {
      transform: scale(1.02);
      filter: brightness(1.05);
      box-shadow:
        0 2px 4px hsl(220deg 13% 20% / 0.12),
        0 4px 8px hsl(220deg 13% 20% / 0.1),
        0 8px 16px hsl(220deg 13% 20% / 0.08),
        0 16px 24px hsl(220deg 13% 20% / 0.06),
        inset 0 1px 0 var(--theme-stroke);
    }

    .favorites-card.active:not(.disabled):hover {
      box-shadow:
        0 2px 4px hsl(330deg 81% 45% / 0.12),
        0 4px 8px hsl(330deg 81% 45% / 0.1),
        0 8px 16px hsl(330deg 81% 45% / 0.08),
        0 16px 24px hsl(330deg 81% 45% / 0.06),
        0 0 30px hsl(330deg 81% 60% / 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }
  }

  .favorites-card:not(.disabled):active {
    transform: scale(0.97);
    transition: transform var(--duration-instant) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .favorites-card:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.6);
    outline-offset: 3px;
  }

  @keyframes cardEnter {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .card-header {
    position: relative;
    z-index: 2;
    width: 100%;
    padding: clamp(3px, 0.8cqh, 6px) clamp(6px, 1.5cqw, 10px);
  }

  .card-title {
    font-size: clamp(8px, 2.5cqi, 11px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.2px;
    opacity: 0.9;
  }

  .heart-container {
    position: relative;
    z-index: 2;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .heart-icon {
    width: clamp(32px, 10cqw, 50px);
    height: clamp(32px, 10cqw, 50px);
    color: var(--theme-text-dim);
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .heart-icon.filled {
    color: white;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
    animation: heartPulse var(--duration-dramatic) ease;
  }

  @keyframes heartPulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
    }
  }

  .status-text {
    position: relative;
    z-index: 2;
    font-size: clamp(10px, 2.5cqw, 13px);
    font-weight: 500;
    color: var(--theme-text-dim);
    margin-top: clamp(4px, 1cqh, 8px);
  }

  .favorites-card.active .status-text {
    color: var(--theme-text);
  }

  @media (prefers-reduced-motion: reduce) {
    .favorites-card {
      animation: none;
      transition: none;
    }
    .heart-icon {
      transition: none;
    }
    .heart-icon.filled {
      animation: none;
    }
  }
</style>
