<!--
  StepEditorPanel.svelte

  Panel for editing individual steps (turns, rotation, orientation).
  Opens directly when clicking a pictograph, or via "Edit Turns" in Sequence Actions.
  Non-modal - allows clicking through to other pictographs while open.

  Mobile: Full-height panel with step grid at top, stacked controls at bottom
  Desktop: Side panel with pictograph preview, horizontal controls
-->
<script lang="ts">
  import CreatePanelDrawer from "../CreatePanelDrawer.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import TurnsEditMode from "./TurnsEditMode.svelte";
  import StartPositionEditMode from "./StartPositionEditMode.svelte";
  import DurationControl from "./DurationControl.svelte";
  import PictographInspectModal from "./PictographInspectModal.svelte";
  import StepEditorHelpModal from "./StepEditorHelpModal.svelte";
  import HelpButton from "$lib/shared/components/help/HelpButton.svelte";
  import ArrowAdjustmentPanel from "./ArrowAdjustmentPanel.svelte";
  import type { StepData } from "../../domain/models/StepData";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import {
    MotionColor,
    MotionType,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { isAdmin } from "$lib/shared/auth/state/authState.svelte";
  import { getCreateModuleContext } from "../../context/create-module-context";
  import { selectedArrowState } from "../../state/selected-arrow-state.svelte";

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
  }

  let {
    isOpen = $bindable(),
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
  }: Props = $props();

  // Track if an arrow is selected for showing adjustment panel
  const hasArrowSelected = $derived(selectedArrowState.selectedArrow !== null);

  // Get layout context for responsive behavior
  const ctx = getCreateModuleContext();
  const { layout, panelState } = ctx;
  const isSideBySideLayout = $derived(layout.shouldUseSideBySideLayout);

  // Hold onto previous beat data during transitions
  // This prevents layout flicker when deleting steps - the controls stay visible
  // with the old data until the new beat is selected, then CSS transitions
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

  // Reset displayed data when panel closes to avoid stale data on next open
  $effect(() => {
    if (!isOpen) {
      displayedStepData = null;
      displayedStepNumber = null;
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

  const stepLabel = $derived.by(() => {
    if (displayedStepNumber === null) return "";
    return displayedStepNumber === 0
      ? "Start Position"
      : `Beat ${displayedStepNumber}`;
  });

  // Inspect modal state (admin-only)
  let showInspectModal = $state(false);

  // Help modal state
  let showHelpModal = $state(false);

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

  function handleBeatDataUpdate(updatedStepData: StepData) {
    // Forward to parent for persistence
    onStepDataUpdate?.(updatedStepData);
    // Also update the displayed beat data locally for immediate visual feedback
    displayedStepData = updatedStepData;
  }
</script>

<CreatePanelDrawer
  bind:isOpen
  panelName="step-editor"
  fullHeightOnMobile={true}
  showHandle={true}
  closeOnBackdrop={false}
  focusTrap={false}
  autoFocus={false}
  ariaLabel="Step editor panel"
  onClose={handleClose}
>
  <div class="editor-panel" class:desktop={isSideBySideLayout}>
    <!-- Header -->
    <header class="panel-header">
      <div class="header-info">
        <h2>Step Editor</h2>
        <span class="subtitle">{stepLabel}</span>
      </div>

      <!-- Arrow adjustment panel in header when arrow is selected -->
      {#if isAdmin() && hasArrowSelected && displayedStepData}
        <ArrowAdjustmentPanel
          stepData={displayedStepData}
          onStepDataUpdate={handleBeatDataUpdate}
          {onPushUndoSnapshot}
        />
      {/if}

      <div class="header-actions">
        <!-- Help button -->
        <HelpButton
          onclick={() => (showHelpModal = true)}
          ariaLabel="Help with step editor"
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
              : "Delete beat"}
            title={isStartPositionSelected
              ? "Delete start position"
              : "Delete this beat"}
          >
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
          </button>
        {/if}
        <button
          class="icon-btn close"
          onclick={handleClose}
          aria-label="Close beat editor"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    </header>

    <!-- Pictograph Preview - shown on both mobile and desktop when beat selected -->
    {#if hasSelection && displayedStepData}
      <div class="preview-section" class:mobile={!isSideBySideLayout}>
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
    <div class="controls-section" class:mobile={!isSideBySideLayout}>
      {#if !hasSelection}
        <div class="no-selection">
          <i class="fas fa-hand-pointer" aria-hidden="true"></i>
          <p>Select a beat to edit</p>
        </div>
      {:else if isStartPositionSelected}
        <StartPositionEditMode
          startPositionData={displayedStepData}
          stacked={!isSideBySideLayout}
          {onOrientationChange}
        />
      {:else}
        {#if onDurationChange}
          <DurationControl
            duration={displayedStepData?.duration ?? 1}
            compact={!isSideBySideLayout}
            onDurationChange={onDurationChange}
          />
        {/if}
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
          {onTurnsChange}
          {onRotationChange}
          {onOpenPropSheet}
        />
      {/if}
    </div>
  </div>
</CreatePanelDrawer>

<!-- Inspect Modal (admin-only) -->
<PictographInspectModal
  show={showInspectModal}
  stepData={displayedStepData}
  onClose={handleCloseInspect}
/>

<!-- Help Modal -->
<StepEditorHelpModal
  bind:show={showHelpModal}
  onClose={() => (showHelpModal = false)}
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
    width: min(90cqw, 90cqh, 450px);
    height: min(90cqw, 90cqh, 450px);
    aspect-ratio: 1;
    /* Subtle container styling */
    background: rgba(255, 255, 255, 0.02);
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

  @media (prefers-reduced-motion: reduce) {
    .icon-btn {
      transition: none;
    }
  }
</style>
