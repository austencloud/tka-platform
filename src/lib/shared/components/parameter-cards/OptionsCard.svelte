<!--
OptionsCard.svelte - Card that opens a sheet for advanced filter options
Shows count of active options, click to open configuration sheet
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IRippleEffect } from "$lib/shared/application/services/contracts/IRippleEffect";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  let {
    activeCount = 0,
    disabled = false,
    gridColumnSpan = 2,
    cardIndex = 0,
    onOpenSheet,
  }: {
    activeCount?: number;
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

  function handleCardClick() {
    if (disabled) return;
    hapticService?.trigger("selection");
    onOpenSheet();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!disabled && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      handleCardClick();
    }
  }

  const displayValue = $derived(
    activeCount > 0 ? `${activeCount} active` : "Configure"
  );
</script>

<div
  bind:this={cardElement}
  class="options-card"
  class:disabled
  class:has-active={activeCount > 0}
  role="button"
  tabindex={disabled ? -1 : 0}
  onclick={handleCardClick}
  onkeydown={handleKeydown}
  aria-label="Position options: {displayValue}. Click to change."
  style="--card-index: {cardIndex}; grid-column: span {gridColumnSpan};"
>
  <div class="card-header">
    <span class="card-title">Options</span>
  </div>

  <div class="options-display">
    <span class="options-icon">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
    </span>
    <span class="options-value">{displayValue}</span>
  </div>

  <div class="click-indicator" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  </div>
</div>

<style>
  .options-card {
    container-type: size;
    container-name: options-card;

    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;

    height: 100%;
    min-height: 80px;
    min-width: 0;

    padding: clamp(6px, 2cqh, 12px) clamp(4px, 1.5cqw, 8px);

    border-radius: 16px;
    background: radial-gradient(
      ellipse at top left,
      #a78bfa 0%,
      var(--theme-accent-strong) 40%,
      #7c3aed 100%
    );
    border: none;
    color: white;
    text-align: center;

    box-shadow:
      0 1px 2px hsl(270deg 70% 55% / 0.15),
      0 2px 4px hsl(270deg 70% 55% / 0.12),
      0 4px 8px hsl(270deg 70% 55% / 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);

    transition:
      box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: visible;
    cursor: pointer;

    animation: cardEnter 0.4s ease-out;
    animation-delay: calc(var(--card-index) * 50ms);
    animation-fill-mode: backwards;
  }

  .options-card.has-active {
    background: radial-gradient(
      ellipse at top left,
      #34d399 0%,
      var(--semantic-success) 40%,
      #059669 100%
    );
    box-shadow:
      0 1px 2px hsl(160deg 70% 45% / 0.15),
      0 2px 4px hsl(160deg 70% 45% / 0.12),
      0 4px 8px hsl(160deg 70% 45% / 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .options-card.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .options-card::after {
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
    .options-card:hover {
      transform: scale(1.02);
      filter: brightness(1.05);
      box-shadow:
        0 2px 4px hsl(270deg 70% 55% / 0.12),
        0 4px 8px hsl(270deg 70% 55% / 0.1),
        0 8px 16px hsl(270deg 70% 55% / 0.08),
        0 16px 24px hsl(270deg 70% 55% / 0.06),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    .options-card.has-active:hover {
      box-shadow:
        0 2px 4px hsl(160deg 70% 45% / 0.12),
        0 4px 8px hsl(160deg 70% 45% / 0.1),
        0 8px 16px hsl(160deg 70% 45% / 0.08),
        0 16px 24px hsl(160deg 70% 45% / 0.06),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }
  }

  .options-card:active {
    transform: scale(0.97);
    transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .options-card:focus-visible {
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

  .options-display {
    position: relative;
    z-index: 2;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .options-icon {
    width: clamp(20px, 4cqw, 28px);
    height: clamp(20px, 4cqw, 28px);
    opacity: 0.9;
  }

  .options-icon svg {
    width: 100%;
    height: 100%;
  }

  .options-value {
    font-size: clamp(12px, 3cqw, 16px);
    font-weight: 600;
    letter-spacing: 0.3px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    white-space: nowrap;
  }

  .click-indicator {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 20px;
    height: 20px;
    color: var(--theme-text-dim);
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 2;
  }

  @media (hover: hover) {
    .options-card:hover .click-indicator {
      opacity: 1;
    }
  }

  .click-indicator svg {
    width: 100%;
    height: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .options-card {
      animation: none;
      transition: none;
    }
  }
</style>
