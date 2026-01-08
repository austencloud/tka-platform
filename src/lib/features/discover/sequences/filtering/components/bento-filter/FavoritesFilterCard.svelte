<!--
FavoritesFilterCard.svelte - Card with toggle heart for favorites filter
Single tap toggles favorites on/off
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";

  let {
    isActive = false,
    onToggle,
    gridColumnSpan = 2,
    cardIndex = 0,
  } = $props<{
    isActive: boolean;
    onToggle: (active: boolean) => void;
    gridColumnSpan?: number;
    cardIndex?: number;
  }>();

  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = tryResolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  function handleToggle() {
    hapticService?.trigger("selection");
    onToggle(!isActive);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggle();
    }
  }

  const displayValue = $derived(isActive ? "On" : "Off");
</script>

<div
  class="favorites-card"
  class:active={isActive}
  style="--card-index: {cardIndex}; grid-column: span {gridColumnSpan};"
  role="button"
  tabindex="0"
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

    /* Maintain reasonable proportions */
    aspect-ratio: 4 / 3;
    min-height: 80px;
    max-height: 140px;
    width: 100%;
    min-width: 0;

    padding: clamp(8px, 2cqh, 14px) clamp(6px, 2cqw, 10px);

    border-radius: 16px;
    background: linear-gradient(135deg, #374151, #1f2937);
    border: none;
    cursor: pointer;

    box-shadow:
      0 1px 2px hsl(220deg 13% 20% / 0.15),
      0 2px 4px hsl(220deg 13% 20% / 0.12),
      0 4px 8px hsl(220deg 13% 20% / 0.1),
      inset 0 1px 0 var(--theme-stroke);

    overflow: hidden;
    color: white;
    text-align: center;

    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    animation: cardEnter 0.4s ease-out;
    animation-delay: calc(var(--card-index) * 50ms);
    animation-fill-mode: backwards;
  }

  .favorites-card.active {
    background: linear-gradient(135deg, #ec4899, #be185d);
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
      rgba(255, 255, 255, 0.2) 0%,
      rgba(255, 255, 255, 0.1) 40%,
      rgba(255, 255, 255, 0.03) 70%,
      rgba(255, 255, 255, 0) 100%
    );
    border-radius: 16px 16px 0 0;
    pointer-events: none;
    z-index: 1;
  }

  @media (hover: hover) {
    .favorites-card:hover {
      transform: translateY(-2px);
      filter: brightness(1.1);
    }
  }

  .favorites-card:active {
    transform: scale(0.97);
  }

  .favorites-card:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.6);
    outline-offset: 3px;
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
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .heart-icon.filled {
    color: white;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
    animation: heartPulse 0.4s ease;
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
