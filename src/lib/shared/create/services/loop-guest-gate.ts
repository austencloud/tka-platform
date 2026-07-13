/**
 * Guest gating for the LOOP selector.
 *
 * Guests (unauthenticated) get a deliberately limited slice of the LOOP system,
 * with signing up as the unlock channel. Two independent locks apply:
 *
 *  - CATEGORY: only rotated LOOP types (ROTATED_LOOP_TYPES) are free. Mirrored,
 *    flipped, swapped, inverted, and rewound LOOPs are a sign-up perk.
 *  - LENGTH: a config whose minimum buildable length exceeds the guest beat cap
 *    can never generate for a guest (e.g. a quartered inversion combo needs 16
 *    beats; guests cap at 8). Lock it instead of surfacing a raw engine error.
 *
 * Pure + framework-free so it's testable and shared across every host.
 */
import type { LOOPSpecWire } from "@tka/sequence-engine/loop";
import { LOOPType, ROTATED_LOOP_TYPES } from "$lib/shared/foundation/domain/models/generation/circular-models";
import { expanderMultiplier, specHasExpandInversion } from "./loop-type-utils";

export type GuestLoopLock =
  | { locked: false }
  | { locked: true; kind: "category" | "length"; reason: string };

const UNLOCKED: GuestLoopLock = Object.freeze({ locked: false });

/**
 * Smallest sequence length this spec can actually build. The engine expands a
 * seed by `expanderMultiplier`, and an expand-mode inversion needs a seed of at
 * least 2 beats (a one-beat seed is dash-only, nothing to flip). So the floor
 * is one seed (×1), or two seeds (×2) when an expand inversion is present.
 */
export function minBuildableLength(wire: LOOPSpecWire): number {
  return expanderMultiplier(wire) * (specHasExpandInversion(wire) ? 2 : 1);
}

/**
 * Whether a LOOP config is locked for a guest. `maxLength` is the guest beat cap
 * (getMaxBeats("guest")). Category is checked first so the copy points at the
 * cheaper unlock ("rotated is free") before the length ceiling.
 */
export function guestLoopGate(
  loopType: LOOPType | null,
  wire: LOOPSpecWire | null,
  maxLength: number,
): GuestLoopLock {
  if (loopType && !ROTATED_LOOP_TYPES.has(loopType)) {
    return {
      locked: true,
      kind: "category",
      reason: "Rotated LOOPs are free. Sign up to unlock mirrored, flipped, swapped, and inverted LOOPs.",
    };
  }

  if (wire) {
    const min = minBuildableLength(wire);
    if (min > maxLength) {
      return {
        locked: true,
        kind: "length",
        reason: `This LOOP needs at least ${min} beats. Guests cap at ${maxLength} — sign up free for up to 64.`,
      };
    }
  }

  return UNLOCKED;
}
