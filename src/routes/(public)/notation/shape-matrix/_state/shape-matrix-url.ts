import {
  buildShapeMatrixAxis,
  flowerKey,
} from "$lib/shared/shape-matrix/domain/flower-signature";
import type { MatrixLabelMode } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
import {
  asTurnLevel,
  keyToTurnValue,
  turnValueToKey,
  turnValuesForLevel,
  type TurnLevel,
  type TurnValue,
} from "$lib/shared/create/services/level-turn-values";
import {
  MODE_ORDER,
  type VtgMode,
} from "$lib/shared/shape-matrix/services/shape-matrix-realizations";
import type { ShapeMatrixAppSnapshot } from "$lib/shared/shape-matrix/app/state/shape-matrix-app-state.svelte";
import type { ShapeMatrixAxisTarget } from "$lib/shared/shape-matrix/app/state/shape-matrix-app-state.svelte";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

const MODES = new Set<VtgMode>(MODE_ORDER);
const LABEL_MODES = new Set<MatrixLabelMode>(["turns", "ratios"]);
const AXIS_TARGETS = new Set<ShapeMatrixAxisTarget>(["left", "both", "right"]);
const PROP_TYPES = new Set<PropType>(Object.values(PropType));
const LEGACY_SIZE_TURNS = { small: 0, medium: 1, large: 2 } as const;

function readLevel(params: URLSearchParams): TurnLevel {
  const raw = Number(params.get("level"));
  return Number.isInteger(raw) && raw >= 1 && raw <= 4 ? asTurnLevel(raw) : 2;
}

function readTurn(
  params: URLSearchParams,
  level: TurnLevel,
  axisKey: "leftTurn" | "rightTurn",
  legacyAxisKey: "blueTurn" | "redTurn"
): TurnValue {
  const legacySize = params.get("size") as
    | keyof typeof LEGACY_SIZE_TURNS
    | null;
  const raw = params.has(axisKey)
    ? keyToTurnValue(params.get(axisKey) ?? "")
    : params.has(legacyAxisKey)
      ? keyToTurnValue(params.get(legacyAxisKey) ?? "")
      : params.has("turn")
        ? keyToTurnValue(params.get("turn") ?? "")
        : legacySize && legacySize in LEGACY_SIZE_TURNS
          ? LEGACY_SIZE_TURNS[legacySize]
          : 2;
  return turnValuesForLevel(level).includes(raw)
    ? raw
    : (turnValuesForLevel(level)[0] ?? 0);
}

export function readShapeMatrixRouteState(
  search: string
): ShapeMatrixAppSnapshot {
  const params = new URLSearchParams(search);
  const level = readLevel(params);
  const leftTurn = readTurn(params, level, "leftTurn", "blueTurn");
  const rightTurn = readTurn(params, level, "rightTurn", "redTurn");
  const requestedLabels = params.get("labels") as MatrixLabelMode | null;
  const labelMode =
    requestedLabels && LABEL_MODES.has(requestedLabels)
      ? requestedLabels
      : "turns";
  const flowersByKey = new Map(
    buildShapeMatrixAxis().map((flower) => [flowerKey(flower), flower])
  );
  const left =
    flowersByKey.get(params.get("left") ?? params.get("blue") ?? "") ?? null;
  const right =
    flowersByKey.get(params.get("right") ?? params.get("red") ?? "") ?? null;
  const requestedMode = params.get("mode") as VtgMode | null;
  const requestedPropMode = params.get("propMode") as VtgMode | null;
  const pair =
    left && right && left.turns === leftTurn && right.turns === rightTurn
      ? { left, right }
      : null;
  const rawAxis = params.get("axis");
  const requestedAxis = (
    rawAxis === "blue" ? "left" : rawAxis === "red" ? "right" : rawAxis
  ) as ShapeMatrixAxisTarget | null;
  const requestedProp = params.get("prop") as PropType | null;

  return {
    level,
    leftTurn,
    rightTurn,
    activeAxis:
      requestedAxis && AXIS_TARGETS.has(requestedAxis) ? requestedAxis : "both",
    labelMode,
    propType:
      requestedProp && PROP_TYPES.has(requestedProp)
        ? requestedProp
        : PropType.STAFF,
    pair,
    mode:
      pair && requestedMode && MODES.has(requestedMode) ? requestedMode : null,
    propMode:
      pair &&
      leftTurn !== "fl" &&
      leftTurn === rightTurn &&
      requestedPropMode &&
      MODES.has(requestedPropMode)
        ? requestedPropMode
        : null,
  };
}

export function writeShapeMatrixRouteState(
  url: URL,
  state: ShapeMatrixAppSnapshot
): void {
  url.searchParams.delete("size");
  url.searchParams.delete("turn");
  url.searchParams.set("level", String(state.level));
  url.searchParams.delete("blueTurn");
  url.searchParams.delete("redTurn");
  url.searchParams.set("leftTurn", turnValueToKey(state.leftTurn));
  url.searchParams.set("rightTurn", turnValueToKey(state.rightTurn));
  url.searchParams.set("axis", state.activeAxis);
  url.searchParams.set("labels", state.labelMode);
  url.searchParams.set("prop", state.propType);
  // Older links used this parameter to switch between two different picker
  // modes. The coordinated selector no longer has a driver, so new URLs remove
  // it while `propMode` continues to restore the exact relationship edge.
  url.searchParams.delete("driver");

  if (!state.pair) {
    url.searchParams.delete("left");
    url.searchParams.delete("right");
    url.searchParams.delete("blue");
    url.searchParams.delete("red");
    url.searchParams.delete("mode");
    url.searchParams.delete("propMode");
    return;
  }

  url.searchParams.delete("blue");
  url.searchParams.delete("red");
  url.searchParams.set("left", flowerKey(state.pair.left));
  url.searchParams.set("right", flowerKey(state.pair.right));
  if (state.mode) url.searchParams.set("mode", state.mode);
  else url.searchParams.delete("mode");
  if (state.propMode) url.searchParams.set("propMode", state.propMode);
  else url.searchParams.delete("propMode");
}
