<!--
ParameterCardBase.svelte - Base component for parameter cards
Used by both Generate and Discover for consistent Bento card styling
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IRippleEffect } from "$lib/shared/application/services/contracts/IRippleEffect";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  let {
    title,
    subtitle = "",
    gradient = "linear-gradient(135deg, var(--semantic-info), #1d4ed8)",
    shadowColor = "217deg 91% 60%",
    textColor = "white",
    clickable = false,
    disabled = false,
    gridColumnSpan = 2,
    cardIndex = 0,
    aspectRatio = "4 / 3",
    onClick,
    children,
  }: {
    title: string;
    subtitle?: string;
    gradient?: string;
    shadowColor?: string;
    textColor?: "white" | "black";
    clickable?: boolean;
    disabled?: boolean;
    gridColumnSpan?: number;
    cardIndex?: number;
    aspectRatio?: string;
    onClick?: () => void;
    children?: import("svelte").Snippet;
  } = $props();

  let hapticService: IHapticFeedback | null = null;
  let rippleService: IRippleEffect | null = null;
  let cardElement: HTMLDivElement | null = $state(null);

  onMount(() => {
    hapticService = container.items.hapticFeedback ?? null;
    rippleService = container.items.rippleEffect ?? null;

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
    if (clickable && onClick && !disabled) {
      hapticService?.trigger("selection");
      onClick();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (
      clickable &&
      onClick &&
      !disabled &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={cardElement}
  class="parameter-card"
  class:clickable
  class:disabled
  role={clickable ? "button" : "group"}
  tabindex={clickable ? 0 : undefined}
  aria-disabled={disabled}
  onclick={handleClick}
  onkeydown={handleKeydown}
  style="
    --card-gradient: {gradient};
    --shadow-color: {shadowColor};
    --text-color: {textColor};
    --card-index: {cardIndex};
    --aspect-ratio: {aspectRatio};
    grid-column: span {gridColumnSpan};
  "
>
  <div class="card-header">
    <span class="card-title">{title}</span>
  </div>

  <div class="card-content">
    {#if children}
      {@render children()}
    {/if}
  </div>

  {#if subtitle}
    <div class="card-subtitle">{subtitle}</div>
  {/if}

  {#if clickable && !disabled}
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
  {/if}
</div>

<style>
  .parameter-card {
    container-type: size;
    container-name: parameter-card;

    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;

    aspect-ratio: var(--aspect-ratio, 4 / 3);
    min-height: 80px;
    max-height: 140px;
    width: 100%;
    min-width: 0;

    padding: clamp(8px, 2cqh, 14px) clamp(6px, 2cqw, 10px);

    border-radius: 16px;
    background: var(--card-gradient);
    border: none;
    color: var(--text-color, white);
    text-align: center;

    box-shadow:
      0 1px 2px hsl(var(--shadow-color) / 0.15),
      0 2px 4px hsl(var(--shadow-color) / 0.12),
      0 4px 8px hsl(var(--shadow-color) / 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);

    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;

    animation: cardEnter var(--duration-dramatic) ease-out;
    animation-delay: calc(var(--card-index) * 50ms);
    animation-fill-mode: backwards;
  }

  /* Glossy sheen overlay */
  .parameter-card::after {
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

  .parameter-card.clickable {
    cursor: pointer;
  }

  .parameter-card.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (hover: hover) {
    .parameter-card.clickable:not(.disabled):hover {
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

  .parameter-card.clickable:not(.disabled):active {
    transform: translateY(0) scale(0.98);
    transition: all var(--duration-instant) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .parameter-card:focus-visible {
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
    opacity: 0.7;
  }

  .card-content {
    position: relative;
    z-index: 2;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    margin: clamp(4px, 1cqh, 8px) 0;
  }

  .card-subtitle {
    position: relative;
    z-index: 2;
    font-size: clamp(9px, 2.5cqw, 12px);
    opacity: 0.8;
    white-space: nowrap;
  }

  .click-indicator {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 18px;
    height: 18px;
    opacity: 0;
    transition: opacity var(--duration-normal) ease;
    z-index: 2;
  }

  @media (hover: hover) {
    .parameter-card.clickable:hover .click-indicator {
      opacity: 0.6;
    }
  }

  .click-indicator svg {
    width: 100%;
    height: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .parameter-card {
      animation: none;
    }
  }
</style>
