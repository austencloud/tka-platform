<!-- OrientationControlPanel.svelte - Container-aware orientation controls with multiple layout modes -->
<script lang="ts">
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import ExpandedOrientationPanel from "./ExpandedOrientationPanel.svelte";
  import InlineOrientationControl from "./InlineOrientationControl.svelte";
  import SimplifiedOrientationControl from "./SimplifiedOrientationControl.svelte";
  import { createOrientationControlExpansionState } from "./orientation-control-expansion-state.svelte";
  import OrientationControlButton from "./OrientationControlButton.svelte";

  // Props
  const {
    currentBeatData,
    onOrientationChanged,
    useSimplifiedLayout = false,
  } = $props<{
    currentBeatData: BeatData | null;
    onOrientationChanged: (color: string, orientation: string) => void;
    useSimplifiedLayout?: boolean;
  }>();

  // Services
  const deviceDetector = container.items.deviceDetector;

  // State management for expansion
  const expansionState = createOrientationControlExpansionState();

  // Computed device characteristics
  const isDesktop = $derived(deviceDetector.isDesktop());
  const isTablet = $derived(deviceDetector.isTablet());

  // Responsive sizing strategy based on device type
  const layoutMode = $derived(() => {
    // Desktop: Minimize vertical space usage
    if (isDesktop) return "compact";

    // Tablet: Balanced layout
    if (isTablet) return "balanced";

    // Mobile: Full touch-friendly sizing
    return "comfortable";
  });

  // Container width detection (passed from parent via container queries)
  const useSimplifiedControls = $derived(useSimplifiedLayout);

  // Determine if we should show inline controls or use expandable pattern
  const shouldShowInlineControls = $derived(() => {
    // Simplified controls override (for narrow portrait)
    if (useSimplifiedControls) return false;

    // Desktop has plenty of vertical space in the adjustment section
    // Show inline controls to avoid unnecessary clicks
    if (isDesktop) return true;

    // Tablet and mobile have constrained space
    // Use expandable controls to maximize available space
    return false;
  });

  // Determine control mode based on container (will be set via CSS)
  const controlMode = $derived(() => {
    if (useSimplifiedControls) return "simplified";
    if (shouldShowInlineControls()) return "inline";
    return "expandable";
  });

  // Track previous beat index
  let previousBeatIndex = $state<number | null>(null);

  // When beat data changes, collapse any expanded controls
  $effect(() => {
    if (currentBeatData) {
      const currentBeatIndex = currentBeatData.beatNumber;

      // If beat changed, collapse (don't auto-expand)
      if (
        previousBeatIndex !== null &&
        previousBeatIndex !== currentBeatIndex
      ) {
        expansionState.collapse();
      }

      previousBeatIndex = currentBeatIndex;
    }
  });

  // Handlers
  function handleBlueExpand() {
    expansionState.expand("blue");
  }

  function handleRedExpand() {
    expansionState.expand("red");
  }

  function handleCollapse() {
    expansionState.collapse();
  }

  onMount(() => {
    // Panel initialized
  });
</script>

<div
  class="orientation-control-panel"
  class:compact={layoutMode() === "compact"}
  class:balanced={layoutMode() === "balanced"}
  class:comfortable={layoutMode() === "comfortable"}
  class:mode-simplified={controlMode() === "simplified"}
  class:mode-inline={controlMode() === "inline"}
  class:mode-expandable={controlMode() === "expandable"}
  data-testid="orientation-control-panel"
>
  <div class="orientation-controls-container">
    {#if controlMode() === "simplified"}
      <!-- Simplified always-visible controls for narrow portrait (352px Z Fold) -->
      <SimplifiedOrientationControl
        color="blue"
        {currentBeatData}
        {onOrientationChanged}
      />
      <SimplifiedOrientationControl
        color="red"
        {currentBeatData}
        {onOrientationChanged}
      />
    {:else if controlMode() === "inline"}
      <!-- Inline controls when enough space is available (Desktop) -->
      <InlineOrientationControl
        color="blue"
        {currentBeatData}
        {onOrientationChanged}
        layoutMode={layoutMode()}
      />
      <InlineOrientationControl
        color="red"
        {currentBeatData}
        {onOrientationChanged}
        layoutMode={layoutMode()}
      />
    {:else}
      <!-- Expandable button/panel pattern for constrained spaces (Tablet/Mobile) -->
      <!-- Blue/Left Control -->
      {#if expansionState.isBlueExpanded()}
        <div transition:slide={{ duration: 300, axis: "y" }}>
          <ExpandedOrientationPanel
            color="blue"
            {currentBeatData}
            {onOrientationChanged}
            onCollapse={handleCollapse}
            layoutMode={layoutMode()}
          />
        </div>
      {:else}
        <OrientationControlButton
          color="blue"
          {currentBeatData}
          isExpanded={expansionState.isRedExpanded()}
          onExpand={handleBlueExpand}
          layoutMode={layoutMode()}
        />
      {/if}

      <!-- Red/Right Control -->
      {#if expansionState.isRedExpanded()}
        <div transition:slide={{ duration: 300, axis: "y" }}>
          <ExpandedOrientationPanel
            color="red"
            {currentBeatData}
            {onOrientationChanged}
            onCollapse={handleCollapse}
            layoutMode={layoutMode()}
          />
        </div>
      {:else}
        <OrientationControlButton
          color="red"
          {currentBeatData}
          isExpanded={expansionState.isBlueExpanded()}
          onExpand={handleRedExpand}
          layoutMode={layoutMode()}
        />
      {/if}
    {/if}
  </div>
</div>

<style>
  .orientation-control-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .orientation-controls-container {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: stretch;
    gap: 12px;
  }

  /* Simplified mode - Always-visible stacked controls */
  .orientation-control-panel.mode-simplified .orientation-controls-container {
    flex-direction: column;
    gap: 8px; /* Reduced gap for tight spaces (portrait + URL bar) */
    overflow-y: auto; /* Allow scrolling if needed */
    overflow-x: hidden;
  }

  /* Inline mode - Side-by-side controls (Desktop) */
  .orientation-control-panel.mode-inline .orientation-controls-container {
    flex-direction: row;
    gap: 16px;
  }

  /* Expandable mode - Side-by-side expandable buttons (Tablet/Mobile) */
  .orientation-control-panel.mode-expandable .orientation-controls-container {
    flex-direction: row;
    gap: 12px;
  }

  /* Comfortable mode - Mobile, full touch-friendly sizing (default) */
  .orientation-control-panel.comfortable {
    padding: 0px;
  }

  /* Balanced mode - Tablet landscape, moderate sizing */
  .orientation-control-panel.balanced {
    padding: 0px;
  }

  /* Compact mode - Desktop, minimal vertical space */
  .orientation-control-panel.compact {
    padding: 8px;
  }

  /* Responsive adjustments for very small screens */
  @media (max-width: 400px) {
    .orientation-control-panel {
      padding: 12px;
    }
  }
</style>
