<!--
  BeatEditorPanel.svelte

  Panel for editing individual beats (turns, rotation, orientation).
  Opens directly when clicking a pictograph, or via "Edit Turns" in Sequence Actions.
  Non-modal - allows clicking through to other pictographs while open.

  Mobile: Full-height panel with beat grid at top, stacked controls at bottom
  Desktop: Side panel with pictograph preview, horizontal controls
-->
<script lang="ts">
  import CreatePanelDrawer from "../CreatePanelDrawer.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import TurnsEditMode from "./TurnsEditMode.svelte";
  import StartPositionEditMode from "./StartPositionEditMode.svelte";
  import PictographInspectModal from "./PictographInspectModal.svelte";
  import PictographEditorSheet from "./PictographEditorSheet.svelte";
  import BeatGrid from "../../workspace-panel/sequence-display/components/BeatGrid.svelte";
  import type { BeatData } from "../../domain/models/BeatData";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import {
    MotionColor,
    MotionType,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { isAdmin } from "$lib/shared/auth/state/authState.svelte";
  import { getCreateModuleContext } from "../../context/create-module-context";

  interface Props {
    isOpen: boolean;
    selectedBeatNumber: number | null;
    selectedBeatData: BeatData | null;
    sequence?: SequenceData | null;
    removingBeatIndices?: Set<number>;
    onClose: () => void;
    onTurnsChange: (color: MotionColor, delta: number) => void;
    onRotationChange: (
      color: MotionColor,
      direction: RotationDirection
    ) => void;
    onOrientationChange: (color: MotionColor, orientation: string) => void;
    onBeatSelect?: (beatNumber: number) => void;
    onDelete?: () => void;
  }

  let {
    isOpen = $bindable(),
    selectedBeatNumber,
    selectedBeatData,
    sequence = null,
    removingBeatIndices = new Set<number>(),
    onClose,
    onTurnsChange,
    onRotationChange,
    onOrientationChange,
    onBeatSelect,
    onDelete,
  }: Props = $props();

  // Get layout context for responsive behavior
  const ctx = getCreateModuleContext();
  const { layout, panelState } = ctx;
  const isSideBySideLayout = $derived(layout.shouldUseSideBySideLayout);

  // Hold onto previous beat data during transitions
  // This prevents layout flicker when deleting beats - the controls stay visible
  // with the old data until the new beat is selected, then CSS transitions
  // smoothly animate the pictograph elements to their new positions
  let displayedBeatData = $state<BeatData | null>(null);
  let displayedBeatNumber = $state<number | null>(null);

  $effect(() => {
    // Only update displayed data when we have actual new data
    // When selectedBeatData becomes null (during deletion), keep showing previous
    if (selectedBeatData !== null) {
      displayedBeatData = selectedBeatData;
    }
    if (selectedBeatNumber !== null) {
      displayedBeatNumber = selectedBeatNumber;
    }
  });

  // Reset displayed data when panel closes to avoid stale data on next open
  $effect(() => {
    if (!isOpen) {
      displayedBeatData = null;
      displayedBeatNumber = null;
    }
  });

  // Derived state - use displayed values for rendering to prevent flicker
  const hasSelection = $derived(displayedBeatNumber !== null);
  const isStartPositionSelected = $derived(displayedBeatNumber === 0);

  const blueMotion = $derived(displayedBeatData?.motions?.[MotionColor.BLUE]);
  const redMotion = $derived(displayedBeatData?.motions?.[MotionColor.RED]);

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

  const beatLabel = $derived.by(() => {
    if (displayedBeatNumber === null) return "";
    return displayedBeatNumber === 0
      ? "Start Position"
      : `Beat ${displayedBeatNumber}`;
  });

  // Inspect modal state (admin-only)
  let showInspectModal = $state(false);
  let showEditorSheet = $state(false);

  function handleClose() {
    onClose();
  }

  function handleBeatClick(beatNumber: number) {
    onBeatSelect?.(beatNumber);
  }

  function handleOpenInspect() {
    showInspectModal = true;
  }

  function handleCloseInspect() {
    showInspectModal = false;
  }

  function handleOpenEditor() {
    showEditorSheet = true;
  }

  function handleCloseEditor() {
    showEditorSheet = false;
  }
</script>

<CreatePanelDrawer
  bind:isOpen
  panelName="beat-editor"
  fullHeightOnMobile={true}
  showHandle={true}
  closeOnBackdrop={false}
  focusTrap={false}
  autoFocus={false}
  ariaLabel="Beat editor panel"
  onClose={handleClose}
>
  <div class="editor-panel" class:desktop={isSideBySideLayout}>
    <!-- Header -->
    <header class="panel-header">
      <div class="header-info">
        <h2>Beat Editor</h2>
        <span class="subtitle">{beatLabel}</span>
      </div>
      <div class="header-actions">
        {#if isAdmin() && hasSelection && displayedBeatData}
          <button
            class="icon-btn editor"
            onclick={handleOpenEditor}
            aria-label="Edit pictograph"
            title="Edit pictograph (admin)"
          >
            <i class="fa-solid fa-pen-ruler" aria-hidden="true"></i>
          </button>
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

    <!-- Mobile layout: Beat grid at top -->
    {#if !isSideBySideLayout && sequence}
      <div class="beat-grid-section">
        <BeatGrid
          beats={sequence.beats ?? []}
          startPosition={sequence.startPosition ||
            sequence.startingPositionBeat ||
            null}
          {selectedBeatNumber}
          {removingBeatIndices}
          onBeatClick={handleBeatClick}
          onStartClick={() => handleBeatClick(0)}
          onBeatDelete={() => onDelete?.()}
        />
      </div>
    {/if}

    <!-- Desktop layout: Pictograph Preview -->
    {#if isSideBySideLayout && hasSelection && displayedBeatData}
      <div class="preview-section">
        <div class="pictograph-container">
          <PictographContainer
            pictographData={displayedBeatData}
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
          startPositionData={displayedBeatData}
          stacked={!isSideBySideLayout}
          {onOrientationChange}
        />
      {:else}
        <TurnsEditMode
          {hasSelection}
          blueTurns={displayBlueTurns}
          redTurns={displayRedTurns}
          {blueRotation}
          {redRotation}
          {showBlueRotation}
          {showRedRotation}
          stacked={!isSideBySideLayout}
          {onTurnsChange}
          {onRotationChange}
        />
      {/if}
    </div>
  </div>
</CreatePanelDrawer>

<!-- Inspect Modal (admin-only) -->
<PictographInspectModal
  show={showInspectModal}
  beatData={displayedBeatData}
  onClose={handleCloseInspect}
/>

<!-- Editor Sheet (admin-only) -->
<PictographEditorSheet
  isOpen={showEditorSheet}
  beatData={displayedBeatData}
  onClose={handleCloseEditor}
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
    container-name: beat-editor;
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
    transition: all 0.15s ease;
    border: 1px solid var(--theme-stroke-strong);
  }

  .icon-btn.editor {
    background: linear-gradient(135deg, var(--semantic-warning), #d97706);
    border-color: rgba(245, 158, 11, 0.3);
    color: white;
  }

  .icon-btn.editor:hover {
    background: linear-gradient(
      135deg,
      var(--semantic-warning),
      var(--semantic-warning)
    );
    transform: scale(1.05);
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
     BEAT GRID SECTION - Mobile only, flexible height
     Takes ALL available space - controls sit at bottom with natural size
     ============================================================================ */

  .beat-grid-section {
    flex: 1 1 auto; /* Grow to fill ALL available space */
    min-height: 120px; /* Minimum usable height for beat grid */
    /* No max-height - let it grow to fill space */
    border-bottom: 1px solid var(--theme-stroke);
    background: rgba(255, 255, 255, 0.02);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ============================================================================
     PREVIEW SECTION - Desktop only, pictograph preview
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

  /* Mobile: controls take only what they need - beat grid fills the rest */
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

  /* Small container height (< 600px) - compact mode */
  @container beat-editor (max-height: 600px) {
    .beat-grid-section {
      min-height: 80px; /* Smaller minimum on tight screens */
    }

    .controls-section.mobile {
      padding: 6px;
    }
  }

  /* Medium container height (600-700px) */
  @container beat-editor (min-height: 600px) and (max-height: 700px) {
    .controls-section.mobile {
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
