<!--
LOOPCard.svelte - Card for selecting LOOP type
Always opens selector panel when clicked
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { ILOOPTypeResolver } from "$lib/features/create/generate/shared/services/contracts/ILOOPTypeResolver";
  import {
    LOOP_TYPE_LABELS,
    LOOPType,
  } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import { container } from "$lib/shared/di";
  import { onMount, getContext } from "svelte";
  import type { PanelCoordinationState } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
  import BaseCard from "./BaseCard.svelte";

  let {
    currentLOOPType,
    onLOOPTypeChange,
    shadowColor = "30deg 75% 55%", // Orange shadow
    gridColumnSpan = 2,
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    currentLOOPType: LOOPType;
    onLOOPTypeChange: (loopType: LOOPType) => void;
    shadowColor?: string;
    gridColumnSpan?: number;
    cardIndex?: number;
    headerFontSize?: string;
  }>();

  let hapticService: IHapticFeedback;
  let LOOPTypeResolver: ILOOPTypeResolver = container.items.loopTypeResolver;

  // Get panel coordination state from context (provided by CreateModule)
  const panelState = getContext<PanelCoordinationState>("panelState");

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Get current selected components using service
  const selectedComponents = $derived(
    LOOPTypeResolver.parseComponents(currentLOOPType)
  );

  // Open LOOP panel via coordinator (renders at CreateModule level)
  function openExpanded() {
    hapticService?.trigger("selection");

    // Open the LOOP panel via coordinator - this renders at CreateModule level
    // so the backdrop will properly cover the workspace
    panelState.openLOOPPanel(
      currentLOOPType,
      selectedComponents,
      onLOOPTypeChange
    );
  }

  // Format LOOP type display using user-friendly labels
  const loopTypeDisplay = $derived(
    LOOP_TYPE_LABELS[currentLOOPType as LOOPType] || currentLOOPType
  );
</script>

<!-- LOOP card with animated gradient wrapper -->
<div
  class="loop-card-wrapper"
  style="grid-column: span {gridColumnSpan}; --card-index: {cardIndex};"
>
  <BaseCard
    title="LOOP Type"
    currentValue={loopTypeDisplay}
    color="transparent"
    {shadowColor}
    gridColumnSpan={1}
    {cardIndex}
    {headerFontSize}
    onClick={openExpanded}
  />
</div>

<!-- LOOP Selection Modal now renders at CreateModule level via LOOPCoordinator -->

<style>
  /* Animated LOOP Card - Flowing Gradient Wrapper */

  /* The wrapper has a beautiful animated gradient background */
  .loop-card-wrapper {
    /* Enable container queries to detect card width AND height */
    container-type: size;
    container-name: loop-card;

    position: relative;
    border-radius: 16px;
    overflow: visible; /* Allow hover effects to overflow and pop */

    /* Accessible rainbow gradient - deeper tones for better white text contrast */
    background: linear-gradient(
      135deg,
      #d32f2f 0%,
      /* Deep Red */ #e64a19 14%,
      /* Rich Orange */ #f57c00 28%,
      /* Amber Gold */ #388e3c 42%,
      /* Forest Green */ #00897b 57%,
      /* Teal */ #1976d2 71%,
      /* Deep Blue */ #7b1fa2 85%,
      /* Rich Purple */ #c2185b 100% /* Deep Magenta */
    );

    /* Make gradient larger so it can flow */
    background-size: 200% 200%;

    /* Animate the gradient position for flowing effect */
    animation:
      gradientFlow 8s ease-in-out infinite,
      cardEnter 0.4s ease-out;

    /* Subtle shadow - consistent with other cards */
    box-shadow:
      0 2px 4px var(--theme-shadow),
      0 4px 8px color-mix(in srgb, var(--theme-shadow) 10%, transparent),
      inset 0 1px 0 var(--theme-stroke-strong);
  }

  /* Flowing gradient animation */
  @keyframes gradientFlow {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  /* The BaseCard inside is transparent to show the wrapper's background */
  /* Disable its entrance animation since the wrapper handles it */
  .loop-card-wrapper :global(.base-card) {
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
    /* Remove entrance animation - the wrapper handles it */
    animation: none !important;
  }

  /* Ensure text is always readable with subtle shadow */
  .loop-card-wrapper :global(.base-card .card-header),
  .loop-card-wrapper :global(.base-card .card-value) {
    text-shadow:
      0 1px 2px var(--theme-shadow),
      0 2px 4px color-mix(in srgb, var(--theme-shadow) 20%, transparent);
  }

  /* Maintain hover effects - only on hover-capable devices */
  @media (hover: hover) {
    .loop-card-wrapper:hover {
      transform: scale(1.02);
      filter: brightness(1.05);
      box-shadow:
        0 2px 4px color-mix(in srgb, var(--theme-shadow) 12%, transparent),
        0 4px 8px color-mix(in srgb, var(--theme-shadow) 10%, transparent),
        0 8px 16px color-mix(in srgb, var(--theme-shadow) 8%, transparent),
        0 16px 24px color-mix(in srgb, var(--theme-shadow) 6%, transparent),
        inset 0 1px 0 var(--theme-stroke-strong);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  /* Card entrance animation - clean fade in (matches BaseCard) */
  @keyframes cardEnter {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Respect user motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .loop-card-wrapper :global(.base-card) {
      animation: cardEnter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) backwards !important;
      animation-delay: calc(var(--card-index) * 50ms) !important;
      background-position: 0% 50% !important;
    }
  }
</style>
