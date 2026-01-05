<!--
  SequenceActionsPanel.svelte

  Panel for sequence-wide operations: transforms, patterns, extend.
  Individual beat editing (turns, rotation) is handled by BeatEditorPanel.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { resolve, TYPES } from "$lib/shared/inversify/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type {
    ISequenceExtender,
    ExtensionAnalysis,
    LOOPType,
    CircularizationOption,
  } from "../../services/contracts/ISequenceExtender";
  import type {
    ISubDrawerStatePersister,
    SubDrawerType,
  } from "../../services/contracts/ISubDrawerStatePersister";
  import type { ISequenceTransferHandler } from "../../services/contracts/ISequenceTransferHandler";
  import type { IFirstBeatAnalyzer } from "../../services/contracts/IFirstBeatAnalyzer";
  import type { ISequenceJsonExporter } from "../../services/contracts/ISequenceJsonExporter";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import { UndoOperationType } from "../../services/contracts/IUndoManager";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { getCreateModuleContext } from "../../context/create-module-context";
  import { openSpotlightWithBeatGrid } from "$lib/shared/application/state/ui/ui-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { isAdmin } from "$lib/shared/auth/state/authState.svelte";

  import CreatePanelDrawer from "../CreatePanelDrawer.svelte";
  import SequencePreviewDialog from "./SequencePreviewDialog.svelte";
  import TransformsGridMode from "./TransformsGridMode.svelte";
  import TransformHelpOverlay from "../transform-help/TransformHelpOverlay.svelte";
  import TransformDetailModal from "../transform-help/TransformDetailModal.svelte";
  import TurnPatternDrawer from "./TurnPatternDrawer.svelte";

  // Transform help mode types
  type HelpMode = "inactive" | "selecting" | "viewing";
  type TransformId = "mirror" | "flip" | "invert" | "rotate" | "swap" | "rewind";
  import RotationDirectionDrawer from "./RotationDirectionDrawer.svelte";
  import ExtendDrawer from "./ExtendDrawer.svelte";
  import BeatGridSection from "./BeatGridSection.svelte";
  import FirstBeatConfirmDialog from "./FirstBeatConfirmDialog.svelte";
  import HandSelector from "./HandSelector.svelte";
  import { setGridRotationDirection } from "$lib/shared/pictograph/grid/state/grid-rotation-state.svelte";

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
    navigationState.currentCreateMode === "constructor"
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

  // Compact mode for mobile portrait - horizontal icon+text layout
  // Applies to most mobile widths, disabled at tablet/desktop widths
  const useCompactMode = $derived(!isSideBySideLayout && viewportWidth < 600);

  // Panel height for drawer content
  const panelHeight = $derived(
    panelState.navigationBarHeight + panelState.toolPanelHeight
  );

  // Services
  let hapticService: IHapticFeedback | null = $state(null);
  let sequenceExtender: ISequenceExtender | null = $state(null);
  let subDrawerPersister: ISubDrawerStatePersister | null = $state(null);
  let transferHandler: ISequenceTransferHandler | null = $state(null);
  let firstBeatAnalyzer: IFirstBeatAnalyzer | null = $state(null);
  let jsonExporter: ISequenceJsonExporter | null = $state(null);

  // Local state - $effect below handles initial and prop changes
  let isOpen = $state(false);
  let isTransforming = $state(false);
  let showConfirmDialog = $state(false);
  let pendingSequenceTransfer = $state<any>(null);
  // Sub-drawer states - initialized to false, restored after parent drawer registers
  // Transform help mode state machine
  let helpMode = $state<HelpMode>("inactive");
  let selectedTransform = $state<TransformId | null>(null);
  let showTurnPatternDrawer = $state(false);
  let showRotationDirectionDrawer = $state(false);
  let showExtendDrawer = $state(false);
  let extensionAnalysis = $state<ExtensionAnalysis | null>(null);
  let circularizationOptions = $state<CircularizationOption[]>([]);
  let directUnavailableReason = $state<string | null>(null);
  let isExtending = $state(false);
  let showShiftConfirmDialog = $state(false);
  let pendingShiftBeatNumber = $state<number | null>(null);

  // Track if we've completed initial restoration (prevents auto-save from clearing on mount)
  let restorationComplete = $state(false);

  // Auto-save active sub-drawer to sessionStorage
  // Only clears if restoration is complete (prevents clearing saved state on mount)
  $effect(() => {
    if (!subDrawerPersister) return;

    let activeDrawer: SubDrawerType = null;
    if (showTurnPatternDrawer) activeDrawer = "turnPattern";
    else if (showRotationDirectionDrawer) activeDrawer = "rotationDirection";
    else if (showExtendDrawer) activeDrawer = "extend";
    else if (helpMode !== "inactive") activeDrawer = "help";

    if (activeDrawer) {
      subDrawerPersister.setActiveSubDrawer(activeDrawer);
    } else if (restorationComplete) {
      // Only clear if restoration is done - prevents clearing on initial mount
      subDrawerPersister.clear();
    }
  });

  // Shift start mode uses panelState for cross-component coordination
  const isShiftStartMode = $derived(panelState.isShiftStartMode);

  // Sync isOpen with show prop
  $effect(() => {
    isOpen = show;
  });

  // Beat selection state (for displaying in beat grid)
  const selectedBeatNumber = $derived.by(
    () => activeSequenceState.selectedBeatNumber
  );
  const hasSelection = $derived(selectedBeatNumber !== null);

  // Extension availability - check if sequence can be extended
  const canExtend = $derived.by(() => {
    if (!sequence || !sequenceExtender) return false;
    try {
      const analysis = sequenceExtender.analyzeSequence(sequence);
      return analysis.canExtend;
    } catch {
      return false;
    }
  });

  // Shift start availability - need at least 2 beats
  const canShiftStart = $derived(
    !!(sequence && sequence.beats && sequence.beats.length >= 2)
  );

  onMount(() => {
    try {
      hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
    } catch {
      /* Optional service */
    }
    try {
      sequenceExtender = resolve<ISequenceExtender>(TYPES.ISequenceExtender);
    } catch {
      /* Optional service */
    }
    try {
      subDrawerPersister = resolve<ISubDrawerStatePersister>(
        TYPES.ISubDrawerStatePersister
      );
    } catch {
      /* Optional service */
    }
    try {
      transferHandler = resolve<ISequenceTransferHandler>(
        TYPES.ISequenceTransferHandler
      );
    } catch {
      /* Optional service */
    }
    try {
      firstBeatAnalyzer = resolve<IFirstBeatAnalyzer>(TYPES.IFirstBeatAnalyzer);
    } catch {
      /* Optional service */
    }
    try {
      jsonExporter = resolve<ISequenceJsonExporter>(
        TYPES.ISequenceJsonExporter
      );
    } catch {
      /* Optional service */
    }
  });

  // Restore sub-drawer state AFTER parent drawer has opened and registered
  // Watch for when isOpen becomes true, then restore with delay
  let hasRestoredSubDrawer = false;
  $effect(() => {
    if (isOpen && !hasRestoredSubDrawer && subDrawerPersister) {
      hasRestoredSubDrawer = true;
      const restoredSubDrawer = subDrawerPersister.getActiveSubDrawer();
      // Wait for parent drawer to fully register, then open sub-drawer
      setTimeout(() => {
        if (restoredSubDrawer === "help") helpMode = "selecting";
        else if (restoredSubDrawer === "turnPattern")
          showTurnPatternDrawer = true;
        else if (restoredSubDrawer === "rotationDirection")
          showRotationDirectionDrawer = true;
        else if (restoredSubDrawer === "extend") showExtendDrawer = true;
        // Mark restoration complete so auto-save can clear when user closes sub-drawers
        restorationComplete = true;
      }, 100);
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
    // Open spotlight with beat grid - renders sequence directly without generating an image
    openSpotlightWithBeatGrid(sequence);
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

  async function handleExtend() {
    if (!sequence || !sequenceExtender) return;
    hapticService?.trigger("selection");

    // Analyze the sequence to get available LOOP options
    const analysis = sequenceExtender.analyzeSequence(sequence);

    // Store the analysis
    extensionAnalysis = analysis;

    // Fetch circularization options (bridge letters) if direct LOOPs aren't available
    if (!analysis.canExtend || analysis.availableLOOPOptions.length === 0) {
      try {
        circularizationOptions =
          await sequenceExtender.getCircularizationOptions(sequence);
        if (circularizationOptions.length === 0) {
          toast.warning("Cannot extend this sequence");
          return;
        }
        directUnavailableReason =
          "Position groups don't match for direct extension";
      } catch (error) {
        console.error("[Extend] Failed to get circularization options:", error);
        toast.warning("Cannot extend this sequence");
        return;
      }
    } else {
      circularizationOptions = [];
      directUnavailableReason = null;
    }

    showExtendDrawer = true;
  }

  /**
   * Handle bridge pictograph selection - immediately appends to sequence
   * and re-analyzes to show LOOP options.
   */
  async function handleBridgeAppend(bridgeLetter: Letter) {
    console.log("[Extend] handleBridgeAppend called with:", bridgeLetter);
    if (!sequence || !sequenceExtender || isExtending) {
      console.log(
        "[Extend] Early return - sequence:",
        !!sequence,
        "extender:",
        !!sequenceExtender,
        "isExtending:",
        isExtending
      );
      return;
    }
    isExtending = true;
    hapticService?.trigger("selection");

    try {
      // Push undo snapshot BEFORE appending bridge
      CreateModuleState.pushUndoSnapshot(UndoOperationType.ADD_BEAT);

      // Append the bridge beat to the sequence
      console.log("[Extend] Calling appendBridgeBeat...");
      const sequenceWithBridge = await sequenceExtender.appendBridgeBeat(
        sequence,
        bridgeLetter
      );
      console.log(
        "[Extend] Got extended sequence with",
        sequenceWithBridge.beats?.length,
        "beats"
      );

      // Update the sequence - this will show the new beat immediately
      activeSequenceState.setCurrentSequence(sequenceWithBridge);
      hapticService?.trigger("success");

      // Re-analyze the sequence (should now be directly loopable)
      const analysis = sequenceExtender.analyzeSequence(sequenceWithBridge);
      console.log(
        "[Extend] Re-analyzed - canExtend:",
        analysis.canExtend,
        "LOOPs:",
        analysis.availableLOOPOptions.length
      );
      extensionAnalysis = analysis;
      circularizationOptions = []; // Clear bridge options since we now have LOOPs
      directUnavailableReason = null;

      toast.success(`Added "${bridgeLetter}" - now choose LOOP pattern`);
    } catch (error) {
      console.error("[Extend] Failed to append bridge:", error);
      toast.error("Could not add bridge letter");
      hapticService?.trigger("error");
    } finally {
      isExtending = false;
    }
  }

  /**
   * Handle LOOP selection - applies the LOOP to extend the sequence.
   * Bridge letter (if any) has already been appended by handleBridgeAppend.
   */
  async function handleExtendApply(loopType: LOOPType) {
    if (!sequence || !sequenceExtender || isExtending) return;
    isExtending = true;
    hapticService?.trigger("selection");

    try {
      // Direct extension (bridge already appended if needed)
      const extendedSequence = await sequenceExtender.extendSequence(sequence, {
        loopType,
      });

      if (extendedSequence.beats?.length === sequence.beats?.length) {
        console.warn("[Extend] No new beats were added!");
        toast.warning("No extension beats generated");
        return;
      }

      // Push undo snapshot BEFORE applying extension
      CreateModuleState.pushUndoSnapshot(UndoOperationType.EXTEND_SEQUENCE);

      activeSequenceState.setCurrentSequence(extendedSequence);
      hapticService?.trigger("success");

      const beatsAdded =
        (extendedSequence.beats?.length || 0) - (sequence.beats?.length || 0);
      const loopName = loopType.replace(/_/g, " ");
      toast.success(`Extended with ${loopName}! Added ${beatsAdded} beats`);

      // Close the drawer on success
      showExtendDrawer = false;
      extensionAnalysis = null;
      circularizationOptions = [];
      directUnavailableReason = null;
    } catch (error) {
      console.error("[Extend] Failed:", error);
      toast.error("Could not extend sequence");
      hapticService?.trigger("error");
    } finally {
      isExtending = false;
    }
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
        toast.info("Sequence already loaded in Constructor");
        handleClose();
        navigationState.setActiveTab("constructor");
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
    navigationState.setActiveTab("constructor");
  }

  function handleClose() {
    hapticService?.trigger("selection");
    onClose?.();
  }

  function handleBeatSelect(beatNumber: number) {
    hapticService?.trigger("selection");
    activeSequenceState.selectBeat(beatNumber);
    // Opening Beat Editor is handled by the auto-open effect
  }

  function handleOpenBeatEditor() {
    hapticService?.trigger("selection");
    panelState.openBeatEditorPanel();
  }

  function handleShiftStart() {
    if (!sequence || !canShiftStart) return;
    hapticService?.trigger("selection");
    panelState.enterShiftStartMode(handleShiftStartBeatSelect);
    toast.info("Tap the beat you want to play first — it will become Beat 1");
  }

  function handleShiftStartBeatSelect(beatNumber: number) {
    if (!sequence || !firstBeatAnalyzer) return;
    hapticService?.trigger("selection");

    const result = firstBeatAnalyzer.analyzeSelection(sequence, beatNumber);

    switch (result.action) {
      case "no-op":
        toast.info(result.reason);
        panelState.exitShiftStartMode();
        break;
      case "immediate":
        executeShiftStart(result.beatNumber);
        break;
      case "confirm-needed":
        pendingShiftBeatNumber = result.beatNumber;
        showShiftConfirmDialog = true;
        break;
    }
  }

  async function executeShiftStart(beatNumber: number) {
    if (!sequence || !firstBeatAnalyzer || isTransforming) return;
    isTransforming = true;

    // Push undo snapshot BEFORE shifting
    CreateModuleState.pushUndoSnapshot(UndoOperationType.SHIFT_START);

    try {
      await activeSequenceState.shiftStartPosition(beatNumber);
      const result = firstBeatAnalyzer.getResultMessage(sequence, beatNumber);
      toast.success(result.message);
      hapticService?.trigger("success");
    } catch (error) {
      console.error("[ShiftStart] Failed:", error);
      toast.error("Could not shift start position");
      hapticService?.trigger("error");
    } finally {
      isTransforming = false;
      panelState.exitShiftStartMode();
      pendingShiftBeatNumber = null;
      showShiftConfirmDialog = false;
    }
  }

  function cancelShiftStart() {
    panelState.exitShiftStartMode();
    pendingShiftBeatNumber = null;
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
  function enterHelpMode() {
    hapticService?.trigger("selection");
    helpMode = "selecting";
  }

  function selectTransformHelp(transformId: TransformId) {
    hapticService?.trigger("selection");
    selectedTransform = transformId;
    helpMode = "viewing";
  }

  function exitHelpMode() {
    helpMode = "inactive";
    selectedTransform = null;
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
  <div class="editor-panel">
    <!-- Simple header with title and actions -->
    <div class="compact-header">
      <h2 class="panel-title">Sequence Actions</h2>

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
        <button
          class="icon-btn help"
          class:active={helpMode === "selecting"}
          onclick={enterHelpMode}
          aria-label="Help with transform actions"
        >
          <i class="fas fa-circle-question" aria-hidden="true"></i>
        </button>
        <button class="icon-btn close" onclick={handleClose} aria-label="Close">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <!-- Hand selector for single-hand transforms -->
    <HandSelector
      value={panelState.targetHand}
      onChange={(hand) => panelState.setTargetHand(hand)}
    />

    <!-- Beat grid display: shows on mobile at 50% height -->
    {#if hasSequence && isSideBySideLayout === false && sequence}
      <BeatGridSection
        beats={sequence.beats}
        startPosition={sequence.startPosition ||
          sequence.startingPositionBeat ||
          null}
        {selectedBeatNumber}
        isShiftMode={isShiftStartMode}
        onBeatClick={isShiftStartMode
          ? handleShiftStartBeatSelect
          : handleBeatSelect}
        onStartClick={() => (isShiftStartMode ? null : handleBeatSelect(0))}
        onBeatLongPress={handlePreview}
        onCancelShiftMode={cancelShiftStart}
      />
    {/if}

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
        onExtend={handleExtend}
        onShiftStart={handleShiftStart}
        onEditInConstructor={handleEditInConstructor}
      />
    </div>
  </div>
</CreatePanelDrawer>

<!-- Help mode: overlay when selecting, modal when viewing -->
{#if helpMode === "selecting"}
  <TransformHelpOverlay onClose={exitHelpMode} />
{:else if helpMode === "viewing" && selectedTransform}
  <TransformDetailModal
    transformId={selectedTransform}
    onClose={exitHelpMode}
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
<FirstBeatConfirmDialog
  show={showShiftConfirmDialog && pendingShiftBeatNumber !== null}
  beatNumber={pendingShiftBeatNumber ?? 1}
  onConfirm={() => executeShiftStart(pendingShiftBeatNumber!)}
  onCancel={cancelShiftStart}
/>

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
    transition: all 0.15s ease;
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
</style>
