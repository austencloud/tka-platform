<!--
  StepEditorCoordinator.svelte

  Manages the Beat Editor panel that opens when clicking a pictograph.
  Handles single-beat editing: turns, rotation, orientation, delete.

  This coordinator is separate from SequenceActionsCoordinator because:
  - Beat Editor opens directly on pictograph click (bypasses Sequence Actions)
  - Beat Editor is non-modal (allows clicking other pictographs while open)
  - Sequence Actions is for sequence-wide transforms

  Domain: Create module - Beat Editing Coordination
-->
<script lang="ts">

import { getStepOperator } from "$lib/features/create/shared/get-step-operator";
  import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import StepEditorPanel from "../sequence-actions/StepEditorPanel.svelte";
  import PropSelectionSheet from "$lib/shared/settings/components/tabs/prop-type/PropSelectionSheet.svelte";
  import { getCreateModuleContext } from "../../context/create-module-context";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { StepOperator } from "$lib/features/create/shared/services/step-operator";
  import {
    MotionColor,
    MotionType,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { PathShapeValue } from "../../services/step-operations/path-shape-handler";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    getSettings,
    updateSettings,
  } from "$lib/shared/application/state/app-state.svelte";
  import { UndoOperationType } from "../../services/undo-manager";

  const logger = createComponentLogger("StepEditorCoordinator");

  // Tabs that support the Beat Editor Panel
  // Only tabs with beat sequences support individual beat editing
  const SUPPORTED_TABS = new Set(["construct", "assemble", "generate", "spell"]);

  // Get context
  const ctx = getCreateModuleContext();
  const { CreateModuleState, panelState } = ctx;

  // Services
  const hapticService: HapticFeedback = getHapticFeedback();
  const StepOperator: StepOperator = getStepOperator();

  // Only show panel if the current tab supports it AND panel state says it's open
  const currentTab = $derived(navigationState.activeTab);
  const isTabSupported = $derived(SUPPORTED_TABS.has(currentTab));
  const isOpen = $derived(panelState.isStepEditorPanelOpen && isTabSupported);

  // CRITICAL: Track the active tab's sequence state reactively
  // We need to access reactive properties directly to establish dependencies.
  // Without accessing the actual properties, Svelte won't know to re-evaluate.
  const activeSequenceState = $derived.by(() => {
    // Track the active tab so we re-evaluate when it changes
    const _activeTab = navigationState.activeTab;

    // Get the sequence state for the active tab
    const state = CreateModuleState.getActiveTabSequenceState();

    // Access reactive properties to establish dependencies
    // This ensures we re-evaluate when selection changes
    const _selectedStep = state.selectedStepNumber;
    const _sequence = state.currentSequence;
    const _startPos = state.selectedStartPosition;

    return state;
  });

  // Now this will properly update because activeSequenceState re-evaluates on selection change
  const selectedStepNumber = $derived(activeSequenceState.selectedStepNumber);

  // CRITICAL: Track selectedStartPosition explicitly to ensure reactivity
  // when orientation changes update the start position. Without this explicit
  // dependency, Svelte may not detect that selectedStepData needs to re-compute.
  const selectedStartPosition = $derived.by(
    () => activeSequenceState.selectedStartPosition
  );

  // Get current sequence with explicit reactive tracking
  const sequence = $derived.by(() => activeSequenceState.currentSequence);

  // CRITICAL FIX: Compute selectedStepData directly instead of using the getter
  // The getter on activeSequenceState is NOT reactive because it's a plain object getter.
  // We must compute the value here with explicit dependencies on reactive state.
  const selectedStepData = $derived.by(() => {
    // Access reactive properties to establish dependencies
    const startPos = selectedStartPosition;
    const currentSeq = sequence;
    const stepNum = selectedStepNumber;

    // Step 0 = start position. The factory fills any missing hand with an
    // invisible placeholder (both-required canonical Step shape).
    if (stepNum === 0 && startPos) {
      return createStepData({
        ...startPos,
        stepNumber: 0,
        duration: 1,
        isBlank: false,
      });
    }

    // Regular steps: stepNumber 1 = index 0, stepNumber 2 = index 1, etc.
    if (stepNum === null || stepNum < 1 || !currentSeq?.steps) {
      return null;
    }

    const stepIndex = stepNum - 1;
    return currentSeq.steps[stepIndex] ?? null;
  });

  // Animation state for deletion visualization
  const removingStepIndices = $derived.by(() =>
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
  const blueMotion = $derived(selectedStepData?.motions?.[MotionColor.BLUE]);
  const redMotion = $derived(selectedStepData?.motions?.[MotionColor.RED]);

  const normalizeTurns = (turns: number | string | undefined): number =>
    turns === "fl" ? -0.5 : Number(turns) || 0;

  const currentBlueTurns = $derived(normalizeTurns(blueMotion?.turns));
  const currentRedTurns = $derived(normalizeTurns(redMotion?.turns));

  // Event handlers
  function handleClose() {
    logger.log("StepEditorCoordinator closing step editor panel");
    panelState.closeStepEditorPanel();
    // Clear step selection when closing the Step Editor
    activeSequenceState.clearSelection();
  }

  function handleTurnsChange(color: MotionColor, delta: number) {
    if (selectedStepNumber === null || !StepOperator) return;
    hapticService?.trigger("selection");

    // Push undo snapshot BEFORE modifying
    CreateModuleState.pushUndoSnapshot(
      UndoOperationType.MODIFY_BEAT_PROPERTIES
    );

    const motion =
      color === MotionColor.BLUE ? blueMotion : redMotion;
    const currentTurns =
      color === MotionColor.BLUE ? currentBlueTurns : currentRedTurns;
    const isShift =
      motion?.motionType === MotionType.PRO ||
      motion?.motionType === MotionType.ANTI;
    const minTurns = isShift ? -0.5 : 0;
    const newNumericTurns = Math.min(3, Math.max(minTurns, currentTurns + delta));
    const newTurns: number | "fl" =
      newNumericTurns === -0.5 ? "fl" : newNumericTurns;

    StepOperator.updateStepTurns(
      selectedStepNumber,
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
    if (selectedStepNumber === null || !StepOperator) return;
    hapticService?.trigger("selection");

    // Push undo snapshot BEFORE modifying
    CreateModuleState.pushUndoSnapshot(
      UndoOperationType.MODIFY_BEAT_PROPERTIES
    );

    const directionString =
      direction === RotationDirection.CLOCKWISE ? "cw" : "ccw";
    StepOperator.updateRotationDirection(
      selectedStepNumber,
      color,
      directionString,
      CreateModuleState,
      panelState
    );
  }

  function handleOrientationChange(color: MotionColor, orientation: string) {
    if (selectedStepNumber === null || !StepOperator) return;
    hapticService?.trigger("selection");

    // Push undo snapshot BEFORE modifying
    CreateModuleState.pushUndoSnapshot(
      UndoOperationType.MODIFY_BEAT_PROPERTIES
    );

    StepOperator.updateStepOrientation(
      selectedStepNumber,
      color,
      orientation,
      CreateModuleState,
      panelState
    );
  }

  function handleStepDelete() {
    if (selectedStepNumber === null || !StepOperator) {
      return;
    }
    hapticService?.trigger("warning");

    // Push undo snapshot BEFORE deleting
    CreateModuleState.pushUndoSnapshot(UndoOperationType.REMOVE_BEATS);

    // For start position (0), clear the start position
    if (selectedStepNumber === 0) {
      activeSequenceState.setStartPosition(null);
      activeSequenceState.clearSelection();
      return;
    }

    // For regular steps, remove the beat with animation
    // NOTE: Don't clear selection here - the animation callback in StepRemovalHandler
    // will select the appropriate next beat after the animation completes.
    // This prevents the mobile Beat Editor controls from disappearing during deletion.
    const stepIndex = selectedStepNumber - 1;
    StepOperator.removeStep(stepIndex, CreateModuleState);
  }

  function handleStepSelect(stepNumber: number) {
    hapticService?.trigger("selection");
    activeSequenceState.selectStep(stepNumber);
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

  function handlePushUndoSnapshot() {
    CreateModuleState.pushUndoSnapshot(
      UndoOperationType.MODIFY_BEAT_PROPERTIES
    );
  }

  function handleDurationChange(newDuration: number) {
    if (selectedStepNumber === null || selectedStepNumber === 0 || !StepOperator) return;
    hapticService?.trigger("selection");

    // Push undo snapshot BEFORE modifying
    CreateModuleState.pushUndoSnapshot(
      UndoOperationType.MODIFY_BEAT_PROPERTIES
    );

    StepOperator.updateStepDuration(
      selectedStepNumber,
      newDuration,
      CreateModuleState
    );
  }

  function handlePathShapeChange(color: MotionColor, shape: PathShapeValue) {
    if (selectedStepNumber === null || !StepOperator) return;
    hapticService?.trigger("selection");
    CreateModuleState.pushUndoSnapshot(UndoOperationType.MODIFY_BEAT_PROPERTIES);
    StepOperator.setStepPathShape(selectedStepNumber, color, shape, CreateModuleState);
  }

  function handlePathShapeClear(color: MotionColor) {
    if (selectedStepNumber === null || !StepOperator) return;
    hapticService?.trigger("selection");
    CreateModuleState.pushUndoSnapshot(UndoOperationType.MODIFY_BEAT_PROPERTIES);
    StepOperator.clearStepPathShape(selectedStepNumber, color, CreateModuleState);
  }

  function handleBetaSwapToggle() {
    if (selectedStepNumber === null || selectedStepNumber === 0 || !StepOperator) return;
    hapticService?.trigger("selection");
    CreateModuleState.pushUndoSnapshot(UndoOperationType.MODIFY_BEAT_PROPERTIES);
    StepOperator.toggleBetaSwap(selectedStepNumber, CreateModuleState);
  }

  function handleStepBeatDataUpdate(updatedStepData: typeof selectedStepData) {
    if (selectedStepNumber === null || !updatedStepData) return;

    const currentSequence = activeSequenceState.currentSequence;
    if (!currentSequence) return;

    // Handle start position (beat 0)
    if (selectedStepNumber === 0) {
      activeSequenceState.setStartPosition({
        ...updatedStepData,
        isStartPosition: true as const,
      });
      return;
    }

    // Handle regular steps
    const stepIndex = selectedStepNumber - 1;
    const updatedSteps = [...(currentSequence.steps ?? [])];
    updatedSteps[stepIndex] = updatedStepData;

    activeSequenceState.setCurrentSequence({
      ...currentSequence,
      steps: updatedSteps,
    });

    logger.log(`Updated beat ${selectedStepNumber} arrow adjustments`);
  }

  // Debug effect to track panel visibility
  $effect(() => {
    logger.log(
      "StepEditorCoordinator panel state changed:",
      panelState.isStepEditorPanelOpen
    );
  });
</script>

<StepEditorPanel
  {isOpen}
  {selectedStepNumber}
  {selectedStepData}
  {sequence}
  {removingStepIndices}
  onClose={handleClose}
  onTurnsChange={handleTurnsChange}
  onRotationChange={handleRotationChange}
  onOrientationChange={handleOrientationChange}
  onStepSelect={handleStepSelect}
  onDelete={handleStepDelete}
  onOpenPropSheet={handleOpenPropSheet}
  onStepDataUpdate={handleStepBeatDataUpdate}
  onPushUndoSnapshot={handlePushUndoSnapshot}
  onDurationChange={handleDurationChange}
  onPathShapeChange={handlePathShapeChange}
  onPathShapeClear={handlePathShapeClear}
  onBetaSwapToggle={handleBetaSwapToggle}
/>

<!-- Prop Selection Sheet - rendered as sibling to StepEditorPanel -->
<PropSelectionSheet
  bind:isOpen={propSheetOpen}
  selectedPropType={propSheetColor === "blue" ? bluePropType : redPropType}
  color={propSheetColor}
  title={propSheetColor === "blue" ? "Select Blue Prop" : "Select Red Prop"}
  onSelect={handlePropSelect}
/>
