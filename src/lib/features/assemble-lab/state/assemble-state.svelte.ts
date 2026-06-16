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
  HALF_PI,
  LOCATION_ANGLES,
  PI,
  TWO_PI,
} from "$lib/shared/foundation/domain/math-constants";

export type BuilderPhase = "idle" | "placing" | "building" | "animating" | "complete";

export interface BuilderStep {
  readonly startPosition: GridLocation;
  readonly endPosition: GridLocation;
  readonly rotationDirection: RotationDirection;
  readonly turnCount: number;
  readonly startOrientation: Orientation;
  readonly endOrientation: Orientation;
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
  readonly isBlueComplete: boolean;
  readonly canUndo: boolean;
  readonly canFinishHand: boolean;
  readonly showCenter: boolean;
  readonly canChangeGridMode: boolean;
  readonly keyboardMode: boolean;

  handlePointClick(location: GridLocation): void;
  finishHand(): void;
  undoStep(): Promise<void>;
  truncateAtStep(stepIndex: number): void;
  reset(): void;
  setRotationDirection(dir: RotationDirection): void;
  setTurnCount(turns: number): void;
  setOrientation(ori: Orientation): void;
  setGridMode(mode: GridMode): void;
  setShowCenter(show: boolean): void;
  switchToHand(hand: MotionColor): void;
  toggleKeyboardMode(): void;
  setAnimationCallback(cb: (step: BuilderStep, durationMs?: number) => Promise<void>): void;
  setUndoAnimationCallback(cb: (step: BuilderStep, wasPlacement: boolean) => Promise<void>): void;
}

export function createAssembleState(): AssembleState {
  // Phase & hand
  let phase = $state<BuilderPhase>("idle");
  let activeHand = $state<MotionColor>(MotionColor.BLUE);
  let gridMode = $state<GridMode>(GridMode.DIAMOND);
  let showCenter = $state<boolean>(false);
  let keyboardMode = $state<boolean>(false);

  // Per-hand completed steps
  let blueSteps = $state<BuilderStep[]>([]);
  let redSteps = $state<BuilderStep[]>([]);

  // Current position of the active hand's prop (where it sits right now)
  let currentPosition = $state<GridLocation | null>(null);
  let currentOrientation = $state<Orientation>(Orientation.IN);

  // Controls (set BEFORE clicking the next point)
  let rotationDirection = $state<RotationDirection>(RotationDirection.CLOCKWISE);
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
  const activeSteps = $derived(activeHand === MotionColor.BLUE ? blueSteps : redSteps);
  const stepCount = $derived(blueSteps.length + redSteps.length);
  const isBlueComplete = $derived(
    phase === "complete" || activeHand === MotionColor.RED
  );
  const canUndo = $derived(
    phase === "building" && activeSteps.length > 0
    || phase === "placing"
  );
  const canFinishHand = $derived(
    (phase === "building" || phase === "animating") &&
    blueSteps.length > 0 &&
    redSteps.length > 0 &&
    blueSteps.length === redSteps.length
  );
  const canChangeGridMode = $derived(blueSteps.length === 0 && redSteps.length === 0);

  /** First click - place prop at a grid point */
  function placeFirstPoint(location: GridLocation): void {
    currentPosition = location;
    // Center uses compass orientations, perimeter uses radial orientations
    currentOrientation = location === GridLocation.CENTER
      ? Orientation.CENTER_N
      : Orientation.IN;
    phase = "placing";
  }

  // Action queued during animation - executed when animation completes
  let pendingAction: (() => void) | null = null;

  /** Subsequent clicks - create a motion from currentPosition to the clicked point */
  async function addMotion(endLocation: GridLocation): Promise<void> {
    if (currentPosition === null) return;

    // Float (-0.5 turns) only applies to shifts. For dashes/statics there's
    // no arc to cancel, so fall back to 0 turns.
    const isSamePoint = currentPosition === endLocation;
    const isDash = !isSamePoint && isOpposite(currentPosition, endLocation);
    const effectiveTurns = (turnCount < 0 && (isSamePoint || isDash)) ? 0 : turnCount;

    // Calculate end orientation accounting for arc-based staff rotation
    const endOri = calculateEndOrientation(
      currentOrientation, currentPosition, endLocation,
      rotationDirection, effectiveTurns,
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
    phase = blueSteps.length > 0 || redSteps.length > 0 ? "building" : "placing";
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
  }

  function setGridMode(mode: GridMode): void {
    if (blueSteps.length > 0 || redSteps.length > 0) return;
    if (currentPosition !== null && !isLocationValidForMode(currentPosition, mode, showCenter)) {
      currentPosition = null;
      phase = "idle";
    }
    gridMode = mode;
  }

  function setShowCenter(show: boolean): void {
    if (blueSteps.length > 0 || redSteps.length > 0) return;
    if (!show && currentPosition === GridLocation.CENTER) {
      currentPosition = null;
      phase = "idle";
    }
    showCenter = show;
  }

  function toggleKeyboardMode(): void {
    keyboardMode = !keyboardMode;
  }

  /** Switch to a specific hand, restoring that hand's last position */
  function switchToHand(hand: MotionColor): void {
    if (hand === activeHand) return;
    if (phase === "complete") return;

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
  }

  function setAnimationCallback(cb: (step: BuilderStep, durationMs?: number) => Promise<void>): void {
    onAnimationRequest = cb;
  }

  function setUndoAnimationCallback(cb: (step: BuilderStep, wasPlacement: boolean) => Promise<void>): void {
    onUndoAnimationRequest = cb;
  }

  return {
    // Readable state
    get phase() { return phase; },
    get activeHand() { return activeHand; },
    get gridMode() { return gridMode; },
    get blueSteps() { return blueSteps; },
    get redSteps() { return redSteps; },
    get currentPosition() { return currentPosition; },
    get currentOrientation() { return currentOrientation; },
    get rotationDirection() { return rotationDirection; },
    get turnCount() { return turnCount; },
    get showOrientationArrow() { return showOrientationArrow; },
    get arrowOrientation() { return arrowOrientation; },
    get activeSteps() { return activeSteps; },
    get stepCount() { return stepCount; },
    get isBlueComplete() { return isBlueComplete; },
    get canUndo() { return canUndo; },
    get canFinishHand() { return canFinishHand; },
    get showCenter() { return showCenter; },
    get canChangeGridMode() { return canChangeGridMode; },
    get keyboardMode() { return keyboardMode; },

    // Actions
    handlePointClick,
    finishHand,
    undoStep,
    truncateAtStep,
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
// --- Arc math helpers (mirror SvgPropAnimator's math) ---

/** Normalize angle to [0, 2*PI) */
function normPos(angle: number): number {
  const n = angle % TWO_PI;
  return n < 0 ? n + TWO_PI : n;
}

/** Normalize angle to (-PI, PI] - shortest signed delta */
function normSigned(angle: number): number {
  const n = normPos(angle);
  return n > PI ? n - TWO_PI : n;
}

/** Map orientation to staff angle given a center path angle */
function oriToStaffAngle(ori: Orientation, centerAngle: number): number {
  switch (ori) {
    case Orientation.IN: return normPos(centerAngle + PI);
    case Orientation.OUT: return normPos(centerAngle);
    case Orientation.CLOCK: return normPos(centerAngle + HALF_PI);
    case Orientation.COUNTER: return normPos(centerAngle - HALF_PI);
    default: return normPos(centerAngle + PI);
  }
}

/** Convert final staff angle back to an Orientation given the end center angle */
function staffAngleToOrientation(staffAngle: number, centerAngle: number): Orientation {
  const delta = normSigned(staffAngle - centerAngle);
  const absDelta = Math.abs(delta);

  // Snap to nearest cardinal orientation
  // OUT ≈ 0, CLOCK ≈ +HALF_PI, IN ≈ ±PI, COUNTER ≈ -HALF_PI
  if (absDelta < PI / 4) return Orientation.OUT;
  if (absDelta > 3 * PI / 4) return Orientation.IN;
  if (delta > 0) return Orientation.CLOCK;
  return Orientation.COUNTER;
}

/** Check if two grid locations are diametrically opposite (dash) */
function isOpposite(a: GridLocation, b: GridLocation): boolean {
  // Center is never opposite to anything - center motions are hash-in/hash-out
  if (a === GridLocation.CENTER || b === GridLocation.CENTER) return false;
  const angleA = LOCATION_ANGLES[a];
  const angleB = LOCATION_ANGLES[b];
  const delta = Math.abs(normSigned(angleB - angleA));
  return Math.abs(delta - PI) < 0.01;
}

// ─── Hash orientation translation ─────────────────────────────────────────────
// When hashing between perimeter and center, the prop's absolute direction
// stays the same - we translate between radial (in/out/clock/counter) and
// compass (centerN/centerE/etc.) orientation systems.
//
// Map: [perimeterLocation][radialOrientation] → centerOrientation
// Built from the DIAMOND_PROP_ANGLES/BOX_PROP_ANGLES: the SVG angle at each
// (location, orientation) pair maps to the center orientation with that same angle.

const RADIAL_TO_CENTER: Record<string, Record<string, Orientation>> = {
  // Diamond (cardinal) locations
  [GridLocation.NORTH]:  { in: Orientation.CENTER_S,  out: Orientation.CENTER_N,  clock: Orientation.CENTER_E,  counter: Orientation.CENTER_W },
  [GridLocation.SOUTH]:  { in: Orientation.CENTER_N,  out: Orientation.CENTER_S,  clock: Orientation.CENTER_W,  counter: Orientation.CENTER_E },
  [GridLocation.EAST]:   { in: Orientation.CENTER_W,  out: Orientation.CENTER_E,  clock: Orientation.CENTER_S,  counter: Orientation.CENTER_N },
  [GridLocation.WEST]:   { in: Orientation.CENTER_E,  out: Orientation.CENTER_W,  clock: Orientation.CENTER_N,  counter: Orientation.CENTER_S },
  // Box (intercardinal) locations
  [GridLocation.NORTHEAST]: { in: Orientation.CENTER_SW, out: Orientation.CENTER_NE, clock: Orientation.CENTER_SE, counter: Orientation.CENTER_NW },
  [GridLocation.SOUTHEAST]: { in: Orientation.CENTER_NW, out: Orientation.CENTER_SE, clock: Orientation.CENTER_SW, counter: Orientation.CENTER_NE },
  [GridLocation.SOUTHWEST]: { in: Orientation.CENTER_NE, out: Orientation.CENTER_SW, clock: Orientation.CENTER_NW, counter: Orientation.CENTER_SE },
  [GridLocation.NORTHWEST]: { in: Orientation.CENTER_SE, out: Orientation.CENTER_NW, clock: Orientation.CENTER_NE, counter: Orientation.CENTER_SW },
};

// Reverse map: [perimeterLocation][centerOrientation] → radialOrientation
const CENTER_TO_RADIAL: Record<string, Record<string, Orientation>> = {};
for (const [loc, oriMap] of Object.entries(RADIAL_TO_CENTER)) {
  CENTER_TO_RADIAL[loc] = {};
  for (const [radial, center] of Object.entries(oriMap)) {
    CENTER_TO_RADIAL[loc]![center] = radial as Orientation;
  }
}

/**
 * Calculate end orientation accounting for arc-based staff rotation.
 *
 * For shifts, the arc itself rotates the staff - pro shifts preserve orientation,
 * anti shifts reverse it (even at 0 turns). For dashes and statics, only turn
 * count matters. This mirrors the exact math in SvgPropAnimator.
 *
 * For hash motions (perimeter ↔ center), translates between radial and compass
 * orientation systems. The prop's absolute direction is preserved, then turns
 * are applied using the dash rule (even=switch, odd=same).
 */
function calculateEndOrientation(
  startOrientation: Orientation,
  startLocation: GridLocation,
  endLocation: GridLocation,
  rotationDirection: RotationDirection,
  turnCount: number,
): Orientation {
  const isHashIn = startLocation !== GridLocation.CENTER && endLocation === GridLocation.CENTER;
  const isHashOut = startLocation === GridLocation.CENTER && endLocation !== GridLocation.CENTER;

  if (isHashIn) {
    // Perimeter → center: translate radial orientation to center orientation
    const perimeterLoc = startLocation as string;
    const radialOri = startOrientation as string;
    let centerOri = RADIAL_TO_CENTER[perimeterLoc]?.[radialOri] ?? ("centerN" as Orientation);

    // Apply dash-rule turns: even=switch, odd=same (hash uses dash rotation rules)
    const wholeTurns = Math.floor(turnCount);
    if (wholeTurns % 2 !== 0) {
      // Switch = opposite compass direction (e.g. centerN → centerS)
      const switchMap: Record<string, Orientation> = {
        [Orientation.CENTER_N]: Orientation.CENTER_S, [Orientation.CENTER_S]: Orientation.CENTER_N,
        [Orientation.CENTER_E]: Orientation.CENTER_W, [Orientation.CENTER_W]: Orientation.CENTER_E,
        [Orientation.CENTER_NE]: Orientation.CENTER_SW, [Orientation.CENTER_SW]: Orientation.CENTER_NE,
        [Orientation.CENTER_SE]: Orientation.CENTER_NW, [Orientation.CENTER_NW]: Orientation.CENTER_SE,
      };
      centerOri = switchMap[centerOri] ?? centerOri;
    }
    return centerOri;
  }

  if (isHashOut) {
    // Center → perimeter: translate center orientation to radial orientation
    const perimeterLoc = endLocation as string;
    const centerOri = startOrientation as string;
    let radialOri = CENTER_TO_RADIAL[perimeterLoc]?.[centerOri] ?? Orientation.IN;

    // Apply dash-rule turns: even=switch, odd=same
    const wholeTurns = Math.floor(turnCount);
    if (wholeTurns % 2 !== 0) {
      // Switch radial orientation (in↔out, clock↔counter)
      const switchMap: Record<string, Orientation> = {
        [Orientation.IN]: Orientation.OUT, [Orientation.OUT]: Orientation.IN,
        [Orientation.CLOCK]: Orientation.COUNTER, [Orientation.COUNTER]: Orientation.CLOCK,
      };
      radialOri = switchMap[radialOri] ?? radialOri;
    }
    return radialOri;
  }

  // Standard perimeter-to-perimeter calculation
  const startCenterAngle = LOCATION_ANGLES[startLocation];
  const endCenterAngle = LOCATION_ANGLES[endLocation];
  const startStaffAngle = oriToStaffAngle(startOrientation, startCenterAngle);

  const isSamePoint = startLocation === endLocation;
  const isDash = !isSamePoint && isOpposite(startLocation, endLocation);

  const centerMovement = normSigned(endCenterAngle - startCenterAngle);
  const dirSign = rotationDirection === RotationDirection.COUNTER_CLOCKWISE ? -1 : 1;
  const turnRotation = dirSign * turnCount * PI;

  let staffRotationDelta: number;
  if (isSamePoint || isDash) {
    staffRotationDelta = turnRotation;
  } else {
    // Shift: arc component + turn rotation
    const arcDir = centerMovement > 0 ? 1 : -1;
    const userDir = dirSign;
    const isPro = (arcDir === userDir) || (Math.abs(centerMovement) < 0.01);
    const staffArcComponent = isPro ? centerMovement : -centerMovement;
    staffRotationDelta = staffArcComponent + turnRotation;
  }

  const endStaffAngle = normPos(startStaffAngle + staffRotationDelta);
  return staffAngleToOrientation(endStaffAngle, endCenterAngle);
}

function isLocationValidForMode(location: GridLocation, mode: GridMode, centerEnabled: boolean): boolean {
  if (location === GridLocation.CENTER) return centerEnabled;
  const CARDINAL: GridLocation[] = [GridLocation.NORTH, GridLocation.EAST, GridLocation.SOUTH, GridLocation.WEST];
  const INTERCARDINAL: GridLocation[] = [GridLocation.NORTHEAST, GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, GridLocation.NORTHWEST];
  switch (mode) {
    case GridMode.DIAMOND: return CARDINAL.includes(location);
    case GridMode.BOX: return INTERCARDINAL.includes(location);
    case GridMode.SKEWED: return CARDINAL.includes(location) || INTERCARDINAL.includes(location);
    default: return true;
  }
}
