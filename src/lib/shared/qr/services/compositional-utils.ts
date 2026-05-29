/**
 * Shared utilities for compositional sequence encoding/decoding.
 *
 * Both CompositionalEncoder and CompositionalDecoder need to resolve
 * LOOP executors by tag and compute hashes. Extracting these here
 * avoids duplicating the logic in both files.
 *
 * Domain: QR - Compositional Encoding
 */

import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/** The executor interface both encoder and decoder need */
export interface LOOPExecutorLike {
  executeLOOP(steps: StepData[], period: Period): StepData[];
}

/**
 * Resolve the pre-wired singleton executor for a given LOOP type tag.
 * Uses dynamic import so we don't load all executors upfront.
 * Each case uses a string literal so Vite can resolve the $lib alias.
 */
export async function getLoopExecutor(
  tag: string
): Promise<LOOPExecutorLike | null> {
  switch (tag) {
    case "sr": {
      const mod = await import(
        "$lib/features/create/generate/circular/services/strict-rotated-loop-executor"
      );
      return mod.strictRotatedLOOPExecutor;
    }
    case "sm": {
      const mod = await import(
        "$lib/features/create/generate/circular/services/strict-mirrored-loop-executor"
      );
      return mod.strictMirroredLOOPExecutor;
    }
    case "sf": {
      const mod = await import(
        "$lib/features/create/generate/circular/services/strict-flipped-loop-executor"
      );
      return mod.strictFlippedLOOPExecutor;
    }
    case "ss": {
      const mod = await import(
        "$lib/features/create/generate/circular/services/strict-swapped-loop-executor"
      );
      return mod.strictSwappedLOOPExecutor;
    }
    case "si": {
      const mod = await import(
        "$lib/features/create/generate/circular/services/strict-inverted-loop-executor"
      );
      return mod.strictInvertedLOOPExecutor;
    }
    case "rw": {
      const mod = await import(
        "$lib/features/create/generate/circular/services/rewound-loop-executor"
      );
      return mod.rewoundLOOPExecutor;
    }
    default:
      return null;
  }
}

/**
 * Get the period for a given LOOP type tag.
 * Only rotated uses QUARTERED; all others use HALVED.
 */
export function getPeriodForTag(tag: string): Period {
  return tag === "sr" ? Period.QUARTERED : Period.HALVED;
}

/**
 * Enrich decoded steps with derived GridPosition values.
 *
 * The flat encoder only preserves motion locations (N, E, S, W, etc.),
 * not the GridPosition fields (alpha1, beta5, etc.) on each step.
 * But the LOOP executors need startPosition/endPosition for validation
 * and chaining. This function derives them from the motion locations
 * using the same logic the rest of the app uses.
 */
export function enrichStepsWithGridPositions(steps: StepData[]): void {
  for (const step of steps) {
    const blue = step.motions?.[MotionColor.BLUE];
    const red = step.motions?.[MotionColor.RED];

    // StepData fields are readonly, but we need to set them here because
    // the flat encoder strips GridPosition and the executor needs it.
    const mutable = step as { startPosition: unknown; endPosition: unknown };

    if (blue?.startLocation && red?.startLocation) {
      try {
        mutable.startPosition =
          getGridPositionFromLocations(
            blue.startLocation as GridLocation,
            red.startLocation as GridLocation
          );
      } catch {
        // Unknown location combo - leave null
      }
    }

    if (blue?.endLocation && red?.endLocation) {
      try {
        mutable.endPosition =
          getGridPositionFromLocations(
            blue.endLocation as GridLocation,
            red.endLocation as GridLocation
          );
      } catch {
        // Unknown location combo - leave null
      }
    }
  }
}

/**
 * Compute an 8-character truncated SHA-256 hash of the input string.
 * Used for round-trip verification on recipe-encoded QR codes.
 */
export async function computeRecipeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(buffer));
  const hexHash = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hexHash.slice(0, 8);
}
