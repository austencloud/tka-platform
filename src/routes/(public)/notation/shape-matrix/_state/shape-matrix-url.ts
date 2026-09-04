import {
  buildShapeMatrixAxis,
  flowerKey,
} from "$lib/shared/shape-matrix/domain/flower-signature";
import {
  matrixTurnsForLevel,
  type MatrixLabelMode,
} from "$lib/shared/shape-matrix/domain/matrix-turn-band";
import {
  asTurnLevel,
  keyToTurnValue,
  turnValueToKey,
  type TurnLevel,
  type TurnValue,
} from "$lib/shared/create/services/level-turn-values";
import {
  MODE_ORDER,
  type VtgMode,
} from "$lib/shared/shape-matrix/services/shape-matrix-realizations";
import type { ShapeMatrixAppSnapshot } from "$lib/shared/shape-matrix/app/state/shape-matrix-app-state.svelte";
import type { ShapeMatrixAxisTarget } from "$lib/shared/shape-matrix/app/state/shape-matrix-app-state.svelte";
import type { ShapeMatrixSurface } from "$lib/shared/shape-matrix/app/state/shape-matrix-app-state.svelte";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  makeSpinRatio,
  parseSpinRatio,
  spinRatioEquals,
  spinRatioKey,
  type SpinRatio,
} from "@vtg/domain";
import {
  parseTheoryFlowerKey,
  theoryFlowerKey,
  type TheoryFlower,
} from "$lib/shared/shape-matrix/domain/theory-flower";
import {
  asTheoryBand,
  DEFAULT_THEORY_BAND,
  narrowestBandFor,
  THEORY_RATIO_MAX_PART,
  type TheoryBand,
} from "$lib/shared/shape-matrix/domain/theory-ratio-band";

const MODES = new Set<VtgMode>(MODE_ORDER);
const LABEL_MODES = new Set<MatrixLabelMode>(["turns", "ratios"]);
const AXIS_TARGETS = new Set<ShapeMatrixAxisTarget>(["left", "both", "right"]);
const PROP_TYPES = new Set<PropType>(Object.values(PropType));
const LEGACY_SIZE_TURNS = { small: 0, medium: 1, large: 2 } as const;
const DEFAULT_THEORY_RATIO = makeSpinRatio(1, 3);

/*
 * A ratio restores whenever both values fit the editor's 0–15 range. The
 * reader widens the band afterward, so an old or hand-written band cannot
 * silently replace the requested ratio. `ratio` is the legacy one-axis name.
 */
function readTheoryRatio(
  params: URLSearchParams,
  key: "leftRatio" | "rightRatio"
): SpinRatio {
  const readBounded = (value: string | null): SpinRatio | null => {
    const match = /^(\d+):(\d+)$/.exec(value?.trim() ?? "");
    if (!match) return null;
    const propRotations = Number(match[1]);
    const handCycles = Number(match[2]);
    if (
      propRotations > THEORY_RATIO_MAX_PART ||
      handCycles > THEORY_RATIO_MAX_PART
    ) {
      return null;
    }
    return parseSpinRatio(`${propRotations}:${handCycles}`);
  };

  const requested =
    readBounded(params.get(key)) ?? readBounded(params.get("ratio"));
  return requested && narrowestBandFor(requested) !== null
    ? requested
    : DEFAULT_THEORY_RATIO;
}

/*
 * How far the Theory ratio field opens.
 *
 * `level` used to carry this, which put `level=4` in the address bar of a
 * surface the level system does not reach. Links written before the split
 * still restore through it, so a shared 1:9 flower keeps working; new links
 * write `band` and leave `level` to mean the Kinetic Alphabet level it names.
 *
 * The fallback is read only on a Theory link. On a Matrix link `level` means
 * exactly what it says, and borrowing it for the band would let a Matrix URL
 * silently decide how far a surface it never opened is allowed to go.
 */
function readTheoryBand(
  params: URLSearchParams,
  surface: ShapeMatrixSurface
): TheoryBand {
  const legacy = surface === "theory" ? params.get("level") : null;
  const raw = Number(params.get("band") ?? legacy);
  return Number.isInteger(raw) && raw >= 1 && raw <= 5
    ? asTheoryBand(raw)
    : DEFAULT_THEORY_BAND;
}

function readTheoryFlower(
  params: URLSearchParams,
  key: "theoryLeft" | "theoryRight",
  ratio: SpinRatio
): TheoryFlower | null {
  const flower = parseTheoryFlowerKey(params.get(key) ?? "");
  return flower && spinRatioEquals(flower.ratio, ratio) ? flower : null;
}

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
  return matrixTurnsForLevel(level).includes(raw)
    ? raw
    : (matrixTurnsForLevel(level)[0] ?? 0);
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

  const surface: ShapeMatrixSurface =
    params.get("theory") === "1" ? "theory" : "matrix";
  let theoryBand = readTheoryBand(params, surface);
  const theoryLeftRatio = readTheoryRatio(params, "leftRatio");
  const theoryRightRatio = readTheoryRatio(params, "rightRatio");
  for (const ratio of [theoryLeftRatio, theoryRightRatio]) {
    const home = narrowestBandFor(ratio);
    if (home !== null && home > theoryBand) theoryBand = home;
  }
  const theoryLeft = readTheoryFlower(params, "theoryLeft", theoryLeftRatio);
  const theoryRight = readTheoryFlower(params, "theoryRight", theoryRightRatio);
  const requestedTheoryMode = params.get("pairing") as VtgMode | null;

  return {
    surface,
    theoryLeftRatio,
    theoryRightRatio,
    theoryMode:
      requestedTheoryMode && MODES.has(requestedTheoryMode)
        ? requestedTheoryMode
        : "SS",
    theoryPair:
      theoryLeft && theoryRight
        ? { left: theoryLeft, right: theoryRight }
        : null,
    theoryBand,
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
  // `level` names a Kinetic Alphabet level, so only the surface that has one
  // writes it. A Theory link carries `band` instead: the address bar should
  // not tell a visitor they are at Level 4 of a system that does not reach
  // the ratio they are looking at.
  if (state.surface === "theory") url.searchParams.delete("level");
  else url.searchParams.set("level", String(state.level));
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

  // `ratio` and `spin` named the one-axis slider the Theory surface shipped
  // with, and `timing`/`hands` named the pairing before it took the app's own
  // VTG mode names. New links carry both axes and one `pairing` instead.
  url.searchParams.delete("ratio");
  url.searchParams.delete("spin");
  url.searchParams.delete("timing");
  url.searchParams.delete("hands");
  if (state.surface === "theory") {
    url.searchParams.set("theory", "1");
    url.searchParams.set("band", String(state.theoryBand));
    url.searchParams.set("leftRatio", spinRatioKey(state.theoryLeftRatio));
    url.searchParams.set("rightRatio", spinRatioKey(state.theoryRightRatio));
    url.searchParams.set("pairing", state.theoryMode);
    if (state.theoryPair) {
      url.searchParams.set(
        "theoryLeft",
        theoryFlowerKey(state.theoryPair.left)
      );
      url.searchParams.set(
        "theoryRight",
        theoryFlowerKey(state.theoryPair.right)
      );
    } else {
      url.searchParams.delete("theoryLeft");
      url.searchParams.delete("theoryRight");
    }
  } else {
    url.searchParams.delete("theory");
    url.searchParams.delete("band");
    url.searchParams.delete("leftRatio");
    url.searchParams.delete("rightRatio");
    url.searchParams.delete("pairing");
    url.searchParams.delete("theoryLeft");
    url.searchParams.delete("theoryRight");
  }

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
