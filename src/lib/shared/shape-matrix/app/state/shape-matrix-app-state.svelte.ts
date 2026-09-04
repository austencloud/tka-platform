import { applyFilter } from "$lib/shared/shape-matrix/domain/filter-flower-axis";
import {
  matrixFiltersForTurns,
  clampMatrixTurnToLevel,
  matrixTurnsForLevel,
  type MatrixLabelMode,
} from "$lib/shared/shape-matrix/domain/matrix-turn-band";
import {
  flowerPetals,
  type Flower,
  type FlowerStyle,
  type RotatingFlowerOri,
} from "$lib/shared/shape-matrix/domain/flower-signature";
import type {
  TurnLevel,
  TurnValue,
} from "$lib/shared/create/services/level-turn-values";
import type { ShapeMatrixData } from "$lib/shared/shape-matrix/services/shape-matrix-flowers";
import {
  MODE_ORDER,
  type VtgMode,
} from "$lib/shared/shape-matrix/services/shape-matrix-realizations";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { requestShapeMatrixTransition } from "$lib/shared/shape-matrix/debug/shape-matrix-transition-recorder";
import { spinRatioEquals, type SpinRatio } from "@vtg/domain";
import {
  buildTheoryAxis,
  type TheoryFlower,
} from "$lib/shared/shape-matrix/domain/theory-flower";
import {
  DEFAULT_THEORY_RATIO,
  theoryRatioFromParts,
} from "$lib/shared/shape-matrix/domain/theory-ratio";

export type ShapeMatrixAppView = "matrix" | "detail";
export type ShapeMatrixSurface = "matrix" | "theory";
export interface ShapeMatrixCompactFocusRequest {
  id: number;
  target: ShapeMatrixAppView;
}
export type ShapeMatrixAxisTarget = "left" | "both" | "right";

export interface ShapeMatrixSelectPairOptions {
  /**
   * False records the selection without moving a compact layout to the
   * detail pane. The host then navigates itself (through the shared-element
   * morph), which needs the clicked tile to be the selection BEFORE the
   * view flips so the morph starts from that tile.
   */
  navigate?: boolean;
}

export interface ShapeMatrixSetTurnOptions {
  /**
   * Keep the compact layout on the detail pane after a turn or level edit.
   * The matrix ribbon returns to the matrix (existing navigation); the detail
   * pane's own popover stays put so the animator restages under the user's
   * eyes.
   */
  stayOnDetail?: boolean;
}

export interface ShapeMatrixAppSnapshot {
  surface: ShapeMatrixSurface;
  /** Theory rows: the blue hand's prop-to-hand ratio. */
  theoryLeftRatio: SpinRatio;
  /** Theory columns: the red hand's prop-to-hand ratio. */
  theoryRightRatio: SpinRatio;
  /**
   * The timing-and-direction pairing on the Theory surface, named by the same
   * six VTG modes (and the same six elements) a Matrix realization carries.
   */
  theoryMode: VtgMode;
  theoryPair: { left: TheoryFlower; right: TheoryFlower } | null;
  level: TurnLevel;
  leftTurn: TurnValue;
  rightTurn: TurnValue;
  activeAxis: ShapeMatrixAxisTarget;
  labelMode: MatrixLabelMode;
  propType: PropType;
  pair: { left: Flower; right: Flower } | null;
  mode: VtgMode | null;
  propMode: VtgMode | null;
}

export interface ShapeMatrixAppPersistence {
  restore: () => ShapeMatrixAppSnapshot | null;
  persist: (state: ShapeMatrixAppSnapshot) => void;
}

interface ShapeMatrixAppDependencies {
  loadMatrix: (propType: PropType) => Promise<ShapeMatrixData>;
  syncState: (state: ShapeMatrixAppSnapshot) => void;
}

type SemanticVariant = 0 | 1 | 2 | 3;

const LEVEL_LANDING_TURN: Record<TurnLevel, TurnValue> = {
  1: 0,
  2: 1,
  3: 0.5,
  4: 0.25,
};

/**
 * Carry a selection across a ratio change instead of dropping it.
 *
 * The user picked prospin-out in the top-left corner; changing the ratio is a
 * request to see THAT variant at the new ratio, the same way the Matrix keeps
 * a cell's style and orientation when its turn value moves. The endpoints have
 * fewer variants, so the axis is asked what actually survives.
 */
function theoryFlowerAt(
  ratio: SpinRatio,
  remembered: TheoryFlower | null
): TheoryFlower {
  const axis = buildTheoryAxis(ratio);
  const match = remembered
    ? axis.find(
        (candidate) =>
          candidate.style === remembered.style &&
          candidate.ori === remembered.ori
      )
    : undefined;
  return match ?? (axis[0] as TheoryFlower);
}

function semanticVariant(flower: Flower): SemanticVariant {
  if (flower.style === "float") {
    return ({ in: 0, out: 1, clock: 2, counter: 3 } as const)[flower.ori];
  }
  return ((flower.style === "anti" ? 2 : 0) +
    (flower.ori === "out" ? 1 : 0)) as SemanticVariant;
}

function rotatingStyle(variant: SemanticVariant): FlowerStyle {
  return variant >= 2 ? "anti" : "pro";
}

function rotatingOri(variant: SemanticVariant): RotatingFlowerOri {
  return variant % 2 === 0 ? "in" : "out";
}

function floatOri(variant: SemanticVariant): Flower["ori"] {
  return (["in", "out", "clock", "counter"] as const)[variant];
}

function flowerAtTurn(
  turn: TurnValue,
  rememberedVariant: SemanticVariant
): Flower {
  if (turn === "fl") {
    return {
      style: "float",
      turns: "fl",
      ori: floatOri(rememberedVariant),
      grid: "diamond",
      petals: 0,
    };
  }

  const style = rotatingStyle(rememberedVariant);
  return {
    style,
    turns: turn,
    ori: rotatingOri(rememberedVariant),
    grid: "diamond",
    petals: flowerPetals({ style, turns: turn }),
  };
}

function supportsTimedPropRelationship(
  pair: { left: Flower; right: Flower } | null
): boolean {
  return (
    pair !== null &&
    pair.left.turns !== "fl" &&
    pair.right.turns !== "fl" &&
    pair.left.turns === pair.right.turns
  );
}

export function createShapeMatrixAppState(
  dependencies: ShapeMatrixAppDependencies,
  initial: ShapeMatrixAppSnapshot,
  initialCompact: boolean
) {
  let surface = $state<ShapeMatrixSurface>(initial.surface);
  let theoryLeftRatio = $state(
    theoryRatioFromParts(
      initial.theoryLeftRatio.propRotations,
      initial.theoryLeftRatio.handCycles
    ) ?? DEFAULT_THEORY_RATIO
  );
  let theoryRightRatio = $state(
    theoryRatioFromParts(
      initial.theoryRightRatio.propRotations,
      initial.theoryRightRatio.handCycles
    ) ?? DEFAULT_THEORY_RATIO
  );
  let theoryMode = $state<VtgMode>(initial.theoryMode);
  let theoryPair = $state(initial.theoryPair);
  let level = $state(initial.level);
  let leftTurn = $state<TurnValue>(
    clampMatrixTurnToLevel(initial.leftTurn, initial.level)
  );
  let rightTurn = $state<TurnValue>(
    clampMatrixTurnToLevel(initial.rightTurn, initial.level)
  );
  let activeAxis = $state<ShapeMatrixAxisTarget>(initial.activeAxis);
  let labelMode = $state(initial.labelMode);
  let propType = $state(initial.propType);
  let selectedPair = $state(initial.pair);
  let rememberedVariants = $state<{
    left: SemanticVariant;
    right: SemanticVariant;
  }>({
    left: initial.pair ? semanticVariant(initial.pair.left) : 0,
    right: initial.pair ? semanticVariant(initial.pair.right) : 2,
  });
  let selectedMode = $state<VtgMode | null>(
    initial.pair ? (initial.mode ?? MODE_ORDER[0] ?? null) : null
  );
  let selectedPropMode = $state<VtgMode | null>(
    supportsTimedPropRelationship(initial.pair) ? initial.propMode : null
  );
  let data = $state<ShapeMatrixData | null>(null);
  let loading = $state(false);
  let loadError = $state<string | null>(null);
  let compact = $state(initialCompact);
  let activeView = $state<ShapeMatrixAppView>(
    initialCompact && initial.pair ? "detail" : "matrix"
  );
  let compactFocusRequest = $state<ShapeMatrixCompactFocusRequest | null>(null);
  let aboutOpen = $state(false);
  let propPickerOpen = $state(false);
  let mandalaHandoff = $state(false);

  const availableTurns = $derived(matrixTurnsForLevel(level));
  const theoryRowAxis = $derived(buildTheoryAxis(theoryLeftRatio));
  const theoryColAxis = $derived(buildTheoryAxis(theoryRightRatio));
  const filters = $derived(matrixFiltersForTurns(leftTurn, rightTurn));
  const rowAxis = $derived(
    data ? applyFilter(data.axis, filters.left, false) : []
  );
  const colAxis = $derived(
    data ? applyFilter(data.axis, filters.right, false) : []
  );

  async function load(nextPropType: PropType = propType): Promise<void> {
    if (loading) return;
    loading = true;
    loadError = null;
    try {
      const nextData = await dependencies.loadMatrix(nextPropType);
      data = nextData;
      propType = nextPropType;
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  function updateSelectedPairTurns(
    nextLeftTurn: TurnValue,
    nextRightTurn: TurnValue
  ): void {
    if (!selectedPair) return;
    selectedPair = {
      left: flowerAtTurn(nextLeftTurn, rememberedVariants.left),
      right: flowerAtTurn(nextRightTurn, rememberedVariants.right),
    };
  }

  function setLevel(
    nextLevel: TurnLevel,
    options: ShapeMatrixSetTurnOptions = {}
  ): void {
    if (level === nextLevel) return;
    level = nextLevel;

    const landingTurn = LEVEL_LANDING_TURN[level];
    // A higher level should change the picture, not merely add quiet options
    // around the current Level 1 matrix. Move the edited axis into the new
    // vocabulary while preserving the other axis whenever it remains legal.
    const nextLeftTurn =
      activeAxis === "right"
        ? clampMatrixTurnToLevel(leftTurn, level)
        : landingTurn;
    const nextRightTurn =
      activeAxis === "left"
        ? clampMatrixTurnToLevel(rightTurn, level)
        : landingTurn;
    if (
      selectedPair &&
      (nextLeftTurn !== leftTurn || nextRightTurn !== rightTurn)
    ) {
      requestShapeMatrixTransition(
        `level:${level}:${String(nextLeftTurn)}:${String(nextRightTurn)}`
      );
    }
    updateSelectedPairTurns(nextLeftTurn, nextRightTurn);
    if (nextLeftTurn === "fl" || nextLeftTurn !== nextRightTurn) {
      selectedPropMode = null;
    }
    leftTurn = nextLeftTurn;
    rightTurn = nextRightTurn;
    if (compact && !options.stayOnDetail) activeView = "matrix";
    syncState();
  }

  function setTurn(
    nextTurn: TurnValue,
    options: ShapeMatrixSetTurnOptions = {}
  ): void {
    if (!availableTurns.includes(nextTurn)) return;
    if (selectedPair) {
      rememberedVariants = {
        left: semanticVariant(selectedPair.left),
        right: semanticVariant(selectedPair.right),
      };
    }

    const nextLeftTurn = activeAxis === "right" ? leftTurn : nextTurn;
    const nextRightTurn = activeAxis === "left" ? rightTurn : nextTurn;
    if (nextLeftTurn === leftTurn && nextRightTurn === rightTurn) return;

    if (selectedPair) {
      requestShapeMatrixTransition(
        `turn:${activeAxis}:${String(nextLeftTurn)}:${String(nextRightTurn)}`
      );
    }
    updateSelectedPairTurns(nextLeftTurn, nextRightTurn);
    if (nextLeftTurn === "fl" || nextLeftTurn !== nextRightTurn) {
      selectedPropMode = null;
    }
    leftTurn = nextLeftTurn;
    rightTurn = nextRightTurn;
    if (compact && !options.stayOnDetail) activeView = "matrix";
    syncState();
  }

  function setActiveAxis(nextAxis: ShapeMatrixAxisTarget): void {
    if (activeAxis === nextAxis) return;
    activeAxis = nextAxis;
    syncState();
  }

  function setLabelMode(nextMode: MatrixLabelMode): void {
    if (labelMode === nextMode) return;
    labelMode = nextMode;
    syncState();
  }

  function setSurface(nextSurface: ShapeMatrixSurface): void {
    if (surface === nextSurface) return;
    surface = nextSurface;
    syncState();
  }

  function applyTheoryRatios(nextLeft: SpinRatio, nextRight: SpinRatio): void {
    const moved =
      !spinRatioEquals(nextLeft, theoryLeftRatio) ||
      !spinRatioEquals(nextRight, theoryRightRatio);
    if (!moved) return;
    theoryLeftRatio = nextLeft;
    theoryRightRatio = nextRight;
    if (theoryPair) {
      theoryPair = {
        left: theoryFlowerAt(nextLeft, theoryPair.left),
        right: theoryFlowerAt(nextRight, theoryPair.right),
      };
    }
  }

  /** One named axis, for the live tuners that edit a specific hand. */
  function setTheoryRatioFor(
    hand: "left" | "right",
    nextRatio: SpinRatio
  ): void {
    const allowed = theoryRatioFromParts(
      nextRatio.propRotations,
      nextRatio.handCycles
    );
    if (!allowed) return;
    applyTheoryRatios(
      hand === "left" ? allowed : theoryLeftRatio,
      hand === "right" ? allowed : theoryRightRatio
    );
    syncState();
  }

  /** Two visible editors commit together when one ratio is copied across. */
  function setTheoryRatios(
    nextLeftRatio: SpinRatio,
    nextRightRatio: SpinRatio
  ): void {
    const allowedLeft = theoryRatioFromParts(
      nextLeftRatio.propRotations,
      nextLeftRatio.handCycles
    );
    const allowedRight = theoryRatioFromParts(
      nextRightRatio.propRotations,
      nextRightRatio.handCycles
    );
    if (!allowedLeft || !allowedRight) return;
    applyTheoryRatios(allowedLeft, allowedRight);
    syncState();
  }

  function setTheoryMode(nextMode: VtgMode): void {
    if (theoryMode === nextMode) return;
    theoryMode = nextMode;
    syncState();
  }

  function selectTheoryPair(
    pair: { left: TheoryFlower; right: TheoryFlower },
    options: ShapeMatrixSelectPairOptions = {}
  ): void {
    theoryPair = pair;
    if (compact && options.navigate !== false) {
      activeView = "detail";
      requestCompactFocus("detail");
    }
    syncState();
  }

  /*
   * The picker stays open. It sits beside the animation rather than over it,
   * so a choice is meant to be watched: pick a prop, see the shape traced by
   * it, pick the next one. Closing is its own action.
   */
  async function setPropType(nextPropType: PropType): Promise<void> {
    if (propType === nextPropType) return;
    await load(nextPropType);
    if (!loadError) syncState();
  }

  function restoreState(snapshot: ShapeMatrixAppSnapshot): void {
    surface = snapshot.surface ?? "matrix";
    level = snapshot.level;
    const restoredLeftRatio = snapshot.theoryLeftRatio ?? DEFAULT_THEORY_RATIO;
    const restoredRightRatio =
      snapshot.theoryRightRatio ?? DEFAULT_THEORY_RATIO;
    theoryLeftRatio =
      theoryRatioFromParts(
        restoredLeftRatio.propRotations,
        restoredLeftRatio.handCycles
      ) ?? DEFAULT_THEORY_RATIO;
    theoryRightRatio =
      theoryRatioFromParts(
        restoredRightRatio.propRotations,
        restoredRightRatio.handCycles
      ) ?? DEFAULT_THEORY_RATIO;
    theoryMode = snapshot.theoryMode ?? "SS";
    theoryPair = snapshot.theoryPair
      ? {
          left: theoryFlowerAt(theoryLeftRatio, snapshot.theoryPair.left),
          right: theoryFlowerAt(theoryRightRatio, snapshot.theoryPair.right),
        }
      : null;
    leftTurn = clampMatrixTurnToLevel(snapshot.leftTurn, snapshot.level);
    rightTurn = clampMatrixTurnToLevel(snapshot.rightTurn, snapshot.level);
    activeAxis = snapshot.activeAxis;
    labelMode = snapshot.labelMode;
    propType = snapshot.propType;
    if (snapshot.pair) {
      rememberedVariants = {
        left: semanticVariant(snapshot.pair.left),
        right: semanticVariant(snapshot.pair.right),
      };
    }
    selectedPair = snapshot.pair
      ? {
          left: flowerAtTurn(leftTurn, rememberedVariants.left),
          right: flowerAtTurn(rightTurn, rememberedVariants.right),
        }
      : null;
    selectedMode = selectedPair
      ? (snapshot.mode ?? MODE_ORDER[0] ?? null)
      : null;
    selectedPropMode = supportsTimedPropRelationship(selectedPair)
      ? snapshot.propMode
      : null;
  }

  function selectPair(
    pair: { left: Flower; right: Flower },
    options: ShapeMatrixSelectPairOptions = {}
  ): void {
    selectedPair = pair;
    rememberedVariants = {
      left: semanticVariant(pair.left),
      right: semanticVariant(pair.right),
    };
    selectedMode ??= MODE_ORDER[0] ?? null;
    if (!supportsTimedPropRelationship(pair)) selectedPropMode = null;
    if (compact && options.navigate !== false) {
      activeView = "detail";
      requestCompactFocus("detail");
    }
    syncState();
  }

  function setMode(mode: VtgMode | null): void {
    selectedMode = selectedPair
      ? (mode ?? selectedMode ?? MODE_ORDER[0] ?? null)
      : null;
    syncState();
  }

  function setPropMode(mode: VtgMode | null): void {
    selectedPropMode = supportsTimedPropRelationship(selectedPair)
      ? mode
      : null;
    syncState();
  }

  function showMatrix(): void {
    activeView = "matrix";
    if (compact) requestCompactFocus("matrix");
  }
  function showDetail(): void {
    if (surface === "theory" ? theoryPair : selectedPair) {
      activeView = "detail";
      if (compact) requestCompactFocus("detail");
    }
  }
  function requestCompactFocus(target: ShapeMatrixAppView): void {
    compactFocusRequest = {
      id: (compactFocusRequest?.id ?? 0) + 1,
      target,
    };
  }
  function setCompact(nextCompact: boolean): void {
    if (compact === nextCompact) return;
    compact = nextCompact;
    if (compact) {
      activeView = (surface === "theory" ? theoryPair : selectedPair)
        ? "detail"
        : "matrix";
    }
  }
  function openAbout(): void {
    aboutOpen = true;
  }
  function closeAbout(): void {
    aboutOpen = false;
  }
  /**
   * One entry point. The Props control under the animation is a disclosure:
   * pressing it again puts the stage back the way it was.
   */
  function togglePropPicker(): void {
    propPickerOpen = !propPickerOpen;
  }
  /** For the drill, when another dock section claims the space. */
  function closePropPicker(): void {
    propPickerOpen = false;
  }
  /** A tile-to-hero shared-element transition is capturing or animating. */
  function beginMandalaHandoff(): void {
    mandalaHandoff = true;
  }
  function endMandalaHandoff(): void {
    mandalaHandoff = false;
  }

  function syncState(): void {
    dependencies.syncState({
      surface,
      theoryLeftRatio,
      theoryRightRatio,
      theoryMode,
      theoryPair,
      level,
      leftTurn,
      rightTurn,
      activeAxis,
      labelMode,
      propType,
      pair: selectedPair,
      mode: selectedMode,
      propMode: selectedPropMode,
    });
  }

  return {
    get surface() {
      return surface;
    },
    get theoryLeftRatio() {
      return theoryLeftRatio;
    },
    get theoryRightRatio() {
      return theoryRightRatio;
    },
    get theoryMode() {
      return theoryMode;
    },
    get theoryPair() {
      return theoryPair;
    },
    get theoryRowAxis() {
      return theoryRowAxis;
    },
    get theoryColAxis() {
      return theoryColAxis;
    },
    get level() {
      return level;
    },
    get leftTurn() {
      return leftTurn;
    },
    get rightTurn() {
      return rightTurn;
    },
    get activeAxis() {
      return activeAxis;
    },
    get activeTurn() {
      return activeAxis === "right" ? rightTurn : leftTurn;
    },
    get labelMode() {
      return labelMode;
    },
    get propType() {
      return propType;
    },
    get availableTurns() {
      return availableTurns;
    },
    get selectedPair() {
      return selectedPair;
    },
    get selectedMode() {
      return selectedMode;
    },
    get selectedPropMode() {
      return selectedPropMode;
    },
    get data() {
      return data;
    },
    get loading() {
      return loading;
    },
    get loadError() {
      return loadError;
    },
    get compact() {
      return compact;
    },
    get activeView() {
      return activeView;
    },
    get compactFocusRequest() {
      return compactFocusRequest;
    },
    get aboutOpen() {
      return aboutOpen;
    },
    get propPickerOpen() {
      return propPickerOpen;
    },
    get mandalaHandoff() {
      return mandalaHandoff;
    },
    get rowAxis() {
      return rowAxis;
    },
    get colAxis() {
      return colAxis;
    },
    load,
    restoreState,
    setLevel,
    setTurn,
    setActiveAxis,
    setLabelMode,
    setSurface,
    setTheoryRatioFor,
    setTheoryRatios,
    setTheoryMode,
    selectTheoryPair,
    setPropType,
    selectPair,
    setMode,
    setPropMode,
    showMatrix,
    showDetail,
    setCompact,
    openAbout,
    closeAbout,
    togglePropPicker,
    closePropPicker,
    beginMandalaHandoff,
    endMandalaHandoff,
  };
}

export type ShapeMatrixAppState = ReturnType<typeof createShapeMatrixAppState>;
