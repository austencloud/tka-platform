<!--
  StepEditorPanel.svelte

  Panel for editing individual steps (turns, rotation, orientation).
  Opens directly when clicking a pictograph, or via "Edit Turns" in Sequence Actions.
  Non-modal - allows clicking through to other pictographs while open.

  Mobile: Full-height panel with step grid at top, stacked controls at bottom
  Desktop: Side panel with pictograph preview, horizontal controls
-->
<script lang="ts">
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import TurnsEditMode from "./TurnsEditMode.svelte";
  import StartPositionEditMode from "./StartPositionEditMode.svelte";
  import DurationControl from "./DurationControl.svelte";
  import PictographInspectModal from "./PictographInspectModal.svelte";
  import HelpButton from "$lib/shared/components/help/HelpButton.svelte";
  import ArrowAdjustmentPanel from "./ArrowAdjustmentPanel.svelte";
  import ArrowAdjustmentHistory from "./ArrowAdjustmentHistory.svelte";
  import StepEditorTour from "$lib/shared/onboarding/components/step-editor-tour/StepEditorTour.svelte";
  import { stepEditorTourState } from "$lib/shared/onboarding/state/step-editor-tour-state.svelte";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import {
    MotionColor,
    MotionType,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { PathShapeValue } from "../../services/step-operations/path-shape-handler";
  import { isAdmin } from "$lib/shared/auth/state/auth-state.svelte";
  import { getCreateModuleContext } from "../../context/create-module-context";
  import { selectedArrowState } from "$lib/shared/create/state/selected-arrow-state.svelte";
  import { createPersistenceHelper } from "$lib/shared/state/utils/persistent-state";
  import { onMount } from "svelte";

  // Persist whether the inspect modal is open so a dev HMR / page refresh
  // restores it instead of closing it. load() re-reads localStorage on every
  // remount, which is exactly what survives the HMR teardown of this component.
  const inspectModalPersistence = createPersistenceHelper<boolean>({
    key: "tka_inspect_modal_open",
    defaultValue: false,
  });

  interface Props {
    isOpen: boolean;
    selectedStepNumber: number | null;
    selectedStepData: StepData | null;
    sequence?: SequenceData | null;
    removingStepIndices?: Set<number>;
    onClose: () => void;
    onTurnsChange: (color: MotionColor, delta: number) => void;
    onRotationChange: (
      color: MotionColor,
      direction: RotationDirection
    ) => void;
    onOrientationChange: (color: MotionColor, orientation: string) => void;
    onStepSelect?: (stepNumber: number) => void;
    onDelete?: () => void;
    onOpenPropSheet?: (color: "blue" | "red") => void;
    onStepDataUpdate?: (updatedStepData: StepData) => void;
    onPushUndoSnapshot?: () => void;
    onDurationChange?: (newDuration: number) => void;
    onPathShapeChange?: (color: MotionColor, shape: PathShapeValue) => void;
    onPathShapeClear?: (color: MotionColor) => void;
    onBetaSwapToggle?: () => void;
  }

  let {
    isOpen,
    selectedStepNumber,
    selectedStepData,
    sequence = null,
    removingStepIndices = new Set<number>(),
    onClose,
    onTurnsChange,
    onRotationChange,
    onOrientationChange,
    onStepSelect,
    onDelete,
    onOpenPropSheet,
    onStepDataUpdate,
    onPushUndoSnapshot,
    onDurationChange,
    onPathShapeChange,
    onPathShapeClear,
    onBetaSwapToggle,
  }: Props = $props();

  // Track if an arrow is selected for showing adjustment panel
  const hasArrowSelected = $derived(selectedArrowState.selectedArrow !== null);

  // Get layout context for responsive behavior
  const ctx = getCreateModuleContext();
  const { layout, panelState } = ctx;
  const isSideBySideLayout = $derived(layout.shouldUseSideBySideLayout);

  // Hold onto previous step data during transitions
  // This prevents layout flicker when deleting steps - the controls stay visible
  // with the old data until the new step is selected, then CSS transitions
  // smoothly animate the pictograph elements to their new positions
  let displayedStepData = $state<StepData | null>(null);
  let displayedStepNumber = $state<number | null>(null);

  $effect(() => {
    // Only update displayed data when we have actual new data
    // When selectedStepData becomes null (during deletion), keep showing previous
    if (selectedStepData !== null) {
      displayedStepData = selectedStepData;
    }
    if (selectedStepNumber !== null) {
      displayedStepNumber = selectedStepNumber;
    }
  });

  // Reset displayed data when panel closes to avoid stale data on next open.
  // The inspect modal is subordinate to the editor: if the editor isn't open,
  // force the modal closed so a persisted-open flag can't pop it on the next
  // step click. On a refresh that restored the editor, isOpen is already true
  // here, so a restored inspect modal survives.
  $effect(() => {
    if (!isOpen) {
      displayedStepData = null;
      displayedStepNumber = null;
      showInspectModal = false;
    }
  });

  // Derived state - use displayed values for rendering to prevent flicker
  const hasSelection = $derived(displayedStepNumber !== null);
  const isStartPositionSelected = $derived(displayedStepNumber === 0);

  const blueMotion = $derived(displayedStepData?.motions?.[MotionColor.BLUE]);
  const redMotion = $derived(displayedStepData?.motions?.[MotionColor.RED]);

  const normalizeTurns = (turns: number | string | undefined): number =>
    turns === "fl" ? -0.5 : Number(turns) || 0;

  const currentBlueTurns = $derived(normalizeTurns(blueMotion?.turns));
  const currentRedTurns = $derived(normalizeTurns(redMotion?.turns));

  const displayBlueTurns = $derived(
    blueMotion?.turns === "fl" ? "fl" : currentBlueTurns
  );
  const displayRedTurns = $derived(
    redMotion?.turns === "fl" ? "fl" : currentRedTurns
  );

  // Determine if rotation can be shown for each prop
  const showBlueRotation = $derived.by(() => {
    if (currentBlueTurns < 0) return false; // Float motion
    if (
      (blueMotion?.motionType === MotionType.STATIC ||
        blueMotion?.motionType === MotionType.DASH) &&
      currentBlueTurns === 0
    ) {
      return false;
    }
    return true;
  });

  const showRedRotation = $derived.by(() => {
    if (currentRedTurns < 0) return false; // Float motion
    if (
      (redMotion?.motionType === MotionType.STATIC ||
        redMotion?.motionType === MotionType.DASH) &&
      currentRedTurns === 0
    ) {
      return false;
    }
    return true;
  });

  const blueRotation = $derived(
    blueMotion?.rotationDirection ?? RotationDirection.NO_ROTATION
  );
  const redRotation = $derived(
    redMotion?.rotationDirection ?? RotationDirection.NO_ROTATION
  );

  const bluePathShape = $derived(blueMotion?.pathShape);
  const redPathShape = $derived(redMotion?.pathShape);
  const blueIsShift = $derived(
    blueMotion ? blueMotion.startLocation !== blueMotion.endLocation : false
  );
  const redIsShift = $derived(
    redMotion ? redMotion.startLocation !== redMotion.endLocation : false
  );

  const stepLabel = $derived.by(() => {
    if (displayedStepNumber === null) return "";
    return displayedStepNumber === 0
      ? "Start Position"
      : `Step ${displayedStepNumber}`;
  });

  // Calculate how many subsequent steps would be affected by orientation changes
  // This helps users understand cascade impact when editing turns on mobile
  const cascadeCount = $derived.by(() => {
    if (displayedStepNumber === null || !sequence?.steps) return 0;
    // Start position affects all steps, regular steps affect subsequent ones
    if (displayedStepNumber === 0) {
      return sequence.steps.length;
    }
    // Steps after the selected one (stepNumber 1 = index 0, so steps after index (n-1))
    return Math.max(0, sequence.steps.length - displayedStepNumber);
  });

  // Track sequence changes to trigger pulse animation when cascade occurs
  // We watch the sequence's steps array - when it changes and we have cascade steps,
  // that means orientation propagated through subsequent steps
  let lastSequenceVersion = $state(0);
  let showCascadePulse = $state(false);

  // Create a simple version number that changes when sequence steps change
  const sequenceVersion = $derived.by(() => {
    if (!sequence?.steps) return 0;
    // Use a combination that changes when any step's orientation changes
    return sequence.steps.reduce((acc, step, idx) => {
      const blue = step?.motions?.[MotionColor.BLUE];
      const red = step?.motions?.[MotionColor.RED];
      const blueTurnsNum = blue?.turns === "fl" ? -0.5 : Number(blue?.turns ?? 0);
      const redTurnsNum = red?.turns === "fl" ? -0.5 : Number(red?.turns ?? 0);
      return acc + idx * 1000 + blueTurnsNum * 100 + redTurnsNum * 10;
    }, sequence.steps.length);
  });

  $effect(() => {
    // Only pulse when:
    // 1. We have cascade steps (cascadeCount > 0)
    // 2. The sequence version changed (turns/orientations updated)
    // 3. This isn't the initial load (lastSequenceVersion !== 0)
    // 4. Panel is open and we're not on start position
    if (
      cascadeCount > 0 &&
      sequenceVersion !== lastSequenceVersion &&
      lastSequenceVersion !== 0 &&
      isOpen &&
      !isStartPositionSelected
    ) {
      showCascadePulse = true;
      const timeout = setTimeout(() => {
        showCascadePulse = false;
      }, 300);
      lastSequenceVersion = sequenceVersion;
      return () => clearTimeout(timeout);
    }
    lastSequenceVersion = sequenceVersion;
    return undefined;
  });

  // Trigger step editor tour on first open with a selection
  $effect(() => {
    if (isOpen && hasSelection) {
      stepEditorTourState.triggerIfFirstTime();
    }
  });

  // Which section to highlight during tour
  const tourHighlight = $derived(
    stepEditorTourState.isActive
      ? (
          {
            welcome: "all",
            preview: "preview",
            turns: "turns",
            duration: "duration",
          } as const
        )[stepEditorTourState.currentStop]
      : "none",
  );

  // Beta swap state — both hands end at same location. Invisible placeholder =
  // hand not really there (both-required Step shape): not a beta position.
  const isBetaPosition = $derived.by(() => {
    if (!displayedStepData || isStartPositionSelected) return false;
    const blue = displayedStepData.motions?.[MotionColor.BLUE];
    const red = displayedStepData.motions?.[MotionColor.RED];
    return !!(
      isVisibleMotion(blue) &&
      isVisibleMotion(red) &&
      blue.endLocation === red.endLocation
    );
  });
  const isBetaSwapped = $derived(!!displayedStepData?.betaSwapped);

  // Keyboard handler for B key beta swap toggle
  function handleBetaSwapKeydown(event: KeyboardEvent) {
    if (event.key.toLowerCase() !== "b") return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (!isOpen || !hasSelection || isStartPositionSelected) return;
    if (!isBetaPosition) return;
    if (hasArrowSelected) return;
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
    event.preventDefault();
    onBetaSwapToggle?.();
  }

  onMount(() => {
    window.addEventListener("keydown", handleBetaSwapKeydown);
    return () => window.removeEventListener("keydown", handleBetaSwapKeydown);
  });

  // Inspect modal state (admin-only) — persisted across HMR / refresh.
  let showInspectModal = $state(inspectModalPersistence.load());

  $effect(() => {
    void showInspectModal;
    inspectModalPersistence.setupAutoSave(showInspectModal);
  });

  function handleClose() {
    selectedArrowState.clearSelection();
    onClose();
  }

  function handleStepClick(stepNumber: number) {
    onStepSelect?.(stepNumber);
  }

  function handleOpenInspect() {
    showInspectModal = true;
  }

  function handleCloseInspect() {
    showInspectModal = false;
  }

  function handleStepDataUpdate(updatedStepData: StepData) {
    // Forward to parent for persistence
    onStepDataUpdate?.(updatedStepData);
    // Also update the displayed step data locally for immediate visual feedback
    displayedStepData = updatedStepData;
  }
</script>

<div class="editor-panel" class:desktop={isSideBySideLayout} class:tour-active={stepEditorTourState.isActive}>
    <!-- Step Editor Tour overlay -->
    <StepEditorTour />

    <!-- Header -->
    <header class="panel-header" class:tour-dim={tourHighlight !== "none"}>
      <div class="header-info">
        <h2>Step Editor</h2>
        <span class="subtitle">
          {stepLabel}
          {#if cascadeCount > 0 && !isStartPositionSelected}
            <span class="cascade-indicator" class:pulse={showCascadePulse}>
              → +{cascadeCount} step{cascadeCount === 1 ? "" : "s"}
            </span>
          {/if}
          {#if isBetaPosition && isBetaSwapped}
            <button
              class="beta-swap-badge active"
              onclick={() => onBetaSwapToggle?.()}
              title="Beta offset swapped (B to toggle)"
              aria-label="Beta offset swapped, press B to toggle"
              aria-pressed="true"
            >β⇄</button>
          {:else if isBetaPosition}
            <button
              class="beta-swap-badge"
              onclick={() => onBetaSwapToggle?.()}
              title="Swap beta offset (B)"
              aria-label="Swap beta offset, press B to toggle"
              aria-pressed="false"
            >β⇄</button>
          {/if}
        </span>
      </div>

      <!-- Arrow adjustment panel in header when arrow is selected -->
      {#if isAdmin() && hasArrowSelected && displayedStepData}
        <ArrowAdjustmentPanel
          stepData={displayedStepData}
          onStepDataUpdate={handleStepDataUpdate}
          {onPushUndoSnapshot}
          keyboardActive={!showInspectModal}
        />
        <ArrowAdjustmentHistory />
      {/if}

      <div class="header-actions">
        <!-- Help button -->
        <HelpButton
          onclick={() => stepEditorTourState.restart()}
          ariaLabel="Replay step editor tour"
          size="compact"
        />
        {#if isAdmin() && hasSelection && displayedStepData}
          <button
            class="icon-btn inspect"
            onclick={handleOpenInspect}
            aria-label="Inspect pictograph data"
            title="Inspect pictograph data (dev)"
          >
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          </button>
        {/if}
        {#if onDelete && hasSelection}
          <button
            class="icon-btn delete"
            onclick={() => onDelete()}
            aria-label={isStartPositionSelected
              ? "Delete start position"
              : "Delete step"}
            title={isStartPositionSelected
              ? "Delete start position"
              : "Delete this step"}
          >
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
          </button>
        {/if}
        <button
          class="icon-btn close"
          onclick={handleClose}
          aria-label="Close step editor"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    </header>

    <!-- Pictograph Preview - shown on both mobile and desktop when beat selected -->
    <!-- Duration is now rendered INSIDE the pictograph via DurationGlyph -->
    {#if hasSelection && displayedStepData}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="preview-section"
        class:mobile={!isSideBySideLayout}
        class:tour-highlight={tourHighlight === "preview"}
        class:tour-dim={tourHighlight !== "none" && tourHighlight !== "preview"}
        onclick={(e) => {
          if (hasArrowSelected && !(e.target as HTMLElement).closest('[role="button"]')) {
            selectedArrowState.clearSelection();
          }
        }}
      >
        <div class="pictograph-container">
          <PictographContainer
            pictographData={displayedStepData}
            arrowsClickable={isAdmin()}
            disableTransitions={true}
          />
        </div>
      </div>
    {/if}

    <!-- Controls - different layout for mobile vs desktop -->
    <div
      class="controls-section"
      class:mobile={!isSideBySideLayout}
    >
      {#if !hasSelection}
        <div class="no-selection">
          <i class="fas fa-hand-pointer" aria-hidden="true"></i>
          <p>Select a step to edit</p>
        </div>
      {:else if isStartPositionSelected}
        <StartPositionEditMode
          startPositionData={displayedStepData}
          stacked={!isSideBySideLayout}
          {onOrientationChange}
        />
      {:else}
        {#if onDurationChange}
          <div
            class="tour-section"
            class:tour-highlight={tourHighlight === "duration"}
            class:tour-dim={tourHighlight !== "none" && tourHighlight !== "duration"}
          >
            <DurationControl
              duration={displayedStepData?.duration ?? 1}
              compact={!isSideBySideLayout}
              onDurationChange={onDurationChange}
            />
          </div>
        {/if}
        <div
          class="tour-section"
          class:tour-highlight={tourHighlight === "turns"}
          class:tour-dim={tourHighlight !== "none" && tourHighlight !== "turns"}
        >
          <TurnsEditMode
            {hasSelection}
            blueTurns={displayBlueTurns}
            redTurns={displayRedTurns}
            {blueRotation}
            {redRotation}
            {showBlueRotation}
            {showRedRotation}
            stacked={!isSideBySideLayout}
            compact={!isSideBySideLayout}
            {bluePathShape}
            {redPathShape}
            {blueIsShift}
            {redIsShift}
            {onTurnsChange}
            {onRotationChange}
            {onOpenPropSheet}
            {onPathShapeChange}
            {onPathShapeClear}
          />
        </div>
      {/if}
    </div>
  </div>

<!-- Inspect Modal (admin-only). Guard on a valid step + admin so a persisted
     open flag can't restore an empty modal or surface it to non-admins. -->
<PictographInspectModal
  show={showInspectModal && isAdmin() && !!displayedStepData}
  stepData={displayedStepData}
  onClose={handleCloseInspect}
/>


<style>
  /* ============================================================================
     EDITOR PANEL - Full-height layout for both mobile and desktop
     Uses container queries to adapt to available space
     ============================================================================ */

  .editor-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    position: relative;
    container-type: size;
    container-name: step-editor;
    /* Whole panel is swipe-draggable — show the grab affordance everywhere */
    cursor: grab;
  }

  /* Restore natural cursors on elements that need their own (cursor inherits) */
  .editor-panel :global(input),
  .editor-panel :global(textarea),
  .editor-panel :global(select),
  .editor-panel :global([role="slider"]),
  .editor-panel :global([contenteditable]) {
    cursor: auto;
  }

  /* While actively dragging, force the closed-fist cursor across the panel */
  :global(.drawer-content.dragging) .editor-panel,
  :global(.drawer-content.dragging) .editor-panel :global(*) {
    cursor: grabbing;
  }

  /* ============================================================================
     HEADER - Compact header matching SequenceActionsPanel
     ============================================================================ */

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(15, 20, 30, 0.95);
    border-bottom: 1px solid var(--theme-stroke);
    min-height: 44px;
    flex-shrink: 0;
  }

  .header-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .subtitle {
    font-size: 0.8rem;
    color: var(--theme-text-muted, var(--theme-text-dim));
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .cascade-indicator {
    color: var(--theme-accent, #60a5fa);
    font-size: 0.75rem;
    opacity: 0.9;
    transition: opacity var(--duration-fast) ease;
  }

  .cascade-indicator.pulse {
    animation: cascade-pulse 300ms ease-out;
  }

  .beta-swap-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 4px;
    border: 1px solid rgba(168, 85, 247, 0.3);
    background: rgba(168, 85, 247, 0.1);
    color: rgba(168, 85, 247, 0.6);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    line-height: 1.2;
  }

  .beta-swap-badge:hover {
    background: rgba(168, 85, 247, 0.2);
    color: rgba(168, 85, 247, 0.9);
  }

  .beta-swap-badge.active {
    background: rgba(168, 85, 247, 0.3);
    border-color: rgba(168, 85, 247, 0.5);
    color: #d8b4fe;
  }

  .beta-swap-badge.active:hover {
    background: rgba(168, 85, 247, 0.4);
    color: #ede9fe;
  }

  @keyframes cascade-pulse {
    0% {
      opacity: 1;
      transform: scale(1.15);
    }
    100% {
      opacity: 0.9;
      transform: scale(1);
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  /* ============================================================================
     ICON BUTTONS - Consistent button styling
     ============================================================================ */

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 50%;
    cursor: pointer;
    font-size: var(--font-size-base);
    transition: all var(--duration-fast) ease;
    border: 1px solid var(--theme-stroke-strong);
  }

  .icon-btn.inspect {
    background: linear-gradient(135deg, #06b6d4, #0891b2);
    border-color: rgba(6, 182, 212, 0.3);
    color: white;
  }

  .icon-btn.inspect:hover {
    background: linear-gradient(135deg, #22d3ee, #06b6d4);
    transform: scale(1.05);
  }

  .icon-btn.delete {
    background: linear-gradient(
      135deg,
      var(--semantic-warning) 0%,
      color-mix(in srgb, var(--semantic-warning) 80%, #ff0000) 100%
    );
    border-color: color-mix(in srgb, var(--semantic-warning) 30%, transparent);
    color: white;
  }

  .icon-btn.delete:hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-warning) 80%, #ff0000) 0%,
      color-mix(in srgb, var(--semantic-warning) 60%, #ff0000) 100%
    );
    transform: scale(1.05);
  }

  .icon-btn.close {
    background: linear-gradient(
      135deg,
      rgba(100, 100, 120, 0.85),
      rgba(70, 70, 90, 0.85)
    );
    color: white;
  }

  .icon-btn.close:hover {
    background: linear-gradient(
      135deg,
      rgba(120, 120, 140, 0.95),
      rgba(90, 90, 110, 0.95)
    );
  }

  /* ============================================================================
     PREVIEW SECTION - Pictograph preview (both mobile and desktop)
     ============================================================================ */

  .preview-section {
    padding: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: rgba(0, 0, 0, 0.1);
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
    /* Enable container queries for responsive pictograph sizing */
    container-type: size;
  }

  /* Mobile: tighter padding, fill available space */
  .preview-section.mobile {
    padding: 12px;
    flex: 1 1 auto;
  }

  .pictograph-container {
    /* Size based on smaller dimension - fills the space as a square */
    width: min(90cqw, 90cqh);
    height: min(90cqw, 90cqh);
    aspect-ratio: 1;
    /* Subtle container styling */
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
    border-radius: 12px;
  }

  /* ============================================================================
     CONTROLS SECTION - Bottom controls area
     Must always fit both Blue and Red controls on mobile
     ============================================================================ */

  .controls-section {
    padding: 12px;
    padding-bottom: max(12px, env(safe-area-inset-bottom, 12px));
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, var(--theme-stroke));
    background: var(--theme-panel-bg);
  }

  /* Mobile: controls take only what they need - step grid fills the rest */
  .controls-section.mobile {
    flex: 0 0 auto; /* Don't grow - take natural size only */
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    overflow-y: auto; /* Allow scrolling if absolutely necessary */
  }

  .no-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px 24px;
    text-align: center;
    color: var(--theme-text-muted, var(--theme-text-dim));
  }

  .no-selection i {
    font-size: 2rem;
    opacity: 0.6;
  }

  .no-selection p {
    margin: 0;
    font-size: 0.9rem;
  }

  /* ============================================================================
     CONTAINER QUERY ADJUSTMENTS - Responsive to actual available space
     ============================================================================ */

  /* Small container height (< 600px) - tighter padding */
  @container step-editor (max-height: 600px) {
    .controls-section.mobile {
      padding: 6px;
    }

    .preview-section.mobile {
      padding: 8px;
    }
  }

  /* Fallback for browsers without container query support */
  @supports not (container-type: size) {
    @media (max-height: 700px) {
      .controls-section.mobile {
        padding: 8px;
      }
    }
  }

  /* ============================================================================
     REDUCED MOTION
     ============================================================================ */

  /* ============================================================================
     TOUR HIGHLIGHTING - Dim/highlight sections during coach marks
     ============================================================================ */

  .tour-section {
    border-radius: 8px;
  }

  .tour-dim {
    opacity: 0.25;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .tour-highlight {
    position: relative;
    z-index: 50;
    opacity: 1;
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--feature-edit, #8b5cf6) 70%, transparent),
      0 0 24px 4px color-mix(in srgb, var(--feature-edit, #8b5cf6) 35%, transparent);
    border-radius: 8px;
    transition: opacity 0.3s ease, box-shadow 0.3s ease;
  }

  /* ============================================================================
     REDUCED MOTION
     ============================================================================ */

  @media (prefers-reduced-motion: reduce) {
    .icon-btn {
      transition: none;
    }

    .cascade-indicator {
      transition: none;
    }

    .cascade-indicator.pulse {
      animation: none;
    }

    .tour-dim,
    .tour-highlight {
      transition: none;
    }
  }
</style>
