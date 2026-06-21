/**
 * One short loopable demo sequence for the prop-unlock tunnel reveal. Generated
 * once at runtime and cached (module-level promise). The prop rendered on top is
 * swapped per reveal — the motion is shared.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { generationOrchestrator } from "$lib/shared/create/services/generation-orchestrator";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { DifficultyLevel } from "$lib/shared/foundation/domain/models/generation/generate-models";
import { isSeamlesslyLoopable } from "$lib/features/compose/services/sequence-loopability-checker";

let cached: Promise<SequenceData> | null = null;

export function getPropDemoLoop(): Promise<SequenceData> {
  return (cached ??= generationOrchestrator
    .generateSequence({
      length: 8,
      gridMode: GridMode.DIAMOND,
      propType: PropType.STAFF, // generation prop is irrelevant; render prop is set on the canvas
      difficulty: DifficultyLevel.INTERMEDIATE,
      constraintPreset: "smooth",
    })
    .then((seq) => {
      try {
        if (!isSeamlesslyLoopable(seq)) {
          console.warn("[prop-demo-loop] demo sequence is not seamlessly loopable; tunnel may blip at wrap.");
        }
      } catch (e) {
        console.warn("[prop-demo-loop] loopability check failed:", e);
      }
      return seq;
    }));
}
