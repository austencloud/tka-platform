<!--
FilterBaseCard.svelte - Base component for filter Bento cards
Provides consistent styling matching the Generate tab's card aesthetic
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IRippleEffect } from "$lib/shared/application/services/contracts/IRippleEffect";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";

  let {
    title,
    currentValue,
    color = "var(--semantic-info)",
    shadowColor = "220deg 60% 30%",
    clickable = true,
    gridColumnSpan = 2,
    cardIndex = 0,
    onClick,
    children,
  } = $props<{
    title: string;
    currentValue: string;
    color?: string;
    shadowColor?: string;
    clickable?: boolean;
    gridColumnSpan?: number;
    cardIndex?: number;
    onClick?: () => void;
    children?: import("svelte").Snippet;
  }>();

  let hapticService: IHapticFeedback | null = null;
  let rippleService: IRippleEffect | null = null;
  let cardElement: HTMLDivElement | null = $state(null);

  onMount(() => {
    hapticService = tryResolve<IHapticFeedback>(TYPES.IHapticFeedback);
    rippleService = tryResolve<IRippleEffect>(TYPES.IRippleEffect);

    if (clickable && cardElement && rippleService) {
      return rippleService.attachRipple(cardElement, {
        color: "rgba(255, 255, 255, 0.4)",
        duration: 600,
        opacity: 0.5,
      });
    }
    return undefined;
  });

  function handleClick() {
    if (clickable && onClick) {
      hapticService?.trigger("selection");
      onClick();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (clickable && onClick && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      handleClick();
    }
  }
</script>

{#if clickable}
  <div
    bind:this={cardElement}
    class="filter-card clickable"
    role="button"
    tabindex="0"
    onclick={handleClick}
    onkeydown={handleKeydown}
    aria-label="{title}: {currentValue}. Click to change."
    style="--card-color: {color}; --shadow-color: {shadowColor}; --card-index: {cardIndex}; grid-column: span {gridColumnSpan};"
  >
    <div class="card-header">
      <span class="card-title">{title}</span>
    </div>

    <div class="card-value">
      {currentValue}
    </div>

    {#if children}
      <div class="card-content">
        {@render children()}
      </div>
    {/if}

    <div class="click-indicator" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  </div>
{:else}
  <div
    class="filter-card"
    aria-label="{title}: {currentValue}"
    style="--card-color: {color}; --shadow-color: {shadowColor}; --card-index: {cardIndex}; grid-column: span {gridColumnSpan};"
  >
    <div class="card-header">
      <span class="card-title">{title}</span>
    </div>

    <div class="card-value">
      {currentValue}
    </div>

    {#if children}
      <div class="card-content">
        {@render children()}
      </div>
    {/if}
  </div>
{/if}

<style>
  .filter-card {
    container-type: size;
    container-name: filter-card;

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
    background: var(--card-color);
    border: none;

    /* Layered shadows with color-matching */
    box-shadow:
      0 1px 2px hsl(var(--shadow-color) / 0.15),
      0 2px 4px hsl(var(--shadow-color) / 0.12),
      0 4px 8px hsl(var(--shadow-color) / 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);

    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: visible;
    color: white;
    text-align: center;

    animation: cardEnter 0.4s ease-out;
    animation-delay: calc(var(--card-index) * 50ms);
    animation-fill-mode: backwards;
  }

  /* Glossy sheen overlay */
  .filter-card::after {
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

  @media (hover: hover) {
    .filter-card.clickable:hover {
      transform: translateY(-2px);
      filter: brightness(1.08);
      box-shadow:
        0 2px 4px hsl(var(--shadow-color) / 0.12),
        0 4px 8px hsl(var(--shadow-color) / 0.1),
        0 8px 16px hsl(var(--shadow-color) / 0.08),
        0 16px 24px hsl(var(--shadow-color) / 0.06),
        0 0 40px hsl(var(--shadow-color) / 0.2);
    }
  }

  .filter-card.clickable:active {
    transform: translateY(0) scale(0.98);
    transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
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

  .filter-card.clickable {
    cursor: pointer;
  }

  .filter-card:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.6);
    outline-offset: 3px;
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

  .card-value {
    position: relative;
    z-index: 2;
    font-size: clamp(14px, 4cqw, 24px);
    font-weight: 700;
    letter-spacing: 0.3px;
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    color: white;
    text-align: center;
    line-height: 1.2;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    margin: clamp(4px, 1cqh, 8px) 0;
  }

  .card-content {
    position: relative;
    z-index: 2;
    width: 100%;
  }

  .click-indicator {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 18px;
    height: 18px;
    color: rgba(255, 255, 255, 0.4);
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 2;
  }

  @media (hover: hover) {
    .filter-card.clickable:hover .click-indicator {
      opacity: 1;
    }
  }

  .click-indicator svg {
    width: 100%;
    height: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .filter-card {
      animation: none;
    }
  }
</style>
