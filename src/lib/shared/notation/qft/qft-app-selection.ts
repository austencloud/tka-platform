import {
  buildFlowerAxis,
  type Flower,
} from "$lib/shared/shape-matrix/domain/flower-signature";
import {
  MODE_ORDER,
  type VtgMode,
} from "$lib/shared/shape-matrix/services/shape-matrix-realizations";
import { flowerToTrajectory, relateTrajectories } from "./qft-flower-bridge";
import { GUIDE_MOVES } from "./qft-guide";
import type { QftHandCount, QftSessionHand } from "./qft-session";
import {
  hasValidReversalPositions,
  withTrajectoryPhase,
  type QftTrajectory,
} from "./qft-trajectory";

export const QFT_FLOWERS: Flower[] = buildFlowerAxis().filter(
  (flower) => flower.grid === "diamond" && [0, 1, 2].includes(flower.turns)
);

const PRESET_BY_ID = new Map(GUIDE_MOVES.map((move) => [move.id, move]));

function cloneTrajectory(trajectory: QftTrajectory): QftTrajectory {
  return {
    ...trajectory,
    propRate: [...trajectory.propRate] as QftTrajectory["propRate"],
  };
}

export function resolveSessionHand(hand: QftSessionHand): QftTrajectory {
  const { source, radius } = hand;

  if (source.kind === "flower") {
    const flower = QFT_FLOWERS[source.index] ?? QFT_FLOWERS[0]!;
    return flowerToTrajectory(flower, radius);
  }

  if (source.kind === "preset") {
    const move = PRESET_BY_ID.get(source.id) ?? GUIDE_MOVES[0]!;
    return { ...cloneTrajectory(move.trajectory), radius };
  }

  return { ...cloneTrajectory(source.trajectory), radius };
}

export interface ActiveQftHands {
  blue: QftTrajectory;
  red?: QftTrajectory;
}

export function buildActiveHands(
  handCount: QftHandCount,
  blueSelection: QftSessionHand,
  redSelection: QftSessionHand,
  vtgMode: VtgMode,
  originPhase: number
): ActiveQftHands {
  const blue = resolveSessionHand(blueSelection);

  if (handCount === "one") {
    return { blue: withTrajectoryPhase(blue, originPhase) };
  }

  const related = relateTrajectories(
    blue,
    resolveSessionHand(redSelection),
    vtgMode
  );
  return {
    blue: withTrajectoryPhase(related.blue, originPhase),
    red: withTrajectoryPhase(related.red, originPhase),
  };
}

export function activeHandsAreValid(hands: ActiveQftHands): boolean {
  return (
    hasValidReversalPositions(hands.blue) &&
    (!hands.red || hasValidReversalPositions(hands.red))
  );
}

export function validOriginPhases(
  handCount: QftHandCount,
  blue: QftSessionHand,
  red: QftSessionHand,
  vtgMode: VtgMode
): number[] {
  return Array.from({ length: 8 }, (_, phase) => phase).filter((phase) =>
    activeHandsAreValid(buildActiveHands(handCount, blue, red, vtgMode, phase))
  );
}

export function validVtgModes(
  blue: QftSessionHand,
  red: QftSessionHand,
  originPhase: number
): VtgMode[] {
  return MODE_ORDER.filter((mode) =>
    activeHandsAreValid(buildActiveHands("two", blue, red, mode, originPhase))
  );
}

export function selectedPresetId(hand: QftSessionHand): string | null {
  return hand.source.kind === "preset" ? hand.source.id : null;
}

export function selectedFlowerIndex(hand: QftSessionHand): number | null {
  return hand.source.kind === "flower" ? hand.source.index : null;
}
