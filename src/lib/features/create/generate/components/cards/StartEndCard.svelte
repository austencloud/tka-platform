<!--
StartEndCard.svelte - Card for opening start/end position options
Opens sheet with start/end position selection
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { container } from "$lib/shared/di";
  import { onMount, getContext } from "svelte";
  import type { PanelCoordinationState } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
  import BaseCard from "./BaseCard.svelte";

  let {
    currentOptions,
    onOptionsChange,
    isFreeformMode = true,
    color = "linear-gradient(135deg, #64748b 0%, #475569 100%)", // Slate gray - classy
    shadowColor = "215deg 20% 40%", // Slate shadow
    gridColumnSpan = 2,
    cardIndex = 0,
    headerFontSize = "9px",
    positionsResetTrigger = 0,
    gridMode = GridMode.DIAMOND,
  } = $props<{
    currentOptions: StartEndOptions;
    onOptionsChange: (options: StartEndOptions) => void;
    isFreeformMode?: boolean;
    color?: string;
    shadowColor?: string;
    gridColumnSpan?: number;
    cardIndex?: number;
    headerFontSize?: string;
    positionsResetTrigger?: number;
    gridMode?: GridMode;
  }>();

  // Track reset animation state - initialized with 0, $effect syncs
  let isResetting = $state(false);
  let lastResetTrigger = $state(0);

  // Initialize lastResetTrigger on first run
  $effect(() => {
    if (lastResetTrigger === 0 && positionsResetTrigger > 0) {
      lastResetTrigger = positionsResetTrigger;
    }
  });

  // Watch for reset trigger changes and animate (use $effect.pre to sync with text update)
  $effect.pre(() => {
    if (positionsResetTrigger > lastResetTrigger) {
      isResetting = true;
      lastResetTrigger = positionsResetTrigger;

      // Clear animation after it completes
      setTimeout(() => {
        isResetting = false;
      }, 300);
    }
  });

  let hapticService: IHapticFeedback;

  // Get panel coordination state from context (provided by CreateModule)
  const panelState = getContext<PanelCoordinationState>("panelState");

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Open start/end panel via coordinator (renders at CreateModule level)
  function openExpanded() {
    hapticService?.trigger("selection");

    panelState?.openStartEndPanel?.(
      currentOptions,
      onOptionsChange,
      isFreeformMode,
      gridMode
    );
  }

  // Calculate display value - compact indicator only
  const displayValue = $derived.by(() => {
    // Count how many options are configured
    let configuredCount = 0;

    if (currentOptions.startPosition) {
      configuredCount++;
    }

    if (isFreeformMode && currentOptions.endPosition) {
      configuredCount++;
    }

    const letterCount =
      currentOptions.mustContainLetters.length +
      currentOptions.mustNotContainLetters.length;

    if (letterCount > 0) {
      configuredCount++;
    }

    // Show simple indicator
    if (configuredCount === 0) {
      return "None";
    }

    // Show count of configured options (with proper plural)
    return configuredCount === 1 ? "1 setting" : `${configuredCount} settings`;
  });
</script>

<div class="start-end-card-wrapper" class:resetting={isResetting}>
  <BaseCard
    title="Start/End"
    currentValue={displayValue}
    {color}
    {shadowColor}
    {gridColumnSpan}
    {cardIndex}
    {headerFontSize}
    onClick={openExpanded}
  />
</div>

<style>
  .start-end-card-wrapper {
    display: contents;
  }

  /* Slide up animation when positions are reset */
  .start-end-card-wrapper.resetting :global(.card-value) {
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    0% {
      transform: translateY(0);
      opacity: 1;
    }
    40% {
      transform: translateY(-10px);
      opacity: 0;
    }
    60% {
      transform: translateY(10px);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 1;
    }
  }

  /* Respect motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .start-end-card-wrapper.resetting :global(.card-value) {
      animation: none;
    }
  }
</style>
