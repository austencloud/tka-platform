<!--
HandPathOrchestrator.svelte - Main orchestrator for hand path assembly

Complete user flow:
1. Welcome screen (with grid mode selection) - explains the mode
2. Blue hand phase - tap positions on grid to build blue hand path
3. Red hand phase - tap positions to build red hand path (must match blue length)
4. Rotation selection - choose CW or CCW for shift motions
5. Complete - sequence is built, option to build another

Integrates all Assembly components and manages state transitions.
-->
<script lang="ts">
  import {
    GridLocation,
    GridMode,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import {
    MotionColor,
    RotationDirection,
    MotionType,
    Orientation,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import { createPictographData } from "$lib/shared/pictograph/shared/domain/factories/createPictographData";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import {
    createHandPathAssembleState,
    type HandPathAssembleState,
  } from "../state/handpath-assemble-state.svelte";
  import AssemblyWelcome from "./AssemblyWelcome.svelte";
  import AssemblyPhaseHeader from "./AssemblyPhaseHeader.svelte";
  import AssemblyControls from "./AssemblyControls.svelte";
  import HandPathGrid from "./HandPathGrid.svelte";
  import RotationSelector from "./RotationSelector.svelte";

  /**
   * Undo ref interface - exposed to parent for workspace-level undo
   */
  export interface AssemblyUndoRef {
    canUndo: boolean;
    undo: () => void;
  }

  /**
   * Back ref interface - exposed to parent for workspace back button
   * Returns to welcome screen (abandons current sequence)
   */
  export interface AssemblyBackRef {
    canGoBack: boolean;
    back: () => void;
  }

  let {
    initialGridMode = GridMode.DIAMOND,
    hasExistingSequence = false,
    existingStartPositionBeat = null,
    existingBeats = [],
    // Sequence callbacks
    onSequenceComplete,
    onSequenceUpdate,
    onHeaderTextChange,
    onStartPositionSet,
    // Bindable undo ref for workspace integration
    undoRef = $bindable(),
    // Bindable back ref for workspace back button
    backRef = $bindable(),
  } = $props<{
    initialGridMode?: GridMode;
    hasExistingSequence?: boolean;
    existingStartPositionBeat?: PictographData | null;
    existingBeats?: PictographData[];
    // Sequence callbacks
    onSequenceComplete?: (sequence: PictographData[]) => void;
    onSequenceUpdate?: (sequence: PictographData[]) => void;
    onHeaderTextChange?: (text: string) => void;
    onStartPositionSet?: (startPosition: PictographData) => void;
    // Bindable undo ref for workspace integration
    undoRef?: AssemblyUndoRef | null;
    // Bindable back ref for workspace back button
    backRef?: AssemblyBackRef | null;
  }>();

  // Local state for whether user has started building
  // Initialize with default - $effect syncs from prop
  let hasStarted = $state(false);

  // Transition state for animated exit back to welcome
  let isExitingToWelcome = $state(false);

  // Track if grid entrance animation should play (when just started building)
  let showGridEntranceAnimation = $state(false);

  // Grid mode (managed locally)
  // Initialize with default - $effect syncs from prop
  let gridMode = $state(GridMode.DIAMOND);

  // Sync initial values from props
  $effect(() => {
    hasStarted = hasExistingSequence;
    gridMode = initialGridMode;
  });

  // Extract GridLocation from a pictograph's blue motion
  function extractBlueLocation(
    pictograph: PictographData | null | undefined,
    useEnd: boolean = false
  ): GridLocation | null {
    if (!pictograph) return null;

    const blueMotion = pictograph.motions?.[MotionColor.BLUE];
    if (!blueMotion) return null;

    const location = useEnd ? blueMotion.endLocation : blueMotion.startLocation;
    return location as GridLocation | null;
  }

  // Reconstruct the full blue hand path from existing sequence data
  // The path is: startPosition + endLocations from each beat
  function reconstructBlueHandPath(): GridLocation[] {
    const path: GridLocation[] = [];

    // Get start position from startingPositionBeat
    const startLoc = extractBlueLocation(existingStartPositionBeat, false);
    if (startLoc) {
      path.push(startLoc);
    }

    // Get subsequent positions from beats (each beat's endLocation)
    if (existingBeats && existingBeats.length > 0) {
      for (const beat of existingBeats) {
        const endLoc = extractBlueLocation(beat, true);
        if (endLoc) {
          path.push(endLoc);
        }
      }
    }

    return path;
  }

  // Get initial blue hand path from existing data
  const initialBlueHandPath = $derived(
    hasExistingSequence ? reconstructBlueHandPath() : []
  );

  // Create state manager with restored state if available
  // HandPathAssembleState is already reactive internally, but we need $state for reassignment detection
  // Note: gridMode is captured at initialization only - when gridMode changes, we recreate assemblyState (see handleGridModeChange)
  let assemblyState: HandPathAssembleState = $state(
    createHandPathAssembleState({
      gridMode: GridMode.DIAMOND,
      initialBlueHandPath: undefined,
    })
  );

  // Initialize assembly state with actual props on first render
  let hasInitialized = false;
  $effect(() => {
    if (!hasInitialized) {
      hasInitialized = true;
      assemblyState = createHandPathAssembleState({
        gridMode: initialGridMode,
        initialBlueHandPath:
          initialBlueHandPath.length > 0 ? initialBlueHandPath : undefined,
      });
    }
  });

  const currentPhase = $derived(assemblyState.currentPhase);
  const bluePathLength = $derived(assemblyState.blueHandPath.length);
  const redPathLength = $derived(assemblyState.redHandPath.length);

  // Haptic feedback service
  const hapticService = container.items.hapticFeedback as IHapticFeedback;

  /**
   * Numpad-to-GridLocation mapping
   * Numpad layout mirrors the 3x3 grid:
   *   7(NW)  8(N)   9(NE)
   *   4(W)   5(C)   6(E)
   *   1(SW)  2(S)   3(SE)
   */
  const numpadToPosition: Record<string, GridLocation> = {
    Numpad7: GridLocation.NORTHWEST,
    Numpad8: GridLocation.NORTH,
    Numpad9: GridLocation.NORTHEAST,
    Numpad4: GridLocation.WEST,
    // Numpad5 = Center (disabled)
    Numpad6: GridLocation.EAST,
    Numpad1: GridLocation.SOUTHWEST,
    Numpad2: GridLocation.SOUTH,
    Numpad3: GridLocation.SOUTHEAST,
    // Also support regular number keys (top row)
    Digit7: GridLocation.NORTHWEST,
    Digit8: GridLocation.NORTH,
    Digit9: GridLocation.NORTHEAST,
    Digit4: GridLocation.WEST,
    Digit6: GridLocation.EAST,
    Digit1: GridLocation.SOUTHWEST,
    Digit2: GridLocation.SOUTH,
    Digit3: GridLocation.SOUTHEAST,
  };

  /**
   * Check if a position is enabled based on current grid mode
   */
  function isPositionEnabled(position: GridLocation): boolean {
    const cardinalPositions = [
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
    ];
    const intercardinalPositions = [
      GridLocation.NORTHEAST,
      GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST,
      GridLocation.NORTHWEST,
    ];

    if (gridMode === GridMode.DIAMOND) {
      return cardinalPositions.includes(position);
    } else if (gridMode === GridMode.BOX) {
      return intercardinalPositions.includes(position);
    }
    return false;
  }

  /**
   * Handle keyboard events for rapid sequence building
   * - Numpad 1-9: Select grid positions
   * - Enter: Advance to next phase
   * - Backspace: Undo last position
   */
  function handleKeydown(event: KeyboardEvent) {
    // Ignore if user is typing in an input field
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    // Handle different phases
    if (!hasStarted) {
      // Welcome screen: Enter to start
      if (event.code === "Enter" || event.code === "NumpadEnter") {
        event.preventDefault();
        hapticService?.trigger("selection");
        handleStart();
      }
      return;
    }

    // Grid building phases (blue or red)
    if (currentPhase === "blue" || currentPhase === "red") {
      // Numpad/number keys for position selection
      const position = numpadToPosition[event.code];
      if (position && isPositionEnabled(position)) {
        event.preventDefault();
        hapticService?.trigger("selection");
        handlePositionSelect(position);
        return;
      }

      // Enter to advance phase (if allowed)
      if (event.code === "Enter" || event.code === "NumpadEnter") {
        event.preventDefault();
        if (currentPhase === "blue" && canProceedToRed) {
          hapticService?.trigger("success");
          handleNextHand();
        } else if (currentPhase === "red" && canComplete) {
          hapticService?.trigger("success");
          handleProceedToRotation();
        }
        return;
      }

      // Backspace to undo
      if (event.code === "Backspace") {
        event.preventDefault();
        if (canUndoAssembly) {
          hapticService?.trigger("selection");
          handleUndo();
        }
        return;
      }
      return;
    }

    // Rotation selection phase
    if (currentPhase === "rotation-selection") {
      // 1 or Numpad1 for clockwise
      if (event.code === "Digit1" || event.code === "Numpad1") {
        event.preventDefault();
        hapticService?.trigger("success");
        handleRotationSelect(RotationDirection.CLOCKWISE);
        return;
      }
      // 2 or Numpad2 for counter-clockwise
      if (event.code === "Digit2" || event.code === "Numpad2") {
        event.preventDefault();
        hapticService?.trigger("success");
        handleRotationSelect(RotationDirection.COUNTER_CLOCKWISE);
        return;
      }
      // Backspace to go back to red hand phase
      if (event.code === "Backspace") {
        event.preventDefault();
        hapticService?.trigger("selection");
        handleBack();
        return;
      }
      return;
    }

    // Complete phase
    if (currentPhase === "complete") {
      // Enter to build another
      if (event.code === "Enter" || event.code === "NumpadEnter") {
        event.preventDefault();
        hapticService?.trigger("selection");
        handleFullReset();
        return;
      }
    }
  }

  // Are we selecting the start position? (first position of either phase)
  const isSelectingStartPosition = $derived(
    (currentPhase === "blue" && bluePathLength === 0) ||
      (currentPhase === "red" && redPathLength === 0)
  );

  // Can proceed to red hand? Need at least 2 positions
  const canProceedToRed = $derived(bluePathLength >= 2);

  // Can complete? Red path must match blue path length
  const canComplete = $derived(
    redPathLength >= 2 && redPathLength === bluePathLength
  );

  // Can undo? In building phases - includes undoing "Start Building" action
  const canUndoAssembly = $derived.by(() => {
    if (!hasStarted) return false;
    // In blue phase: can always undo (either positions or back to welcome)
    if (currentPhase === "blue") return true;
    // In red phase: can undo if positions selected
    if (currentPhase === "red") return redPathLength > 0;
    return false; // Can't undo in rotation-selection or complete phases
  });

  // Expose undo ref to parent for workspace-level undo button
  $effect(() => {
    undoRef = {
      canUndo: canUndoAssembly,
      undo: handleUndo,
    };
  });

  // Expose back ref to parent for workspace back button
  // Back is available when user has started building (to return to welcome screen)
  $effect(() => {
    backRef = {
      canGoBack: hasStarted,
      back: handleFullReset,
    };
  });

  // Update header text when phase changes
  $effect(() => {
    if (!hasStarted) {
      onHeaderTextChange?.("Hand Path Builder");
      return;
    }

    let text = "";
    switch (currentPhase) {
      case "blue":
        text = `Blue Hand • ${bluePathLength} position${bluePathLength !== 1 ? "s" : ""}`;
        break;
      case "red":
        text = `Red Hand • ${redPathLength}/${bluePathLength}`;
        break;
      case "rotation-selection":
        text = "Select Rotation";
        break;
      case "complete":
        text = "Sequence Complete!";
        break;
    }
    onHeaderTextChange?.(text);
  });

  // Handle starting from welcome screen
  function handleStart() {
    hasStarted = true;
    triggerGridEntranceAnimation();
  }

  // Trigger the staggered grid entrance animation
  function triggerGridEntranceAnimation() {
    showGridEntranceAnimation = true;
    // Reset after all animations complete (150ms initial + 4 positions * 100ms stagger + 500ms pop + 600ms pulse)
    setTimeout(() => {
      showGridEntranceAnimation = false;
    }, 1650);
  }

  // Handle grid mode change (from welcome screen)
  function handleGridModeChange(mode: GridMode) {
    gridMode = mode;
    assemblyState = createHandPathAssembleState({ gridMode: mode });
  }

  // Handle position selection on grid
  function handlePositionSelect(position: GridLocation) {
    try {
      // Check if this is the first position for blue hand
      const isBlueFirstPosition =
        assemblyState.blueHandPath.length === 0 &&
        assemblyState.currentPhase === "blue";

      // Check if this is the first position for red hand
      const isRedFirstPosition =
        assemblyState.redHandPath.length === 0 &&
        assemblyState.currentPhase === "red";

      assemblyState.addPosition(position);

      // If this was blue's first position, create start position with blue only
      if (isBlueFirstPosition && onStartPositionSet) {
        const startPositionPictograph = createStartPositionPictograph(
          position,
          MotionColor.BLUE,
          assemblyState.gridMode
        );
        onStartPositionSet(startPositionPictograph);
      }

      // If this was red's first position, update start position to include both hands
      if (isRedFirstPosition && onStartPositionSet) {
        const blueStartPosition = assemblyState.blueHandPath[0];
        if (blueStartPosition) {
          const startPositionPictograph = createDualHandStartPositionPictograph(
            blueStartPosition,
            position,
            assemblyState.gridMode
          );
          onStartPositionSet(startPositionPictograph);
        }
      }

      // Update workspace with current progress
      const preview = assemblyState.getCurrentHandPreview();
      if (preview.length > 0) {
        onSequenceUpdate?.(preview);
      }
    } catch (error) {
      console.error("Error adding position:", error);
    }
  }

  // Create a static start position pictograph (single hand)
  function createStartPositionPictograph(
    location: GridLocation,
    color: MotionColor,
    gridMode: GridMode
  ): PictographData {
    const motion = createMotionData({
      color,
      startLocation: location,
      endLocation: location,
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      gridMode,
      propType: PropType.HAND,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      turns: 0,
      arrowLocation: location,
      isVisible: true,
    });

    return createPictographData({
      motions: {
        [color]: motion,
      },
    });
  }

  // Create a static start position pictograph with both hands
  function createDualHandStartPositionPictograph(
    blueLocation: GridLocation,
    redLocation: GridLocation,
    gridMode: GridMode
  ): PictographData {
    const blueMotion = createMotionData({
      color: MotionColor.BLUE,
      startLocation: blueLocation,
      endLocation: blueLocation,
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      gridMode,
      propType: PropType.HAND,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      turns: 0,
      arrowLocation: blueLocation,
      isVisible: true,
    });

    const redMotion = createMotionData({
      color: MotionColor.RED,
      startLocation: redLocation,
      endLocation: redLocation,
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      gridMode,
      propType: PropType.HAND,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      turns: 0,
      arrowLocation: redLocation,
      isVisible: true,
    });

    return createPictographData({
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
    });
  }

  // Handle undo
  function handleUndo() {
    // If in blue phase with no positions, undo the "Start Building" action with animation
    if (currentPhase === "blue" && bluePathLength === 0) {
      // Trigger exit animation
      isExitingToWelcome = true;
      onSequenceUpdate?.([]);
      // Wait for animation to complete before switching view
      setTimeout(() => {
        hasStarted = false;
        isExitingToWelcome = false;
      }, 280); // Match animation duration
      return;
    }

    assemblyState.undoLastPosition();

    // Update workspace
    const preview = assemblyState.getCurrentHandPreview();
    onSequenceUpdate?.(preview);
  }

  // Handle proceeding to red hand phase
  function handleNextHand() {
    try {
      assemblyState.completeBlueHand();
      // Trigger entrance animation for red hand phase
      triggerGridEntranceAnimation();
    } catch (error) {
      console.error("Error completing blue hand:", error);
    }
  }

  // Handle proceeding to rotation selection
  function handleProceedToRotation() {
    try {
      assemblyState.completeRedHand();
    } catch (error) {
      console.error("Error completing red hand:", error);
    }
  }

  // Handle rotation selection
  function handleRotationSelect(rotation: RotationDirection) {
    try {
      assemblyState.selectRotation(rotation);

      // Get user's preferred prop types from settings
      const settings = getSettings();
      const bluePropType =
        settings.bluePropType || settings.propType || PropType.STAFF;
      const redPropType =
        settings.redPropType || settings.propType || PropType.STAFF;

      // Get final merged sequence with user's prop types applied
      const finalSequence = assemblyState.getFinalSequence(
        bluePropType,
        redPropType
      );

      // Notify parent
      onSequenceComplete?.(finalSequence);
      onSequenceUpdate?.(finalSequence);
    } catch (error) {
      console.error("Error selecting rotation:", error);
    }
  }

  // Handle going back to previous phase
  function handleBack() {
    assemblyState.goBackPhase();

    // Update workspace preview
    const preview = assemblyState.getCurrentHandPreview();
    onSequenceUpdate?.(preview);
  }

  // Handle reset (build another)
  function handleReset() {
    assemblyState.reset();
    onSequenceUpdate?.([]);
  }

  // Full reset (back to welcome screen)
  function handleFullReset() {
    assemblyState.reset();
    onSequenceUpdate?.([]);
    hasStarted = false;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="handpath-orchestrator">
  {#if !hasStarted}
    <!-- Welcome Screen -->
    <div class="welcome-wrapper">
      <AssemblyWelcome
        {gridMode}
        onStart={handleStart}
        onGridModeChange={handleGridModeChange}
      />
    </div>
  {:else}
    <!-- Building Phases -->
    <div class="build-phases" class:exiting={isExitingToWelcome}>
      <!-- Phase Header -->
      <AssemblyPhaseHeader
        phase={currentPhase}
        {bluePathLength}
        {redPathLength}
      />

      <!-- Phase Content -->
      <div class="phase-content">
        {#if currentPhase === "blue" || currentPhase === "red"}
          <!-- Grid Building Phase -->
          <div class="grid-phase">
            <div class="grid-container">
              <HandPathGrid
                gridMode={assemblyState.gridMode}
                currentPosition={assemblyState.currentPosition}
                handColor={currentPhase === "red" ? "red" : "blue"}
                {isSelectingStartPosition}
                showEntranceAnimation={showGridEntranceAnimation}
                onPositionSelect={handlePositionSelect}
              />
            </div>
          </div>
        {:else if currentPhase === "rotation-selection"}
          <!-- Rotation Selection Phase -->
          <div class="rotation-phase">
            <RotationSelector onSelect={handleRotationSelect} />
          </div>
        {:else if currentPhase === "complete"}
          <!-- Completion Phase -->
          <div class="complete-phase">
            <div class="complete-content">
              <div class="complete-icon">✓</div>
              <h2 class="complete-title">Sequence Complete!</h2>
              <p class="complete-text">
                Built a {bluePathLength - 1}-beat dual-prop sequence
              </p>
            </div>
          </div>
        {/if}
      </div>

      <!-- Controls -->
      {#if currentPhase !== "rotation-selection"}
        <AssemblyControls
          phase={currentPhase}
          {bluePathLength}
          {redPathLength}
          {canProceedToRed}
          {canComplete}
          canUndo={canUndoAssembly}
          onNextHand={handleNextHand}
          onComplete={handleProceedToRotation}
          onReset={handleFullReset}
          onUndo={handleUndo}
        />
      {/if}
    </div>
  {/if}
</div>

<style>
  .handpath-orchestrator {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: transparent;
  }

  .build-phases {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: build-phases-entrance 280ms cubic-bezier(0.33, 1, 0.68, 1) both;
  }

  @keyframes build-phases-entrance {
    from {
      opacity: 0;
      transform: scale(0.94);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Exit animation when undoing back to welcome */
  .build-phases.exiting {
    animation: build-phases-exit 280ms cubic-bezier(0.33, 1, 0.68, 1) both;
  }

  @keyframes build-phases-exit {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.94);
    }
  }

  /* Welcome wrapper with entrance animation */
  .welcome-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: welcome-entrance 280ms cubic-bezier(0.33, 1, 0.68, 1) both;
  }

  @keyframes welcome-entrance {
    from {
      opacity: 0;
      transform: scale(0.94);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .build-phases,
    .build-phases.exiting,
    .welcome-wrapper {
      animation: none;
    }
  }

  .phase-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  /* Grid Building Phase */
  .grid-phase {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .grid-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    min-height: 0;
  }

  /* Rotation Phase */
  .rotation-phase {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
    padding: 16px;
  }

  /* Complete Phase */
  .complete-phase {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .complete-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
  }

  .complete-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--semantic-success), #059669);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-3xl);
    color: white;
    box-shadow: 0 8px 32px rgba(16, 185, 129, 0.3);
  }

  .complete-title {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    color: var(--theme-text);
    margin: 0;
  }

  .complete-text {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin: 0;
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .grid-container {
      padding: 12px;
    }

    .complete-icon {
      width: 64px;
      height: 64px;
      font-size: var(--font-size-3xl);
    }

    .complete-title {
      font-size: var(--font-size-2xl);
    }
  }
</style>
