/**
 * Loop Explorer — Self-Verifying Generation
 *
 * generateVerifiedExample(components, slice): generate a sequence through
 * the SAME canonical path the Generate tab uses (never hand-build loop
 * GenerationOptions — loop length invariance rule), run the canonical
 * detector, and only return a sequence whose detected components exactly
 * match the selection. Retries up to MAX_ATTEMPTS, then falls back to the
 * curated seed pool.
 *
 * Canonical path (investigated, not invented — see
 * `generate-actions.svelte.ts` onGenerateClicked, the code the Generate
 * tab's button actually calls):
 *   resolveLoopConfig() → GenerationOptions → generateCircularExactLength()
 *   { generate: generationOrchestrator.generateSequence,
 *     extend: orientationCycleExtender.extendIfNeeded }
 *   → loopDetector.detectLOOPType() (delegates to @tka/sequence-engine)
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { GenerationOptions } from "$lib/features/create/generate/shared/domain/models/generate-models";
import { DifficultyLevel, GenerationMode } from "$lib/features/create/generate/shared/domain/models/generate-models";
import { generateCircularExactLength } from "$lib/features/create/generate/circular/services/exact-length-loop-generator";
import { generationOrchestrator } from "$lib/shared/create/services/generation-orchestrator";
import { orientationCycleExtender } from "$lib/features/create/generate/circular/services/orientation-cycle-extender";
import { loopDetector } from "$lib/shared/create/services/loop-detector";
import type { LOOPDetectionResult } from "$lib/shared/create/services/ILOOPDetector";
import {
  parseLoopComponents,
  resolveLoopConfig,
  expanderMultiplier,
  specHasExpandInversion,
} from "$lib/shared/create/services/loop-type-utils";
import { evaluateSelection, resolveEffectiveSlice, type LoopSlice } from "$lib/shared/loop-explorer/domain/legality";
import { findCuratedSeed } from "$lib/shared/loop-explorer/domain/curated-seeds";
import { extractPairRelations, defaultInterval, type BeatPairRelation } from "./relation-extractor";

export const MAX_ATTEMPTS = 3;

export interface VerifiedExample {
  readonly sequence: SequenceData;
  readonly loopType: LOOPType;
  readonly slice: LoopSlice;
  readonly relations: readonly BeatPairRelation[];
  readonly seedLength: number;
  readonly source: "generated" | "curated";
}

export interface ExplorerGeneratorDeps {
  generate: (options: GenerationOptions) => Promise<SequenceData>;
  extend: (sequence: SequenceData) => SequenceData;
  detect: (sequence: SequenceData) => LOOPDetectionResult;
}

const defaultDeps: ExplorerGeneratorDeps = {
  generate: (options) => generationOrchestrator.generateSequence(options),
  extend: (sequence) => orientationCycleExtender.extendIfNeeded(sequence),
  detect: (sequence) => loopDetector.detectLOOPType(sequence),
};

/**
 * Generate a verified example for the given component selection + slice.
 * Returns null when the selection itself is illegal (caller should have
 * already gated the picker with `evaluateSelection`/`evaluateChip`, so this
 * is a defensive no-op, not the primary illegal-combo UX).
 */
export async function generateVerifiedExample(
  components: ReadonlySet<LOOPComponent>,
  slice: LoopSlice,
  deps: ExplorerGeneratorDeps = defaultDeps
): Promise<VerifiedExample | null> {
  const legality = evaluateSelection(components);
  if (!legality.legal || !legality.loopType) return null;

  const loopType = legality.loopType;
  const effectiveSlice = resolveEffectiveSlice(loopType, slice);
  const resolved = resolveLoopConfig(loopType, effectiveSlice);
  const wire = resolved.loopSpecWire;
  const multiplier = wire ? expanderMultiplier(wire) : effectiveSlice === "quartered" ? 4 : 2;
  const minSeed = wire && specHasExpandInversion(wire) ? 2 : 1;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const totalLength = pickRequestLength(multiplier, minSeed, attempt);

    try {
      const options: GenerationOptions = {
        mode: GenerationMode.CIRCULAR,
        length: totalLength,
        gridMode: GridMode.DIAMOND,
        propType: PropType.STAFF,
        difficulty: DifficultyLevel.INTERMEDIATE,
        constraintPreset: "smooth",
        handPathMode: "mixed",
        motionTypeFilter: null,
        period: resolved.period as GenerationOptions["period"],
        loopType,
        loopSpecWire: wire,
      };

      const result = await generateCircularExactLength(options, {
        generate: deps.generate,
        extend: deps.extend,
      });
      const sequence = result.sequence;

      const detection = deps.detect(sequence);
      if (
        detection.loopType &&
        setsEqual(parseLoopComponents(detection.loopType), new Set(components))
      ) {
        const interval = defaultInterval(sequence.steps.length, effectiveSlice);
        const relations = extractPairRelations(sequence.steps, interval);
        return {
          sequence,
          loopType,
          slice: effectiveSlice,
          relations,
          seedLength: Math.max(1, Math.floor(sequence.steps.length / multiplier)),
          source: "generated",
        };
      }
    } catch {
      // Retry — a seed/length combo can legitimately throw (engine
      // validation on a degenerate seed length); try the next attempt.
    }
  }

  const curated = findCuratedSeed(loopType, effectiveSlice);
  if (curated) {
    const interval = defaultInterval(curated.steps.length, effectiveSlice);
    const relations = extractPairRelations(curated.steps, interval);
    return {
      sequence: curated,
      loopType,
      slice: effectiveSlice,
      relations,
      seedLength: Math.max(1, Math.floor(curated.steps.length / multiplier)),
      source: "curated",
    };
  }

  return null;
}

/**
 * The requested TOTAL length for a given attempt. Prefers 16 (the default
 * aspiration — quartered rotated needs 16 to shine), falls back to the
 * smallest length that's both a clean multiple of the multiplier and
 * respects the inversion-combo minimum seed length.
 */
function pickRequestLength(multiplier: number, minSeed: number, attempt: number): number {
  const candidates = [16, 8, multiplier * Math.max(minSeed, 2), multiplier * minSeed];
  for (const c of candidates) {
    if (c > 0 && c % multiplier === 0 && c / multiplier >= minSeed) return c;
  }
  // Last-resort deterministic fallback, varied per attempt so a retry
  // isn't identical to the one that just failed.
  return multiplier * (minSeed + attempt);
}

function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}
