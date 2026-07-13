<!--
ConsolidatedLOOPCard.svelte - Single LOOP card that absorbs toggle, type, and slice size
Shows "Off" when disabled, LOOP type name when enabled. Click opens the expanded overlay.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import {
    LOOPType,
  } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { parseLoopComponents } from "$lib/shared/create/services/loop-type-utils";
  import { onMount, getContext } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import type { PanelCoordinationState } from "$lib/shared/create/state/panel-coordination-state.svelte";
  import CardHeader from "./shared/CardHeader.svelte";

  let {
    loopEnabled,
    currentLOOPType,
    onLoopToggle,
    onLOOPTypeChange,
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    loopEnabled: boolean;
    currentLOOPType: LOOPType;
    onLoopToggle: () => void;
    onLOOPTypeChange: (loopType: LOOPType) => void;
    cardIndex?: number;
    headerFontSize?: string;
  }>();

  let hapticService: HapticFeedback | null = $state(null);
  const panelState = getContext<PanelCoordinationState>("panelState");

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Selected components for the overlay
  const selectedComponents = $derived(
    parseLoopComponents(currentLOOPType)
  );

  // Display value: "Off" or the LOOP type name
  const displayValue = $derived.by(() => {
    if (!loopEnabled) return "Off";
    const typeMap: Record<LOOPType, string> = {
      [LOOPType.ROTATED]: t("generator_loop_rotated"),
      [LOOPType.MIRRORED]: t("generator_loop_mirrored"),
      [LOOPType.FLIPPED]: t("generator_loop_flipped"),
      [LOOPType.SWAPPED]: t("generator_loop_swapped"),
      [LOOPType.INVERTED]: t("generator_loop_inverted"),
      [LOOPType.SWAPPED_INVERTED]: t("generator_loop_swapped_inverted"),
      [LOOPType.MIRRORED_SWAPPED]: t("generator_loop_mirrored_swapped"),
      [LOOPType.ROTATED_INVERTED]: t("generator_loop_rotated_inverted"),
      [LOOPType.MIRRORED_INVERTED]: t("generator_loop_mirrored_inverted"),
      [LOOPType.ROTATED_SWAPPED]: t("generator_loop_rotated_swapped"),
      [LOOPType.MIRRORED_ROTATED]: t("generator_loop_mirrored_rotated"),
      [LOOPType.MIRRORED_INVERTED_ROTATED]: t("generator_loop_mir_comp_rot"),
      [LOOPType.MIRRORED_SWAPPED_INVERTED]: t("generator_loop_mirrored_swapped") + " + " + t("generator_loop_inverted"),
      [LOOPType.ROTATED_SWAPPED_INVERTED]: t("generator_loop_rotated_swapped") + " + " + t("generator_loop_inverted"),
      [LOOPType.MIRRORED_ROTATED_SWAPPED]: t("generator_loop_mirrored_rotated") + " + " + t("generator_loop_swapped"),
      [LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED]: t("generator_loop_all_four"),
      [LOOPType.STRICT_REWOUND]: t("generator_loop_rewound"),
    };
    // Fallback: strip "strict_" prefix and title-case for unmapped legacy values
    return typeMap[currentLOOPType as keyof typeof typeMap] ||
      currentLOOPType.replace(/^strict_/, "").split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" / ");
  });

  function handleClick() {
    hapticService?.trigger("selection");

    if (!loopEnabled) {
      // Toggle on, then open overlay
      onLoopToggle();
      // Open after toggle takes effect (next tick)
      queueMicrotask(() => {
        panelState.openLOOPPanel(
          currentLOOPType,
          selectedComponents,
          onLOOPTypeChange
        );
      });
    } else {
      // Already on - open the overlay to configure
      panelState.openLOOPPanel(
        currentLOOPType,
        selectedComponents,
        onLOOPTypeChange
      );
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<div
  class="loop-card-wrapper"
  class:enabled={loopEnabled}
  style="--card-index: {cardIndex};"
>
  <button
    class="loop-consolidated-card"
    class:enabled={loopEnabled}
    onclick={handleClick}
    onkeydown={handleKeydown}
    aria-label="LOOP: {displayValue}. Click to configure."
  >
    <CardHeader title="LOOP" {headerFontSize} />
    <div class="card-value">{displayValue}</div>
  </button>
</div>

<style>
  .loop-card-wrapper {
    container-type: size;
    container-name: loop-card;
    position: relative;
    border-radius: 16px;
    overflow: visible;

    /* Off state: muted background */
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

  /* On state: accent gradient with shimmer */
  .loop-card-wrapper.enabled {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 80%, var(--theme-card-bg)) 0%,
      color-mix(in srgb, var(--theme-accent, #818cf8) 60%, var(--theme-card-bg)) 50%,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 70%, var(--theme-card-bg)) 100%
    );
    background-size: 200% 200%;
    animation: accentShimmer 6s ease-in-out infinite;
    box-shadow:
      0 2px 4px var(--theme-shadow),
      0 4px 12px color-mix(in srgb, var(--theme-accent) 20%, transparent),
      inset 0 1px 0 var(--theme-stroke-strong);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  @keyframes accentShimmer {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .loop-consolidated-card {
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
    background: transparent;
    border: none;
    color: white;
    text-align: center;
    cursor: pointer;
    font-family: inherit;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  /* Glossy sheen */
  .loop-consolidated-card::after {
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

  .loop-consolidated-card.enabled::after {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-text) 30%, transparent) 0%,
      color-mix(in srgb, var(--theme-text) 15%, transparent) 40%,
      color-mix(in srgb, var(--theme-text) 5%, transparent) 70%,
      transparent 100%
    );
  }

  /* Text readable over both states */
  .loop-card-wrapper :global(.card-header),
  .card-value {
    text-shadow:
      0 1px 2px var(--theme-shadow),
      0 2px 4px color-mix(in srgb, var(--theme-shadow) 20%, transparent);
  }

  @media (hover: hover) {
    .loop-card-wrapper:hover {
      transform: scale(1.02);
      filter: brightness(1.08);
    }
    .loop-card-wrapper.enabled:hover {
      box-shadow:
        0 2px 4px var(--theme-shadow),
        0 6px 16px color-mix(in srgb, var(--theme-accent) 30%, transparent),
        0 12px 24px color-mix(in srgb, var(--theme-accent) 15%, transparent),
        inset 0 1px 0 var(--theme-stroke-strong);
    }
  }

  .loop-card-wrapper:active {
    transform: scale(0.97);
    transition: transform var(--duration-instant) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .card-value {
    font-size: var(--card-text-size);
    font-weight: var(--card-text-weight);
    letter-spacing: var(--card-text-spacing);
    color: white;
    text-align: center;
    line-height: 1.1;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Multi-component labels ("Mirrored / Inverted / Rotated") are wider than one
       line. nowrap + the wrapper's overflow:visible let them spill past the card
       edges (see screenshot). Wrap and clip to the card so every selected
       component stays inside the button. */
    white-space: normal;
    overflow-wrap: anywhere;
    overflow: hidden;
    width: 100%;
    margin: clamp(2px, 0.5cqh, 4px) 0;
    position: relative;
    z-index: 2;
  }

  .loop-consolidated-card:focus-visible {
    outline: 2px solid var(--theme-stroke-strong);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .loop-card-wrapper {
      animation: none;
      transition: none;
    }
  }
</style>
