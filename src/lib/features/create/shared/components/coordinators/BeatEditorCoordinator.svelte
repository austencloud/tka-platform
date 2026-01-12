<!--
  BeatEditorCoordinator.svelte

  Manages the Beat Editor panel that opens when clicking a pictograph.
  Handles single-beat editing: turns, rotation, orientation, delete.

  This coordinator is separate from SequenceActionsCoordinator because:
  - Beat Editor opens directly on pictograph click (bypasses Sequence Actions)
  - Beat Editor is non-modal (allows clicking other pictographs while open)
  - Sequence Actions is for sequence-wide transforms

  Domain: Create module - Beat Editing Coordination
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";
  import BeatEditorPanel from "../sequence-actions/BeatEditorPanel.svelte";
  import PropSelectionSheet from "$lib/shared/settings/components/tabs/prop-type/PropSelectionSheet.svelte";
  import { getCreateModuleContext } from "../../context/create-module-context";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IBeatOperator } from "../../services/contracts/IBeatOperator";
  import {
    MotionColor,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import {
    getSettings,
    updateSettings,
  } from "$lib/shared/application/state/app-state.svelte";
  import { UndoOperationType } from "../../services/contracts/IUndoManager";

  const logger = createComponentLogger("BeatEditorCoordinator");

  // Get context
  const ctx = getCreateModuleContext();
  const { CreateModuleState, panelState } = ctx;

  // Services
  const hapticService: IHapticFeedback = container.items.hapticFeedback;
  const BeatOperator: IBeatOperator = container.items.beatOperator;

  // Panel state
  const isOpen = $derived(panelState.isBeatEditorPanelOpen);

  // Get active sequence state and selected beat data
  // Use $derived.by() to ensure reactive property tracking through function calls
  // Without .by(), Svelte may not detect changes to properties inside returned objects
  const activeSequenceState = $derived.by(() =>
    CreateModuleState.getActiveTabSequenceState()
  );
  const selectedBeatNumber = $derived.by(
    () => activeSequenceState.selectedBeatNumber
  );

  // CRITICAL: Track selectedStartPosition explicitly to ensure reactivity
  // when orientation changes update the start position. Without this explicit
  // dependency, Svelte may not detect that selectedBeatData needs to re-compute.
  const selectedStartPosition = $derived.by(
    () => activeSequenceState.selectedStartPosition
  );

  // Derive selectedBeatData with explicit dependency on selectedStartPosition
  // This ensures the UI updates when orientation changes modify the start position
  const selectedBeatData = $derived.by(() => {
    // Access selectedStartPosition to create explicit dependency
    const _ = selectedStartPosition;
    return activeSequenceState.selectedBeatData;
  });

  const sequence = $derived.by(() => activeSequenceState.currentSequence);

  // Animation state for deletion visualization
  const removingBeatIndices = $derived.by(() =>
    activeSequenceState.getRemovingBeatIndices()
  );

  // Prop selection sheet state
  let propSheetOpen = $state(false);
  let propSheetColor = $state<"blue" | "red">("blue");

  // Get current prop types from settings
  const settings = $derived(getSettings());
  const bluePropType = $derived(settings.bluePropType ?? PropType.STAFF);
  const redPropType = $derived(settings.redPropType ?? PropType.STAFF);

  // Derived state for turns calculations
  const blueMotion = $derived(selectedBeatData?.motions?.[MotionColor.BLUE]);
  const redMotion = $derived(selectedBeatData?.motions?.[MotionColor.RED]);

  const normalizeTurns = (turns: number | string | undefined): number =>
    turns === "fl" ? -0.5 : Number(turns) || 0;

  const currentBlueTurns = $derived(normalizeTurns(blueMotion?.turns));
  const currentRedTurns = $derived(normalizeTurns(redMotion?.turns));

  // Event handlers
  function handleClose() {
    logger.log("BeatEditorCoordinator closing beat editor panel");
    panelState.closeBeatEditorPanel();
    // Clear beat selection when closing the Beat Editor
    activeSequenceState.clearSelection();
  }

  function handleTurnsChange(color: MotionColor, delta: number) {
    if (selectedBeatNumber === null || !BeatOperator) return;
    hapticService?.trigger("selection");

    // Push undo snapshot BEFORE modifying
    CreateModuleState.pushUndoSnapshot(
      UndoOperationType.MODIFY_BEAT_PROPERTIES
    );

    const currentTurns =
      color === MotionColor.BLUE ? currentBlueTurns : currentRedTurns;
    const newNumericTurns = Math.min(3, Math.max(-0.5, currentTurns + delta));
    const newTurns: number | "fl" =
      newNumericTurns === -0.5 ? "fl" : newNumericTurns;

    BeatOperator.updateBeatTurns(
      selectedBeatNumber,
      color,
      newTurns,
      CreateModuleState,
      panelState
    );
  }

  function handleRotationChange(
    color: MotionColor,
    direction: RotationDirection
  ) {
    if (selectedBeatNumber === null || !BeatOperator) return;
    hapticService?.trigger("selection");

    // Push undo snapshot BEFORE modifying
    CreateModuleState.pushUndoSnapshot(
      UndoOperationType.MODIFY_BEAT_PROPERTIES
    );

    const directionString =
      direction === RotationDirection.CLOCKWISE ? "cw" : "ccw";
    BeatOperator.updateRotationDirection(
      selectedBeatNumber,
      color,
      directionString,
      CreateModuleState,
      panelState
    );
  }

  function handleOrientationChange(color: MotionColor, orientation: string) {
    if (selectedBeatNumber === null || !BeatOperator) return;
    hapticService?.trigger("selection");

    // Push undo snapshot BEFORE modifying
    CreateModuleState.pushUndoSnapshot(
      UndoOperationType.MODIFY_BEAT_PROPERTIES
    );

    BeatOperator.updateBeatOrientation(
      selectedBeatNumber,
      color,
      orientation,
      CreateModuleState,
      panelState
    );
  }

  function handleBeatDelete() {
    if (selectedBeatNumber === null || !BeatOperator) {
      return;
    }
    hapticService?.trigger("warning");

    // Push undo snapshot BEFORE deleting
    CreateModuleState.pushUndoSnapshot(UndoOperationType.REMOVE_BEATS);

    // For start position (0), clear the start position
    if (selectedBeatNumber === 0) {
      activeSequenceState.setStartPosition(null);
      activeSequenceState.clearSelection();
      return;
    }

    // For regular beats, remove the beat with animation
    // NOTE: Don't clear selection here - the animation callback in BeatRemovalHandler
    // will select the appropriate next beat after the animation completes.
    // This prevents the mobile Beat Editor controls from disappearing during deletion.
    const beatIndex = selectedBeatNumber - 1;
    BeatOperator.removeBeat(beatIndex, CreateModuleState);
  }

  function handleBeatSelect(beatNumber: number) {
    hapticService?.trigger("selection");
    activeSequenceState.selectBeat(beatNumber);
  }

  function handleOpenPropSheet(color: "blue" | "red") {
    propSheetColor = color;
    propSheetOpen = true;
  }

  function handlePropSelect(propType: PropType) {
    if (propSheetColor === "blue") {
      updateSettings({ bluePropType: propType });
    } else {
      updateSettings({ redPropType: propType });
    }
    propSheetOpen = false;
  }

  // Debug effect to track panel visibility
  $effect(() => {
    logger.log(
      "BeatEditorCoordinator panel state changed:",
      panelState.isBeatEditorPanelOpen
    );
  });
</script>

<BeatEditorPanel
  {isOpen}
  {selectedBeatNumber}
  {selectedBeatData}
  {sequence}
  {removingBeatIndices}
  onClose={handleClose}
  onTurnsChange={handleTurnsChange}
  onRotationChange={handleRotationChange}
  onOrientationChange={handleOrientationChange}
  onBeatSelect={handleBeatSelect}
  onDelete={handleBeatDelete}
  onOpenPropSheet={handleOpenPropSheet}
/>

<!-- Prop Selection Sheet - rendered as sibling to BeatEditorPanel -->
<PropSelectionSheet
  bind:isOpen={propSheetOpen}
  selectedPropType={propSheetColor === "blue" ? bluePropType : redPropType}
  color={propSheetColor}
  title={propSheetColor === "blue" ? "Select Blue Prop" : "Select Red Prop"}
  onSelect={handlePropSelect}
/>
