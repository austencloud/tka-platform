<!--
LOOPToggleCard.svelte - Always-visible toggle for enabling/disabling LOOP mode
When off: dimmed appearance with muted gradient
When on: accent gradient matching the LOOP card family
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import CardHeader from "./shared/CardHeader.svelte";

  let {
    enabled,
    onToggle,
    color = "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    shadowColor = "25deg 75% 50%",
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    enabled: boolean;
    onToggle: () => void;
    color?: string;
    shadowColor?: string;
    cardIndex?: number;
    headerFontSize?: string;
  }>();

  let hapticService: IHapticFeedback | null = $state(null);

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  function handleClick() {
    hapticService?.trigger("selection");
    onToggle();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<button
  class="loop-toggle-card"
  class:enabled
  style="--card-color: {color}; --shadow-color: {shadowColor}; --card-index: {cardIndex};"
  onclick={handleClick}
  onkeydown={handleKeydown}
  aria-label="LOOP: {enabled ? 'On' : 'Off'}. Click to toggle."
  aria-pressed={enabled}
>
  <CardHeader title="LOOP" {headerFontSize} />
  <div class="card-value">{enabled ? "On" : "Off"}</div>
</button>

<style>
  .loop-toggle-card {
    container-type: size;
    container-name: loop-toggle;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    padding: clamp(6px, 2cqh, 12px) clamp(4px, 1.5cqw, 8px);
    border-radius: 16px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    color: white;
    text-align: center;
    border: none;
    font-family: inherit;

    /* Off state: muted, desaturated */
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-card-bg) 70%, #78716c) 0%,
      color-mix(in srgb, var(--theme-card-bg) 60%, #57534e) 100%
    );
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.12),
      0 1px 2px rgba(0, 0, 0, 0.15),
      0 2px 4px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 var(--theme-stroke);

    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Glossy sheen overlay */
  .loop-toggle-card::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-text) 20%, transparent) 0%,
      color-mix(in srgb, var(--theme-text) 10%, transparent) 40%,
      transparent 70%
    );
    border-radius: 16px 16px 0 0;
    pointer-events: none;
    z-index: 1;
  }

  /* On state: accent gradient matching LOOP card family */
  .loop-toggle-card.enabled {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 80%, var(--theme-card-bg)) 0%,
      color-mix(in srgb, var(--theme-accent, #818cf8) 60%, var(--theme-card-bg)) 50%,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 70%, var(--theme-card-bg)) 100%
    );
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.12),
      0 1px 2px hsl(var(--shadow-color) / 0.15),
      0 2px 4px hsl(var(--shadow-color) / 0.12),
      0 4px 8px hsl(var(--shadow-color) / 0.1),
      0 0 12px color-mix(in srgb, var(--theme-accent) 20%, transparent),
      inset 0 1px 0 var(--theme-stroke);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  /* Brighter sheen when enabled */
  .loop-toggle-card.enabled::after {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-text) 30%, transparent) 0%,
      color-mix(in srgb, var(--theme-text) 15%, transparent) 40%,
      color-mix(in srgb, var(--theme-text) 5%, transparent) 70%,
      transparent 100%
    );
  }

  @media (hover: hover) {
    .loop-toggle-card:hover {
      transform: translateY(-2px);
      filter: brightness(1.08);
      box-shadow:
        0 2px 4px hsl(var(--shadow-color) / 0.12),
        0 4px 8px hsl(var(--shadow-color) / 0.1),
        0 8px 16px hsl(var(--shadow-color) / 0.08),
        0 16px 24px hsl(var(--shadow-color) / 0.06),
        0 0 40px hsl(var(--shadow-color) / 0.25);
    }
  }

  .loop-toggle-card:active {
    transform: translateY(0) scale(0.98);
    transition: all var(--duration-instant) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .card-value {
    font-size: var(--card-text-size);
    font-weight: var(--card-text-weight);
    letter-spacing: var(--card-text-spacing);
    text-shadow: var(--card-text-shadow);
    color: white;
    text-align: center;
    line-height: 1.1;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    width: 100%;
    margin: clamp(2px, 0.5cqh, 4px) 0;
    position: relative;
    z-index: 2;
  }

  .loop-toggle-card:focus-visible {
    outline: 2px solid var(--theme-stroke-strong);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .loop-toggle-card {
      transition: none;
    }
  }
</style>
