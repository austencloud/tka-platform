/**
 * Assemble State - Free-Form Dual-Hand Model
 *
 * Build both hands' paths in any order using the hand switcher.
 * Each click after the first creates a motion (the prop animates to the clicked point).
 * Complete when both hands have equal step counts.
 *
 * Terminology: "step" = one motion (start→end position). "beat" is NOT used.
 */

import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  calculateBuilderEndOrientation,
  deriveBuilderMotionGeometry,
} from "../services/builder-motion-geometry";

export type BuilderPhase =
  | "idle"
  | "placing"
  | "building"
  | "animating"
  | "complete";

export interface BuilderStep {
  readonly startPosition: GridLocation;
  readonly endPosition: GridLocation;
  readonly rotationDirection: RotationDirection;
  readonly turnCount: number;
  readonly startOrientation: Orientation;
  readonly endOrientation: Orientation;
}

export interface AssembleStateHydration {
  readonly blueSteps: readonly BuilderStep[];
  readonly redSteps: readonly BuilderStep[];
  readonly gridMode: GridMode;
  readonly startPoses: Partial<
    Record<
      MotionColor,
      { readonly location: GridLocation; readonly orientation: Orientation }
    >
  >;
}

export interface AssembleStateOptions {
  onDocumentChange?: () => void;
}

/**
 * Public shape of the assemble builder state. Declared explicitly (rather than
 * inferred via ReturnType) so the API surface consumed by components is stable
 * under refactors.
 */
export interface AssembleState {
  readonly phase: BuilderPhase;
  readonly activeHand: MotionColor;
  readonly gridMode: GridMode;
  readonly blueSteps: BuilderStep[];
  readonly redSteps: BuilderStep[];
  readonly currentPosition: GridLocation | null;
  readonly currentOrientation: Orientation;
  readonly rotationDirection: RotationDirection;
  readonly turnCount: number;
  readonly showOrientationArrow: boolean;
  readonly arrowOrientation: Orientation;
  readonly activeSteps: BuilderStep[];
  readonly stepCount: number;
  readonly canUndo: boolean;
  readonly canFinishHand: boolean;
  readonly showCenter: boolean;
  readonly canChangeGridMode: boolean;
  readonly keyboardMode: boolean;

  handlePointClick(location: GridLocation): void;
  finishHand(): void;
  undoStep(): Promise<void>;
  truncateAtStep(stepIndex: number): void;
  hydrateFromSequence(snapshot: AssembleStateHydration): void;
  reset(): void;
  setRotationDirection(dir: RotationDirection): void;
  setTurnCount(turns: number): void;
  setOrientation(ori: Orientation): void;
  setGridMode(mode: GridMode): void;
  setShowCenter(show: boolean): void;
  switchToHand(hand: MotionColor): void;
  toggleKeyboardMode(): void;
  setAnimationCallback(
    cb: (step: BuilderStep, durationMs?: number) => Promise<void>
  ): void;
  setUndoAnimationCallback(
    cb: (step: BuilderStep, wasPlacement: boolean) => Promise<void>
  ): void;
}

export function createAssembleState(
  options: AssembleStateOptions = {}
): AssembleState {
  // Phase & hand
  let phase = $state<BuilderPhase>("idle");
  let activeHand = $state<MotionColor>(MotionColor.BLUE);
  let gridMode = $state<GridMode>(GridMode.DIAMOND);
  let showCenter = $state<boolean>(false);
  let keyboardMode = $state<boolean>(false);

  function notifyDocumentChange(): void {
    options.onDocumentChange?.();
  }

  // Per-hand completed steps
  let blueSteps = $state<BuilderStep[]>([]);
  let redSteps = $state<BuilderStep[]>([]);

  // Current position of the active hand's prop (where it sits right now)
  let currentPosition = $state<GridLocation | null>(null);
  let currentOrientation = $state<Orientation>(Orientation.IN);

  // Controls (set BEFORE clicking the next point)
  let rotationDirection = $state<RotationDirection>(
    RotationDirection.CLOCKWISE
  );
  let turnCount = $state<number>(0);

  // Animation callback - set by the component to trigger SvgPropAnimator
  let onAnimationRequest = $state<
    ((step: BuilderStep, durationMs?: number) => Promise<void>) | null
  >(null);

  // Undo animation callback - plays the reverse animation before state is modified
  let onUndoAnimationRequest = $state<
    ((step: BuilderStep, wasPlacement: boolean) => Promise<void>) | null
  >(null);

  // Derived
  const activeSteps = $derived(
    activeHand === MotionColor.BLUE ? blueSteps : redSteps
  );
  const stepCount = $derived(blueSteps.length + redSteps.length);
  const canUndo = $derived(
    (phase === "building" && activeSteps.length > 0) || phase === "placing"
  );
  const canFinishHand = $derived(
    (phase === "building" || phase === "animating") &&
      blueSteps.length > 0 &&
      redSteps.length > 0 &&
      blueSteps.length === redSteps.length
  );
  const canChangeGridMode = $derived(
    blueSteps.length === 0 && redSteps.length === 0
  );

  /** First click - place prop at a grid point */
  function placeFirstPoint(location: GridLocation): void {
    currentPosition = location;
    // Center uses compass orientations, perimeter uses radial orientations
    currentOrientation =
      location === GridLocation.CENTER ? Orientation.CENTER_N : Orientation.IN;
    phase = "placing";
    notifyDocumentChange();
  }

  // Action queued during animation - executed when animation completes
  let pendingAction: (() => void) | null = null;

  /** Subsequent clicks - create a motion from currentPosition to the clicked point */
  async function addMotion(endLocation: GridLocation): Promise<void> {
    if (currentPosition === null) return;

    // Float (-0.5 turns) only applies to shifts. For dashes/statics there's
    // no arc to cancel, so fall back to 0 turns.
    const geometry = deriveBuilderMotionGeometry(
      currentPosition,
      endLocation,
      currentOrientation,
      rotationDirection,
      turnCount
    );
    const effectiveTurns =
      turnCount < 0 && (geometry.isSamePoint || geometry.isStraightPath)
        ? 0
        : turnCount;

    // Calculate end orientation accounting for arc-based staff rotation
    const endOri = calculateBuilderEndOrientation(
      currentOrientation,
      currentPosition,
      endLocation,
      rotationDirection,
      effectiveTurns
    );

    const step: BuilderStep = {
      startPosition: currentPosition,
      endPosition: endLocation,
      rotationDirection,
      turnCount: effectiveTurns,
      startOrientation: currentOrientation,
      endOrientation: endOri,
    };

    // Start animation (non-blocking) and add step to state simultaneously
    // so the workspace pictograph scales in while the prop is still moving
    phase = "animating";
    const animationPromise = onAnimationRequest
      ? onAnimationRequest(step)
      : Promise.resolve();

    // Add step immediately - workspace reacts in parallel with prop animation
    if (activeHand === MotionColor.BLUE) {
      blueSteps = [...blueSteps, step];
    } else {
      redSteps = [...redSteps, step];
    }

    // Advance position immediately so rapid interactions feel responsive
    currentPosition = endLocation;
    currentOrientation = endOri;
    notifyDocumentChange();

    // Wait for animation to finish before leaving animating phase
    await animationPromise;
    phase = "building";

    // Execute any action queued during animation (e.g. finishHand)
    if (pendingAction) {
      const action = pendingAction;
      pendingAction = null;
      action();
    }
  }

  /** Main click handler - routes to placeFirstPoint or addMotion */
  function handlePointClick(location: GridLocation): void {
    if (phase === "animating") return; // ignore during animation

    if (phase === "idle" || phase === "placing") {
      if (currentPosition === null) {
        placeFirstPoint(location);
      } else {
        addMotion(location);
      }
      return;
    }

    if (phase === "building") {
      addMotion(location);
      return;
    }
  }

  /** Mark the sequence as complete (both hands must have steps) */
  function finishHand(): void {
    if (!canFinishHand) return;

    // If animating, queue it to run after animation completes
    if (phase === "animating") {
      pendingAction = finishHand;
      return;
    }

    phase = "complete";
  }

  /** Undo last step from active hand, with optional reverse animation */
  async function undoStep(): Promise<void> {
    if (phase === "animating") return; // block during animation

    if (phase === "placing" && currentPosition !== null) {
      // Undo the initial placement - animate scale-out then remove
      phase = "animating";
      if (onUndoAnimationRequest) {
        // Create a dummy step representing the placement (start = end = current)
        const placementStep: BuilderStep = {
          startPosition: currentPosition,
          endPosition: currentPosition,
          rotationDirection: RotationDirection.CLOCKWISE,
          turnCount: 0,
          startOrientation: currentOrientation,
          endOrientation: currentOrientation,
        };
        await onUndoAnimationRequest(placementStep, true);
      }
      currentPosition = null;
      phase = "idle";
      notifyDocumentChange();
      return;
    }

    const steps = activeHand === MotionColor.BLUE ? blueSteps : redSteps;
    if (steps.length === 0) return;

    const lastStep = steps[steps.length - 1]!;

    // Play reverse animation before modifying state
    phase = "animating";
    if (onUndoAnimationRequest) {
      await onUndoAnimationRequest(lastStep, false);
    }

    if (activeHand === MotionColor.BLUE) {
      blueSteps = blueSteps.slice(0, -1);
    } else {
      redSteps = redSteps.slice(0, -1);
    }

    // Restore position to the start of the removed step
    currentPosition = lastStep.startPosition;
    currentOrientation = lastStep.startOrientation;
    phase =
      blueSteps.length > 0 || redSteps.length > 0 ? "building" : "placing";
    notifyDocumentChange();
  }

  /**
   * Truncate both hands' steps at the given index (removes step at index and all after).
   * Used when the user deletes a pictograph from the workspace grid.
   * Since each pictograph maps to one index in both blueSteps and redSteps,
   * we truncate both arrays to that index.
   */
  function truncateAtStep(stepIndex: number): void {
    if (stepIndex <= 0) {
      // Removing the first step clears everything
      reset();
      return;
    }

    blueSteps = blueSteps.slice(0, stepIndex);
    redSteps = redSteps.slice(0, stepIndex);

    // Restore current position from the last remaining step of the active hand
    const activeArr = activeHand === MotionColor.BLUE ? blueSteps : redSteps;
    if (activeArr.length > 0) {
      const last = activeArr[activeArr.length - 1]!;
      currentPosition = last.endPosition;
      currentOrientation = last.endOrientation;
      phase = "building";
    } else {
      currentPosition = null;
      currentOrientation = Orientation.IN;
      phase = "idle";
    }
    notifyDocumentChange();
  }

  /** Restore an editable builder session from the sequence document. */
  function hydrateFromSequence(snapshot: AssembleStateHydration): void {
    blueSteps = [...snapshot.blueSteps];
    redSteps = [...snapshot.redSteps];
    gridMode = snapshot.gridMode;
    showCenter =
      [...blueSteps, ...redSteps].some(
        (step) =>
          step.startPosition === GridLocation.CENTER ||
          step.endPosition === GridLocation.CENTER
      ) ||
      Object.values(snapshot.startPoses).some(
        (pose) => pose?.location === GridLocation.CENTER
      );

    if (blueSteps.length > redSteps.length) {
      activeHand = MotionColor.RED;
    } else if (redSteps.length > blueSteps.length) {
      activeHand = MotionColor.BLUE;
    } else if (
      blueSteps.length === 0 &&
      snapshot.startPoses[MotionColor.RED] &&
      !snapshot.startPoses[MotionColor.BLUE]
    ) {
      activeHand = MotionColor.RED;
    } else {
      activeHand = MotionColor.BLUE;
    }

    const active = activeHand === MotionColor.BLUE ? blueSteps : redSteps;
    const last = active[active.length - 1];
    if (last) {
      currentPosition = last.endPosition;
      currentOrientation = last.endOrientation;
      phase = "building";
      return;
    }

    const startPose = snapshot.startPoses[activeHand];
    if (startPose) {
      currentPosition = startPose.location;
      currentOrientation = startPose.orientation;
      phase = "placing";
      return;
    }

    currentPosition = null;
    currentOrientation = Orientation.IN;
    phase = "idle";
  }

  /** Full reset */
  function reset(): void {
    phase = "idle";
    activeHand = MotionColor.BLUE;
    blueSteps = [];
    redSteps = [];
    currentPosition = null;
    currentOrientation = Orientation.IN;
    rotationDirection = RotationDirection.CLOCKWISE;
    turnCount = 0;
    gridMode = GridMode.DIAMOND;
    showCenter = false;
    notifyDocumentChange();
  }

  function setRotationDirection(dir: RotationDirection): void {
    rotationDirection = dir;
  }

  function setTurnCount(turns: number): void {
    turnCount = turns;
  }

  // Transient orientation indicator state
  let showOrientationArrow = $state(false);
  let arrowOrientation = $state<Orientation>(Orientation.IN);
  let arrowTimeout: ReturnType<typeof setTimeout> | null = null;

  function setOrientation(ori: Orientation): void {
    // When at center, translate radial orientations to center orientations.
    // The UI shows in/out/clock/counter but center needs centerN/centerE/etc.
    // Use NORTH as the reference: in→centerS, out→centerN, clock→centerE, counter→centerW
    if (currentPosition === GridLocation.CENTER) {
      const radialToCenterAtNorth: Record<string, Orientation> = {
        [Orientation.IN]: Orientation.CENTER_S,
        [Orientation.OUT]: Orientation.CENTER_N,
        [Orientation.CLOCK]: Orientation.CENTER_E,
        [Orientation.COUNTER]: Orientation.CENTER_W,
      };
      const translated = radialToCenterAtNorth[ori];
      if (translated) {
        ori = translated;
      }
    }
    currentOrientation = ori;

    // Show directional arrow only when prop is placed
    if (currentPosition !== null) {
      arrowOrientation = ori;
      showOrientationArrow = true;
      if (arrowTimeout) clearTimeout(arrowTimeout);
      arrowTimeout = setTimeout(() => {
        showOrientationArrow = false;
        arrowTimeout = null;
      }, 1000);
    }
    if (phase === "placing") notifyDocumentChange();
  }

  function setGridMode(mode: GridMode): void {
    if (mode === gridMode) return;
    if (blueSteps.length > 0 || redSteps.length > 0) return;
    if (
      currentPosition !== null &&
      !isLocationValidForMode(currentPosition, mode, showCenter)
    ) {
      currentPosition = null;
      phase = "idle";
    }
    gridMode = mode;
    notifyDocumentChange();
  }

  function setShowCenter(show: boolean): void {
    if (show === showCenter) return;
    if (blueSteps.length > 0 || redSteps.length > 0) return;
    if (!show && currentPosition === GridLocation.CENTER) {
      currentPosition = null;
      phase = "idle";
    }
    showCenter = show;
    notifyDocumentChange();
  }

  function toggleKeyboardMode(): void {
    keyboardMode = !keyboardMode;
  }

  /** Switch to a specific hand, restoring that hand's last position */
  function switchToHand(hand: MotionColor): void {
    if (hand === activeHand) return;
    if (phase === "animating" || phase === "complete") return;

    activeHand = hand;
    const steps = hand === MotionColor.BLUE ? blueSteps : redSteps;
    if (steps.length > 0) {
      const last = steps[steps.length - 1]!;
      currentPosition = last.endPosition;
      currentOrientation = last.endOrientation;
      phase = "building";
    } else {
      currentPosition = null;
      currentOrientation = Orientation.IN;
      phase = "idle";
    }
    notifyDocumentChange();
  }

  function setAnimationCallback(
    cb: (step: BuilderStep, durationMs?: number) => Promise<void>
  ): void {
    onAnimationRequest = cb;
  }

  function setUndoAnimationCallback(
    cb: (step: BuilderStep, wasPlacement: boolean) => Promise<void>
  ): void {
    onUndoAnimationRequest = cb;
  }

  return {
    // Readable state
    get phase() {
      return phase;
    },
    get activeHand() {
      return activeHand;
    },
    get gridMode() {
      return gridMode;
    },
    get blueSteps() {
      return blueSteps;
    },
    get redSteps() {
      return redSteps;
    },
    get currentPosition() {
      return currentPosition;
    },
    get currentOrientation() {
      return currentOrientation;
    },
    get rotationDirection() {
      return rotationDirection;
    },
    get turnCount() {
      return turnCount;
    },
    get showOrientationArrow() {
      return showOrientationArrow;
    },
    get arrowOrientation() {
      return arrowOrientation;
    },
    get activeSteps() {
      return activeSteps;
    },
    get stepCount() {
      return stepCount;
    },
    get canUndo() {
      return canUndo;
    },
    get canFinishHand() {
      return canFinishHand;
    },
    get showCenter() {
      return showCenter;
    },
    get canChangeGridMode() {
      return canChangeGridMode;
    },
    get keyboardMode() {
      return keyboardMode;
    },

    // Actions
    handlePointClick,
    finishHand,
    undoStep,
    truncateAtStep,
    hydrateFromSequence,
    reset,
    setRotationDirection,
    setTurnCount,
    setOrientation,
    setGridMode,
    setShowCenter,
    switchToHand,
    toggleKeyboardMode,
    setAnimationCallback,
    setUndoAnimationCallback,
  };
}
function isLocationValidForMode(
  location: GridLocation,
  mode: GridMode,
  centerEnabled: boolean
): boolean {
  if (location === GridLocation.CENTER) return centerEnabled;
  const CARDINAL: GridLocation[] = [
    GridLocation.NORTH,
    GridLocation.EAST,
    GridLocation.SOUTH,
    GridLocation.WEST,
  ];
  const INTERCARDINAL: GridLocation[] = [
    GridLocation.NORTHEAST,
    GridLocation.SOUTHEAST,
    GridLocation.SOUTHWEST,
    GridLocation.NORTHWEST,
  ];
  switch (mode) {
    case GridMode.DIAMOND:
      return CARDINAL.includes(location);
    case GridMode.BOX:
      return INTERCARDINAL.includes(location);
    case GridMode.SKEWED:
      return CARDINAL.includes(location) || INTERCARDINAL.includes(location);
    default:
      return true;
  }
}
