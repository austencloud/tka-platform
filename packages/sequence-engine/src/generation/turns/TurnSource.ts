/**
 * How anything that builds a sequence asks "what turn does this step get?".
 *
 * Two kinds answer that question and they differ in one way that matters. A
 * random allocation is a fixed-length array decided up front, so once the
 * search inserts bridge steps and runs past that length it has nothing left to
 * give. A pattern is a period: it is indexed modulo its own length, so it
 * answers at every index that will ever exist, bridges included.
 */

import type { TurnAllocation } from "./TurnAllocator.js";

/**
 * Derived from the allocator rather than declared again. There are already
 * four separate `TurnValue` declarations in this repo and a fifth would be one
 * more thing to keep in step.
 */
export type TurnValue = TurnAllocation["left"][number];
export type TurnHand = "left" | "right";

export interface TurnLanes {
  readonly left: readonly TurnValue[];
  readonly right: readonly TurnValue[];
}

export interface TurnSource {
  at(stepIndex: number, hand: TurnHand): TurnValue | undefined;
}

/** Fixed-length allocation. Runs out past its end, which is today's behaviour. */
export function allocationSource(lanes: TurnLanes): TurnSource {
  return {
    at(stepIndex, hand) {
      const lane = lanes[hand];
      if (stepIndex < 0 || stepIndex >= lane.length) return undefined;
      return lane[stepIndex];
    },
  };
}

/** Repeating period. Never runs out. */
export function patternSource(lanes: TurnLanes): TurnSource {
  return {
    at(stepIndex, hand) {
      const lane = lanes[hand];
      if (lane.length === 0 || stepIndex < 0) return undefined;
      return lane[stepIndex % lane.length];
    },
  };
}
