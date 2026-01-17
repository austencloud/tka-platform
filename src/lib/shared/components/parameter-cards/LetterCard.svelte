<!--
LetterCard.svelte - Unified starting letter selection card
Styled to match Generate module's BaseCard aesthetic
Opens a sheet/panel for letter selection
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IRippleEffect } from "$lib/shared/application/services/contracts/IRippleEffect";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  let {
    value = null,
    disabled = false,
    gridColumnSpan = 2,
    cardIndex = 0,
    onOpenSheet,
  }: {
    value?: string | null;
    disabled?: boolean;
    gridColumnSpan?: number;
    cardIndex?: number;
    onOpenSheet: () => void;
  } = $props();

  let hapticService: IHapticFeedback | null = null;
  let rippleService: IRippleEffect | null = null;
  let cardElement: HTMLDivElement | null = $state(null);

  onMount(() => {
    hapticService = container.items.hapticFeedback ?? null;
    rippleService = container.items.rippleEffect ?? null;

    if (cardElement && rippleService) {
      return rippleService.attachRipple(cardElement, {
        color: "rgba(255, 255, 255, 0.4)",
        duration: 600,
        opacity: 0.5,
      });
    }
    return undefined;
  });

  function handleClick() {
    if (disabled) return;
    hapticService?.trigger("selection");
    onOpenSheet();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!disabled && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      handleClick();
    }
  }

  const displayValue = $derived(value ?? "All");
</script>

<div
  bind:this={cardElement}
  class="letter-card"
  class:clickable={!disabled}
  class:disabled
  role="button"
  tabindex={disabled ? -1 : 0}
  onclick={handleClick}
  onkeydown={handleKeydown}
  aria-label="Starting letter: {displayValue}. Click to change."
  style="--card-index: {cardIndex}; grid-column: span {gridColumnSpan};"
>
  <div class="card-header">
    <span class="card-title">Letter</span>
  </div>

  <div class="card-value">
    {#if value}
      <span class="letter-value">{value}</span>
    {:else}
      <span class="letter-hint">A-Z</span>
    {/if}
  </div>

  <div class="click-indicator" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  </div>
</div>

<style>
  .letter-card {
    container-type: size;
    container-name: letter-card;

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
      #34d399 0%,
      var(--semantic-success) 40%,
      #059669 100%
    );
    border: none;
    color: white;
    text-align: center;

    /* Layered shadows matching Generate */
    box-shadow:
      0 1px 2px hsl(160deg 84% 39% / 0.15),
      0 2px 4px hsl(160deg 84% 39% / 0.12),
      0 4px 8px hsl(160deg 84% 39% / 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);

    transition:
      box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: visible;

    animation: cardEnter var(--duration-dramatic) ease-out;
  }

  .letter-card.clickable {
    cursor: pointer;
  }

  .letter-card.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Glossy sheen overlay */
  .letter-card::after {
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

  @media (hover: hover) {
    .letter-card.clickable:hover {
      transform: translateY(-2px);
      filter: brightness(1.08);
      box-shadow:
        0 2px 4px hsl(160deg 84% 39% / 0.12),
        0 4px 8px hsl(160deg 84% 39% / 0.1),
        0 8px 16px hsl(160deg 84% 39% / 0.08),
        0 16px 24px hsl(160deg 84% 39% / 0.06),
        0 0 40px hsl(160deg 84% 39% / 0.25);
    }
  }

  .letter-card.clickable:active {
    transform: translateY(0) scale(0.98);
    transition: all var(--duration-instant) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .letter-card:focus-visible {
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

  .card-value {
    position: relative;
    z-index: 2;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .letter-value {
    font-size: clamp(28px, 10cqw, 50px);
    font-weight: 800;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .letter-hint {
    font-size: clamp(14px, 5cqw, 24px);
    font-weight: 600;
    opacity: 0.7;
  }

  .click-indicator {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 20px;
    height: 20px;
    color: var(--theme-text-dim);
    opacity: 0;
    transition: opacity var(--duration-normal) ease;
    z-index: 2;
  }

  @media (hover: hover) {
    .letter-card.clickable:hover .click-indicator {
      opacity: 1;
    }
  }

  .click-indicator svg {
    width: 100%;
    height: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .letter-card {
      animation: none;
      transition: none;
    }
  }
</style>
