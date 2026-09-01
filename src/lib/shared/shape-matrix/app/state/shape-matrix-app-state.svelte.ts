import { applyFilter } from "$lib/shared/shape-matrix/domain/filter-flower-axis";
import {
  matrixFiltersForTurns,
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
import {
  clampTurnToLevel,
  turnValuesForLevel,
} from "$lib/shared/create/services/level-turn-values";
import type { ShapeMatrixData } from "$lib/shared/shape-matrix/services/shape-matrix-flowers";
import {
  MODE_ORDER,
  type VtgMode,
} from "$lib/shared/shape-matrix/services/shape-matrix-realizations";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { requestShapeMatrixTransition } from "$lib/shared/shape-matrix/debug/shape-matrix-transition-recorder";

export type ShapeMatrixAppView = "matrix" | "detail";
export interface ShapeMatrixCompactFocusRequest {
  id: number;
  target: ShapeMatrixAppView;
}
export type ShapeMatrixAxisTarget = "left" | "both" | "right";
export type ShapeMatrixRelationshipDriver = "hands" | "props";

export interface ShapeMatrixAppSnapshot {
  level: TurnLevel;
  leftTurn: TurnValue;
  rightTurn: TurnValue;
  activeAxis: ShapeMatrixAxisTarget;
  labelMode: MatrixLabelMode;
  propType: PropType;
  relationshipDriver: ShapeMatrixRelationshipDriver;
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
  let level = $state(initial.level);
  let leftTurn = $state<TurnValue>(
    clampTurnToLevel(initial.leftTurn, initial.level)
  );
  let rightTurn = $state<TurnValue>(
    clampTurnToLevel(initial.rightTurn, initial.level)
  );
  let activeAxis = $state<ShapeMatrixAxisTarget>(initial.activeAxis);
  let labelMode = $state(initial.labelMode);
  let propType = $state(initial.propType);
  let relationshipDriver = $state<ShapeMatrixRelationshipDriver>(
    initial.relationshipDriver
  );
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
    initial.relationshipDriver === "props" &&
      supportsTimedPropRelationship(initial.pair)
      ? initial.propMode
      : null
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

  const availableTurns = $derived(turnValuesForLevel(level));
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

  function setLevel(nextLevel: TurnLevel): void {
    if (level === nextLevel) return;
    level = nextLevel;
    const landingTurn = LEVEL_LANDING_TURN[level];
    // A higher level should change the picture, not merely add quiet options
    // around the current Level 1 matrix. Move the edited axis into the new
    // vocabulary while preserving the other axis whenever it remains legal.
    const nextLeftTurn =
      activeAxis === "right" ? clampTurnToLevel(leftTurn, level) : landingTurn;
    const nextRightTurn =
      activeAxis === "left" ? clampTurnToLevel(rightTurn, level) : landingTurn;
    updateSelectedPairTurns(nextLeftTurn, nextRightTurn);
    if (nextLeftTurn === "fl" || nextLeftTurn !== nextRightTurn) {
      selectedPropMode = null;
    }
    leftTurn = nextLeftTurn;
    rightTurn = nextRightTurn;
    if (compact) activeView = "matrix";
    syncState();
  }

  function setTurn(nextTurn: TurnValue): void {
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
    if (compact) activeView = "matrix";
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

  function setRelationshipDriver(
    nextDriver: ShapeMatrixRelationshipDriver
  ): void {
    if (relationshipDriver === nextDriver) return;
    relationshipDriver = nextDriver;
    if (nextDriver === "hands") selectedPropMode = null;
    syncState();
  }

  async function setPropType(nextPropType: PropType): Promise<void> {
    if (propType === nextPropType) {
      propPickerOpen = false;
      return;
    }
    await load(nextPropType);
    if (!loadError) {
      propPickerOpen = false;
      syncState();
    }
  }

  function restoreState(snapshot: ShapeMatrixAppSnapshot): void {
    level = snapshot.level;
    leftTurn = clampTurnToLevel(snapshot.leftTurn, snapshot.level);
    rightTurn = clampTurnToLevel(snapshot.rightTurn, snapshot.level);
    activeAxis = snapshot.activeAxis;
    labelMode = snapshot.labelMode;
    propType = snapshot.propType;
    relationshipDriver = snapshot.relationshipDriver;
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
    selectedPropMode =
      snapshot.relationshipDriver === "props" &&
      supportsTimedPropRelationship(selectedPair)
        ? snapshot.propMode
        : null;
  }

  function selectPair(pair: { left: Flower; right: Flower }): void {
    selectedPair = pair;
    rememberedVariants = {
      left: semanticVariant(pair.left),
      right: semanticVariant(pair.right),
    };
    selectedMode ??= MODE_ORDER[0] ?? null;
    if (!supportsTimedPropRelationship(pair)) selectedPropMode = null;
    if (compact) {
      activeView = "detail";
      requestCompactFocus("detail");
    }
    syncState();
  }

  function setMode(mode: VtgMode | null): void {
    selectedMode = selectedPair
      ? (mode ?? selectedMode ?? MODE_ORDER[0] ?? null)
      : null;
    if (relationshipDriver === "hands") selectedPropMode = null;
    syncState();
  }

  function setPropMode(mode: VtgMode | null): void {
    selectedPropMode =
      relationshipDriver === "props" &&
      supportsTimedPropRelationship(selectedPair)
        ? mode
        : null;
    syncState();
  }

  function showMatrix(): void {
    activeView = "matrix";
    if (compact) requestCompactFocus("matrix");
  }
  function showDetail(): void {
    if (selectedPair) {
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
    if (compact) activeView = selectedPair ? "detail" : "matrix";
  }
  function openAbout(): void {
    aboutOpen = true;
  }
  function closeAbout(): void {
    aboutOpen = false;
  }
  function openPropPicker(): void {
    propPickerOpen = true;
  }
  function closePropPicker(): void {
    propPickerOpen = false;
  }

  function syncState(): void {
    dependencies.syncState({
      level,
      leftTurn,
      rightTurn,
      activeAxis,
      labelMode,
      propType,
      relationshipDriver,
      pair: selectedPair,
      mode: selectedMode,
      propMode: selectedPropMode,
    });
  }

  return {
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
    get relationshipDriver() {
      return relationshipDriver;
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
    setRelationshipDriver,
    setPropType,
    selectPair,
    setMode,
    setPropMode,
    showMatrix,
    showDetail,
    setCompact,
    openAbout,
    closeAbout,
    openPropPicker,
    closePropPicker,
  };
}

export type ShapeMatrixAppState = ReturnType<typeof createShapeMatrixAppState>;
