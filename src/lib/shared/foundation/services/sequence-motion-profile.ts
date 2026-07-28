import type { SequenceData } from "../domain/models/sequence-data";
import type { AuthoredHand } from "../domain/models/authored-hand";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";

export type { AuthoredHand } from "../domain/models/authored-hand";
export type SoloMotionColor = "blue" | "red";

export type SequenceMotionProfile =
  | { readonly kind: "empty" }
  | {
      readonly kind: "solo";
      readonly color: SoloMotionColor;
      readonly authoredHand: AuthoredHand;
    }
  | { readonly kind: "paired" }
  | { readonly kind: "mixed" };

export interface SequenceMotionVisibility {
  readonly showBlueMotion: boolean;
  readonly showRedMotion: boolean;
}

export function authoredHandForColor(color: SoloMotionColor): AuthoredHand {
  return color === "blue" ? "left" : "right";
}

export function colorForAuthoredHand(hand: AuthoredHand): SoloMotionColor {
  return hand === "left" ? "blue" : "red";
}

/**
 * Classifies the choreography that is actually present in the steps.
 *
 * Start-position props do not make a hand part of the choreography, and
 * invisible placeholders count as absent. Fully blank beats are ignored.
 */
export function getSequenceMotionProfile(
  sequence: Pick<SequenceData, "steps">
): SequenceMotionProfile {
  let hasBlue = false;
  let hasRed = false;
  let hasUnpairedContent = false;

  for (const step of sequence.steps ?? []) {
    const blue = isVisibleMotion(step.motions?.blue);
    const red = isVisibleMotion(step.motions?.red);
    if (!blue && !red) continue;

    hasBlue ||= blue;
    hasRed ||= red;
    hasUnpairedContent ||= blue !== red;
  }

  if (!hasBlue && !hasRed) return { kind: "empty" };
  if (hasBlue && !hasRed) {
    return { kind: "solo", color: "blue", authoredHand: "left" };
  }
  if (hasRed && !hasBlue) {
    return { kind: "solo", color: "red", authoredHand: "right" };
  }
  return hasUnpairedContent ? { kind: "mixed" } : { kind: "paired" };
}

export function getSequenceMotionVisibility(
  sequence: Pick<SequenceData, "steps">
): SequenceMotionVisibility {
  const profile = getSequenceMotionProfile(sequence);
  if (profile.kind !== "solo") {
    return { showBlueMotion: true, showRedMotion: true };
  }

  return {
    showBlueMotion: profile.color === "blue",
    showRedMotion: profile.color === "red",
  };
}
