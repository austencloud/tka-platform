<!--
  SequenceActionsPanel.svelte

  Panel for sequence-wide operations: transforms, patterns, extend.
  Individual beat editing (turns, rotation) is handled by StepEditorPanel.
-->
<script lang="ts">

import { getExtensionFlowCoordinator } from "$lib/features/create/shared/get-extension-flow-coordinator";
import * as firstStepAnalyzerModule from "$lib/features/create/shared/services/first-step-analyzer";
import * as sequenceJsonExporterModule from "$lib/features/create/shared/services/sequence-json-exporter";
import * as sequenceTransferHandlerModule from "$lib/features/create/shared/services/sequence-transfer-handler";
import * as subDrawerStatePersisterModule from "$lib/features/create/shared/services/sub-drawer-state-persister";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { ExtensionAnalysis, CircularizationOption } from "../../services/sequence-extender";
  import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import type { ExtensionFlowCoordinator } from "../../services/extension-flow-coordinator";
  import type { SubDrawerType } from "../../services/sub-drawer-state-persister";
  type FirstStepAnalyzer = typeof firstStepAnalyzerModule;
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import { UndoOperationType } from "../../services/undo-manager";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { getCreateModuleContext } from "../../context/create-module-context";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { isAdmin } from "$lib/shared/auth/state/authState.svelte";
  import { createSequenceActionsSubdrawerState } from "../../state/sequence-actions-subdrawer-state.svelte";

  import CreatePanelDrawer from "../CreatePanelDrawer.svelte";
  import SequencePreviewDialog from "./SequencePreviewDialog.svelte";
  import TransformsGridMode from "./TransformsGridMode.svelte";
  import TransformHelpOverlay from "../transform-help/TransformHelpOverlay.svelte";
  import TransformDetailModal from "../transform-help/TransformDetailModal.svelte";
  import TurnPatternDrawer from "./TurnPatternDrawer.svelte";

  // Transform help mode types
  import type { ActionHelpId } from "../../domain/transforms/transform-help-content";
  type HelpMode = "inactive" | "selecting" | "viewing";
  import RotationDirectionDrawer from "./RotationDirectionDrawer.svelte";
  import DurationPatternDrawer from "./DurationPatternDrawer.svelte";
  import ExtendDrawer from "./ExtendDrawer.svelte";
  import StepGridSection from "./StepGridSection.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import FirstStepConfirmDialog from "./FirstStepConfirmDialog.svelte";
  import HandSelector from "./HandSelector.svelte";
  import MobileHandSelector from "./MobileHandSelector.svelte";
  import MobileActionToolbar from "./MobileActionToolbar.svelte";
  import { setGridRotationDirection } from "$lib/shared/pictograph/grid/state/grid-rotation-state.svelte";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
  import { getReturnContext } from "$lib/shared/coordinators/sequence-handoff.svelte";

  interface Props {
    show: boolean;
    onClose?: () => void;
  }

  let { show, onClose }: Props = $props();

  // Context and state
  const ctx = getCreateModuleContext();
  const { CreateModuleState, panelState, layout } = ctx;
  // Use $derived.by() to ensure reactive property tracking through function calls
  const activeSequenceState = $derived.by(() =>
    CreateModuleState.getActiveTabSequenceState()
  );
  const sequence = $derived.by(() => activeSequenceState.currentSequence);
  const hasSequence = $derived.by(() => activeSequenceState.hasSequence());
  const isInConstructTab = $derived(
    navigationState.currentCreateMode === "construct"
  );
  const isSideBySideLayout = $derived(layout.shouldUseSideBySideLayout);

  // Track viewport width reactively for compact mode detection
  let viewportWidth = $state(
    typeof window !== "undefined" ? window.innerWidth : 1000
  );

  // Swap is disabled when only one hand is selected (swap requires both hands)
  const isSwapDisabled = $derived(panelState.targetHand !== "both");

  $effect(() => {
    if (typeof window === "undefined") return;
    viewportWidth = window.innerWidth; // Update on mount
    const handleResize = () => {
      viewportWidth = window.innerWidth;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  const isMobileLayout = $derived(!isSideBySideLayout);

  // Compact mode for mobile portrait - horizontal icon+text layout
  // Applies to most mobile widths, disabled at tablet/desktop widths
  const useCompactMode = $derived(!isSideBySideLayout && viewportWidth < 600);

  // Panel height for drawer content
  const panelHeight = $derived(
    panelState.navigationBarHeight + panelState.toolPanelHeight
  );

  // Services
  const hapticService = getHapticFeedback();
  const extensionFlowCoordinator = getExtensionFlowCoordinator();
  const subDrawerPersister = subDrawerStatePersisterModule;
  const transferHandler = sequenceTransferHandlerModule;
  const firstStepAnalyzer: FirstStepAnalyzer = firstStepAnalyzerModule;
  const jsonExporter = sequenceJsonExporterModule;

  // Local state - $effect below handles initial and prop changes
  let isOpen = $state(false);
  let isTransforming = $state(false);
  let showConfirmDialog = $state(false);
  let pendingSequenceTransfer = $state<any>(null);
  // Sub-drawer states - initialized to false, restored after parent drawer registers
  // Transform help mode state machine
  let helpMode = $state<HelpMode>("inactive");
  let selectedTransform = $state<ActionHelpId | null>(null);
  let showTurnPatternDrawer = $state(false);
  let showRotationDirectionDrawer = $state(false);
  let showDurationDrawer = $state(false);
  let showExtendDrawer = $state(false);
  let extensionAnalysis = $state<ExtensionAnalysis | null>(null);
  // Spotlight modal state (legacy - modal replaced with route navigation)
  let spotlightOpen = $state(false);
  let spotlightSequence = $state<SequenceData | null>(null);
  // Note: These are kept for backwards compatibility but modal is no longer rendered
  let circularizationOptions = $state<CircularizationOption[]>([]);
  let directUnavailableReason = $state<string | null>(null);
  let isExtending = $state(false);
  let showShiftConfirmDialog = $state(false);
  let pendingShiftStepNumber = $state<number | null>(null);

  // Track if we've completed initial restoration (prevents auto-save from clearing on mount)
  let restorationComplete = $state(false);

  // Auto-save active sub-drawer to sessionStorage
  // Only clears if restoration is complete (prevents clearing saved state on mount)
  $effect(() => {
    if (!subDrawerPersister) return;

    let activeDrawer: SubDrawerType = null;
    if (showTurnPatternDrawer) activeDrawer = "turnPattern";
    else if (showRotationDirectionDrawer) activeDrawer = "rotationDirection";
    else if (showDurationDrawer) activeDrawer = "duration";
    else if (showExtendDrawer) activeDrawer = "extend";
    else if (helpMode !== "inactive") activeDrawer = "help";

    if (activeDrawer) {
      subDrawerPersister.setActiveSubDrawer(activeDrawer);
    } else if (restorationComplete) {
      // Only clear if restoration is done - prevents clearing on initial mount
      subDrawerPersister.clearSubDrawer();
    }
  });

  // Shift start mode uses panelState for cross-component coordination
  const isShiftStartMode = $derived(panelState.isShiftStartMode);

  // Sync isOpen with show prop, reset restore flag on close
  $effect(() => {
    isOpen = show;
    if (!show) {
      hasRestoredSubDrawer = false;
    }
  });

  // Beat selection state (for displaying in beat grid)
  const selectedStepNumber = $derived.by(
    () => activeSequenceState.selectedStepNumber
  );
  const hasSelection = $derived(selectedStepNumber !== null);

  // Extension availability - check if sequence can be extended
  const canExtend = $derived.by(() => {
    if (!sequence || !extensionFlowCoordinator) return false;
    return extensionFlowCoordinator.canExtend(sequence);
  });

  // Shift start availability - need at least 2 steps
  const canShiftStart = $derived(
    !!(sequence && sequence.steps && sequence.steps.length >= 2)
  );

  // Note: Services are resolved at module scope from ITI container

  // Restore sub-drawer state when panel opens.
  // Opens the sub-drawer immediately so user goes straight to
  // Duration/Extend/Turns/Rotation without seeing the actions grid first.
  let hasRestoredSubDrawer = false;
  $effect(() => {
    if (isOpen && !hasRestoredSubDrawer && subDrawerPersister) {
      hasRestoredSubDrawer = true;
      const restoredSubDrawer = subDrawerPersister.getActiveSubDrawer();
      if (restoredSubDrawer) {
        if (restoredSubDrawer === "help") helpMode = "selecting";
        else if (restoredSubDrawer === "turnPattern")
          showTurnPatternDrawer = true;
        else if (restoredSubDrawer === "rotationDirection")
          showRotationDirectionDrawer = true;
        else if (restoredSubDrawer === "duration") showDurationDrawer = true;
        else if (restoredSubDrawer === "extend") showExtendDrawer = true;
        restorationComplete = true;
      }
    }
  });

  // Transform helper - eliminates boilerplate across all transform handlers
  // Pushes undo snapshot BEFORE performing the action
  async function withTransform(
    undoType: UndoOperationType,
    action: () => Promise<void>,
    beforeAction?: () => void
  ) {
    if (!sequence || isTransforming) return;
    isTransforming = true;
    hapticService?.trigger("selection");

    // Push undo snapshot BEFORE the transform
    CreateModuleState.pushUndoSnapshot(undoType);

    beforeAction?.();
    try {
      await action();
    } finally {
      isTransforming = false;
    }
  }

  // Transform handlers - pass targetHand from panel state
  const handleMirror = () =>
    withTransform(UndoOperationType.MIRROR_SEQUENCE, () =>
      activeSequenceState.mirrorSequence(panelState.targetHand)
    );
  const handleSwap = () =>
    withTransform(UndoOperationType.SWAP_COLORS, () =>
      activeSequenceState.swapColors()
    ); // Swap always operates on both hands
  const handleRewind = () =>
    withTransform(UndoOperationType.REWIND_SEQUENCE, () =>
      activeSequenceState.rewindSequence(panelState.targetHand)
    );
  const handleFlip = () =>
    withTransform(UndoOperationType.FLIP_SEQUENCE, () =>
      activeSequenceState.flipSequence(panelState.targetHand)
    );
  const handleInvert = () =>
    withTransform(UndoOperationType.INVERT_SEQUENCE, () =>
      activeSequenceState.invertSequence(panelState.targetHand)
    );

  // Rotation handlers set grid animation direction before transform
  const handleRotateCW = () =>
    withTransform(
      UndoOperationType.ROTATE_SEQUENCE,
      () => activeSequenceState.rotateSequence("clockwise", panelState.targetHand),
      () => setGridRotationDirection(1)
    );
  const handleRotateCCW = () =>
    withTransform(
      UndoOperationType.ROTATE_SEQUENCE,
      () => activeSequenceState.rotateSequence("counterclockwise", panelState.targetHand),
      () => setGridRotationDirection(-1)
    );

  function handlePreview() {
    if (!sequence) return;
    hapticService?.trigger("selection");
    handleClose();
    const { returnPath, returnLabel } = getReturnContext();
    openSequenceViewer(sequence, { returnPath, returnLabel });
  }

  function handleSpotlightClose() {
    // Legacy - no longer used since modal is replaced with route
    spotlightOpen = false;
    spotlightSequence = null;
  }

  function handleTurnPattern() {
    hapticService?.trigger("selection");
    showTurnPatternDrawer = true;
  }

  function handleTurnPatternApply(result: {
    sequence: any;
    warnings?: readonly string[];
  }) {
    // Push undo snapshot BEFORE applying pattern
    CreateModuleState.pushUndoSnapshot(UndoOperationType.APPLY_TURN_PATTERN);

    // Update the active sequence with the pattern-applied sequence
    activeSequenceState.setCurrentSequence(result.sequence);
    hapticService?.trigger("success");
  }

  function handleRotationDirection() {
    hapticService?.trigger("selection");
    showRotationDirectionDrawer = true;
  }

  function handleRotationDirectionApply(result: {
    sequence: any;
    warnings?: readonly string[];
  }) {
    // Push undo snapshot BEFORE applying pattern
    CreateModuleState.pushUndoSnapshot(
      UndoOperationType.APPLY_ROTATION_PATTERN
    );

    // Update the active sequence with the pattern-applied sequence
    activeSequenceState.setCurrentSequence(result.sequence);
    hapticService?.trigger("success");
  }

  function handleDuration() {
    hapticService?.trigger("selection");
    showDurationDrawer = true;
    // Enter preview mode on desktop (side-by-side layout)
    if (isSideBySideLayout && sequence) {
      panelState.enterDurationPreviewMode(sequence);
    }
  }

  function handleDurationDrawerClose() {
    showDurationDrawer = false;
    // Exit preview mode and revert to original sequence
    if (panelState.isDurationPreviewMode) {
      const { sequence: original } = panelState.exitDurationPreviewMode(false);
      // Don't need to do anything with original - preview mode already reverts
    }
  }

  function handleDurationPreview(previewSequence: any) {
    // Update preview sequence in panel state (for workspace display)
    if (panelState.isDurationPreviewMode) {
      panelState.setPreviewSequence(previewSequence);
    }
  }

  function handleDurationApply(result: {
    sequence: any;
    warnings?: readonly string[];
  }) {
    // Push undo snapshot BEFORE applying pattern
    CreateModuleState.pushUndoSnapshot(
      UndoOperationType.APPLY_DURATION_PATTERN
    );

    // Exit preview mode and apply the changes
    if (panelState.isDurationPreviewMode) {
      panelState.exitDurationPreviewMode(true); // apply = true
    }

    // Update the active sequence with the pattern-applied sequence
    activeSequenceState.setCurrentSequence(result.sequence);
    hapticService?.trigger("success");
  }

  async function handleExtend() {
    if (!sequence || !extensionFlowCoordinator) return;
    hapticService?.trigger("selection");

    const result = await extensionFlowCoordinator.startFlow(sequence);

    if (!result.canExtend) {
      toast.warning(result.errorMessage || "Cannot extend this sequence");
      return;
    }

    extensionAnalysis = result.analysis;
    circularizationOptions = result.circularizationOptions;
    directUnavailableReason = result.directUnavailableReason;
    showExtendDrawer = true;
  }

  /**
   * Handle bridge pictograph selection - immediately appends to sequence
   * and re-analyzes to show LOOP options.
   */
  async function handleBridgeAppend(bridgeLetter: Letter) {
    if (!sequence || !extensionFlowCoordinator || isExtending) return;
    isExtending = true;
    hapticService?.trigger("selection");

    // Push undo snapshot BEFORE appending bridge
    CreateModuleState.pushUndoSnapshot(UndoOperationType.ADD_BEAT);

    const result = await extensionFlowCoordinator.appendBridge(
      sequence,
      bridgeLetter
    );

    if (result.success && result.sequence) {
      activeSequenceState.setCurrentSequence(result.sequence);
      extensionAnalysis = result.analysis;
      circularizationOptions = []; // Clear bridge options since we now have LOOPs
      directUnavailableReason = null;
      hapticService?.trigger("success");
      toast.success(result.message);
    } else {
      toast.error(result.message);
      hapticService?.trigger("error");
    }

    isExtending = false;
  }

  /**
   * Handle LOOP selection - applies the LOOP to extend the sequence.
   * Bridge letter (if any) has already been appended by handleBridgeAppend.
   */
  async function handleExtendApply(loopType: LOOPType) {
    if (!sequence || !extensionFlowCoordinator || isExtending) return;
    isExtending = true;
    hapticService?.trigger("selection");

    // Push undo snapshot BEFORE applying extension
    CreateModuleState.pushUndoSnapshot(UndoOperationType.EXTEND_SEQUENCE);

    const result = await extensionFlowCoordinator.applyLoop(sequence, loopType);

    if (result.success && result.sequence) {
      activeSequenceState.setCurrentSequence(result.sequence);
      hapticService?.trigger("success");
      toast.success(result.message);

      // Close the drawer on success
      showExtendDrawer = false;
      extensionAnalysis = null;
      circularizationOptions = [];
      directUnavailableReason = null;
    } else {
      toast.warning(result.message);
      hapticService?.trigger("error");
    }

    isExtending = false;
  }

  function handleEditInConstructor() {
    if (!sequence || !transferHandler) return;
    hapticService?.trigger("selection");

    const constructTabState = ctx.constructTabState;
    if (!constructTabState?.sequenceState) return;

    const currentConstructorSequence =
      constructTabState.sequenceState.currentSequence;
    const hasSequence = constructTabState.sequenceState.hasSequence();

    const result = transferHandler.checkTransfer(
      sequence,
      currentConstructorSequence,
      hasSequence
    );

    switch (result.action) {
      case "already-loaded":
        toast.info("Sequence already loaded in Construct");
        handleClose();
        navigationState.setActiveTab("construct");
        break;
      case "confirm-needed":
        pendingSequenceTransfer = result.pendingSequence;
        showConfirmDialog = true;
        break;
      case "transfer":
        performSequenceTransfer(result.sequence);
        break;
    }
  }

  async function performSequenceTransfer(sequenceToTransfer: any) {
    if (!transferHandler) return;
    const constructTabState = ctx.constructTabState;
    if (!constructTabState?.sequenceState) return;

    // Create properly typed object for transfer (TypeScript narrowing doesn't apply to the whole object)
    const transferTarget = {
      sequenceState: constructTabState.sequenceState,
      syncGridModeFromSequence: constructTabState.syncGridModeFromSequence,
      setSelectedStartPosition: constructTabState.setSelectedStartPosition,
      setShowStartPositionPicker: constructTabState.setShowStartPositionPicker,
      syncPickerStateWithSequence:
        constructTabState.syncPickerStateWithSequence,
    };

    await transferHandler.executeTransfer(sequenceToTransfer, transferTarget);

    // Close panel and switch tab AFTER state is saved
    handleClose();
    navigationState.setActiveTab("construct");
  }

  function handleClose() {
    hapticService?.trigger("selection");
    onClose?.();
  }

  function handleStepSelect(stepNumber: number) {
    hapticService?.trigger("selection");
    activeSequenceState.selectStep(stepNumber);
    // Opening Beat Editor is handled by the auto-open effect
  }

  function handleOpenBeatEditor() {
    hapticService?.trigger("selection");
    panelState.openStepEditorPanel();
  }

  function handleShiftStart() {
    if (!sequence || !canShiftStart) return;
    hapticService?.trigger("selection");
    panelState.enterShiftStartMode(handleShiftStartBeatSelect);
    toast.info("Tap the beat you want to play first - it will become Beat 1");
  }

  function handleShiftStartBeatSelect(stepNumber: number) {
    if (!sequence || !firstStepAnalyzer) return;
    hapticService?.trigger("selection");

    const result = firstStepAnalyzer.analyzeSelection(sequence, stepNumber);

    switch (result.action) {
      case "no-op":
        toast.info(result.reason);
        panelState.exitShiftStartMode();
        break;
      case "immediate":
        executeShiftStart(result.stepNumber);
        break;
      case "confirm-needed":
        pendingShiftStepNumber = result.stepNumber;
        showShiftConfirmDialog = true;
        break;
    }
  }

  async function executeShiftStart(stepNumber: number) {
    if (!sequence || !firstStepAnalyzer || isTransforming) return;
    isTransforming = true;

    // Push undo snapshot BEFORE shifting
    CreateModuleState.pushUndoSnapshot(UndoOperationType.SHIFT_START);

    try {
      await activeSequenceState.shiftStartPosition(stepNumber);
      const result = firstStepAnalyzer.getResultMessage(sequence, stepNumber);
      toast.success(result.message);
      hapticService?.trigger("success");
    } catch (error) {
      console.error("[ShiftStart] Failed:", error);
      toast.error("Could not shift start position");
      hapticService?.trigger("error");
    } finally {
      isTransforming = false;
      panelState.exitShiftStartMode();
      pendingShiftStepNumber = null;
      showShiftConfirmDialog = false;
    }
  }

  function cancelShiftStart() {
    panelState.exitShiftStartMode();
    pendingShiftStepNumber = null;
    showShiftConfirmDialog = false;
  }

  async function handleCopySequenceJson() {
    if (!sequence || !jsonExporter) return;
    hapticService?.trigger("selection");

    const success = await jsonExporter.copyToClipboard(sequence);
    if (success) {
      toast.success("Sequence JSON copied to clipboard");
    } else {
      toast.error("Failed to copy to clipboard");
    }
  }

  // ===== HELP MODE HANDLERS =====
  // Toggle body class for z-index boosting (drawer needs to be above backdrop)
  $effect(() => {
    if (helpMode === "selecting") {
      document.body.classList.add("help-mode-active");
    } else {
      document.body.classList.remove("help-mode-active");
    }
    return () => document.body.classList.remove("help-mode-active");
  });

  function enterHelpMode() {
    hapticService?.trigger("selection");
    helpMode = "selecting";
  }

  function selectTransformHelp(actionId: ActionHelpId) {
    hapticService?.trigger("selection");
    selectedTransform = actionId;
    helpMode = "viewing";
  }

  function closeDetailModal() {
    // Return to selection state so user can browse other transforms
    helpMode = "selecting";
    selectedTransform = null;
  }

  function exitHelpMode() {
    // Fully exit help mode (backdrop click or escape from selection)
    helpMode = "inactive";
    selectedTransform = null;
  }

  /** Mobile long-press help: skip "selecting" mode, go directly to viewing */
  function handleHelpRequest(actionId: ActionHelpId) {
    selectedTransform = actionId;
    helpMode = "viewing";
  }
</script>

<CreatePanelDrawer
  bind:isOpen
  panelName="sequence-actions"
  combinedPanelHeight={panelHeight}
  fullHeightOnMobile={true}
  showHandle={true}
  closeOnBackdrop={true}
  focusTrap={false}
  lockScroll={false}
  ariaLabel="Sequence actions panel"
  onClose={handleClose}
>
  <div class="editor-panel" class:help-active={helpMode === "selecting"}>
    <!-- Simple header with title and actions -->
    <div class="compact-header" class:dimmed={helpMode === "selecting"}>
      <h2 class="panel-title">Sequence Actions</h2>

      {#if isMobileLayout}
        <!-- Mobile: inline segmented hand selector in header -->
        <MobileHandSelector
          value={panelState.targetHand}
          onChange={(hand) => panelState.setTargetHand(hand)}
        />
      {/if}

      <div class="header-actions">
        {#if isAdmin() && hasSequence}
          <button
            class="icon-btn copy"
            onclick={handleCopySequenceJson}
            aria-label="Copy sequence JSON"
            title="Copy sequence JSON"
          >
            <i class="fas fa-code" aria-hidden="true"></i>
          </button>
        {/if}
        {#if !isMobileLayout}
          <button
            class="icon-btn help"
            class:active={helpMode === "selecting"}
            onclick={enterHelpMode}
            aria-label="Help with transform actions"
          >
            <i class="fas fa-circle-question" aria-hidden="true"></i>
          </button>
        {/if}
        <button class="icon-btn close" onclick={handleClose} aria-label="Close">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <!-- Hand selector for single-hand transforms (desktop only) -->
    {#if !isMobileLayout}
      <div class:dimmed={helpMode === "selecting"}>
        <HandSelector
          value={panelState.targetHand}
          onChange={(hand) => panelState.setTargetHand(hand)}
        />
      </div>
    {/if}

    <!-- Beat grid display: shows on mobile, takes all available space -->
    {#if hasSequence && isSideBySideLayout === false && sequence}
      <div class="step-grid-wrapper" class:dimmed={helpMode === "selecting"}>
        <StepGridSection
          steps={sequence.steps}
          startPosition={sequence.startPosition ||
            sequence.startingPosition ||
            null}
          {selectedStepNumber}
          isShiftMode={isShiftStartMode}
          mobileMode={isMobileLayout}
          onStepClick={isShiftStartMode
            ? handleShiftStartBeatSelect
            : handleStepSelect}
          onStartClick={() => (isShiftStartMode ? null : handleStepSelect(0))}
          onStepLongPress={handlePreview}
          onCancelShiftMode={cancelShiftStart}
        />
      </div>
    {/if}

    {#if isMobileLayout}
      <!-- Mobile: compact toolbar with category tabs -->
      <MobileActionToolbar
        {hasSequence}
        {hasSelection}
        {isTransforming}
        {canExtend}
        {isExtending}
        {canShiftStart}
        swapDisabled={isSwapDisabled}
        showEditInConstructor={!isInConstructTab}
        onHelpRequest={handleHelpRequest}
        onTurns={handleOpenBeatEditor}
        onMirror={handleMirror}
        onFlip={handleFlip}
        onInvert={handleInvert}
        onRotateCW={handleRotateCW}
        onRotateCCW={handleRotateCCW}
        onSwap={handleSwap}
        onRewind={handleRewind}
        onTurnPattern={handleTurnPattern}
        onRotationDirection={handleRotationDirection}
        onDuration={handleDuration}
        onExtend={handleExtend}
        onShiftStart={handleShiftStart}
        onEditInConstructor={handleEditInConstructor}
      />
    {:else}
      <!-- Desktop: full grid of all actions -->
      <div class="controls-content">
        <TransformsGridMode
          {hasSequence}
          {hasSelection}
          {isTransforming}
          {canExtend}
          {isExtending}
          {canShiftStart}
          swapDisabled={isSwapDisabled}
          showEditInConstructor={!isInConstructTab}
          isDesktopPanel={isSideBySideLayout}
          compactMode={useCompactMode}
          helpMode={helpMode === "selecting"}
          onHelpSelect={selectTransformHelp}
          onTurns={handleOpenBeatEditor}
          onMirror={handleMirror}
          onFlip={handleFlip}
          onInvert={handleInvert}
          onRotateCW={handleRotateCW}
          onRotateCCW={handleRotateCCW}
          onSwap={handleSwap}
          onRewind={handleRewind}
          onTurnPattern={handleTurnPattern}
          onRotationDirection={handleRotationDirection}
          onDuration={handleDuration}
          onExtend={handleExtend}
          onShiftStart={handleShiftStart}
          onEditInConstructor={handleEditInConstructor}
        />
      </div>
    {/if}
  </div>
</CreatePanelDrawer>

<!-- Help mode: overlay when selecting, modal when viewing -->
{#if helpMode === "selecting"}
  <TransformHelpOverlay onClose={exitHelpMode} />
{:else if helpMode === "viewing" && selectedTransform}
  <TransformDetailModal
    transformId={selectedTransform}
    onClose={closeDetailModal}
  />
{/if}



<SequencePreviewDialog
  bind:isOpen={showConfirmDialog}
  currentSequence={ctx.constructTabState?.sequenceState?.currentSequence}
  incomingSequence={pendingSequenceTransfer}
  onConfirm={() => {
    performSequenceTransfer(pendingSequenceTransfer);
    pendingSequenceTransfer = null;
  }}
  onCancel={() => {
    pendingSequenceTransfer = null;
  }}
/>

<TurnPatternDrawer
  bind:isOpen={showTurnPatternDrawer}
  {sequence}
  targetHand={panelState.targetHand}
  toolPanelWidth={panelState.toolPanelWidth}
  onClose={() => (showTurnPatternDrawer = false)}
  onApply={handleTurnPatternApply}
/>

<RotationDirectionDrawer
  bind:isOpen={showRotationDirectionDrawer}
  {sequence}
  targetHand={panelState.targetHand}
  toolPanelWidth={panelState.toolPanelWidth}
  onClose={() => (showRotationDirectionDrawer = false)}
  onApply={handleRotationDirectionApply}
/>

<DurationPatternDrawer
  bind:isOpen={showDurationDrawer}
  sequence={panelState.isDurationPreviewMode ? panelState.previewSequence : sequence}
  toolPanelWidth={panelState.toolPanelWidth}
  previewMode={isSideBySideLayout}
  onClose={handleDurationDrawerClose}
  onPreview={handleDurationPreview}
  onApply={handleDurationApply}
/>

<ExtendDrawer
  bind:isOpen={showExtendDrawer}
  analysis={extensionAnalysis}
  {circularizationOptions}
  {directUnavailableReason}
  isApplying={isExtending}
  toolPanelWidth={panelState.toolPanelWidth}
  onClose={() => {
    showExtendDrawer = false;
    extensionAnalysis = null;
    circularizationOptions = [];
    directUnavailableReason = null;
  }}
  onBridgeAppend={handleBridgeAppend}
  onApply={handleExtendApply}
/>

<!-- First Beat Confirmation Dialog (non-circular sequences) -->
<FirstStepConfirmDialog
  show={showShiftConfirmDialog && pendingShiftStepNumber !== null}
  stepNumber={pendingShiftStepNumber ?? 1}
  onConfirm={() => executeShiftStart(pendingShiftStepNumber!)}
  onCancel={cancelShiftStart}
/>

<!-- Spotlight Modal - Replaced with /sequence/[id] route navigation -->

<style>
  .editor-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    position: relative;
  }

  /* Compact header */
  .compact-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(15, 20, 30, 0.95);
    border-bottom: 1px solid var(--theme-stroke);
    height: var(--min-touch-target);
    flex-shrink: 0;
  }

  .panel-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

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

  .icon-btn.copy {
    background: rgba(59, 130, 246, 0.15);
    color: rgba(59, 130, 246, 0.8);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .icon-btn.copy:hover {
    background: rgba(59, 130, 246, 0.25);
    color: rgba(59, 130, 246, 1);
    border-color: rgba(59, 130, 246, 0.5);
  }

  .icon-btn.help {
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
  }

  .icon-btn.help:hover {
    background: rgba(255, 255, 255, 0.12);
    color: var(--theme-text);
  }

  .icon-btn.help.active {
    background: rgba(59, 130, 246, 0.2);
    color: rgba(59, 130, 246, 1);
    border-color: rgba(59, 130, 246, 0.5);
    animation: help-pulse 1.5s ease-in-out infinite;
  }

  @keyframes help-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }
    50% {
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.4);
    }
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

  /* Narrow screens */
  @media (max-width: 400px) {
    .compact-header {
      padding: 4px 10px;
    }

    .icon-btn {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      font-size: var(--font-size-sm);
    }
  }

  /* Note: Beat grid visibility is controlled by isSideBySideLayout in the template,
     not by CSS media queries. The JavaScript logic considers device type,
     orientation, and viewport dimensions for proper responsive behavior. */

  /* Wrapper lets step grid absorb all remaining vertical space */
  .step-grid-wrapper {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .controls-content {
    flex: 1;
    min-height: 180px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .icon-btn {
      transition: none;
    }
  }

  /* Help mode dimming for non-interactive sections */
  .dimmed {
    opacity: 0.3;
    pointer-events: none;
    transition: opacity var(--duration-normal) ease;
  }

  /* Boost drawer z-index when help mode is active (above backdrop at 200) */
  :global(body.help-mode-active .sequence-actions-panel-container) {
    z-index: 210 !important;
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .active {
      animation: none;
    }
  }
</style>
