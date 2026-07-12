/**
 * Pure gating logic for the Rhythm tier in the combo overlay.
 *
 * Given the selected components + rhythm knobs + the target sequence length,
 * decides whether the resulting spec is buildable AND the length actually
 * divides evenly into the seed the user would be authoring. Kept separate
 * from the Svelte overlay so it's testable without a browser.
 */
import type { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import { buildLoopSpec, expanderMultiplier, specHasExpandInversion, type LoopRhythm } from "./loop-type-utils";

export type RhythmGate =
  | { ok: true; seedLength: number; multiplier: number }
  | { ok: false; reason: string };

export function gateRhythm(
  components: Set<LOOPComponent>,
  rhythm: LoopRhythm,
  sequenceLength: number,
): RhythmGate {
  const wire = buildLoopSpec(components, rhythm);
  if (!wire) return { ok: false, reason: "No LOOP type matches this exact combination" };
  const multiplier = expanderMultiplier(wire);
  if (sequenceLength % multiplier !== 0) {
    return { ok: false, reason: `${sequenceLength} beats can't split into ${multiplier} equal parts` };
  }
  const seedLength = sequenceLength / multiplier;
  if (seedLength < 2 && specHasExpandInversion(wire)) {
    return { ok: false, reason: "Too short — a one-beat seed has nothing for inversion to flip" };
  }
  return { ok: true, seedLength, multiplier };
}
