/**
 * Sequence Hydrator
 *
 * Runs every pure-client-side deriver we have against a decoded
 * SequenceData and returns a fully enriched copy. This is the single
 * bottleneck that guarantees URL-shared / shortcode-resolved sequences
 * carry the same semantic fields a freshly-authored sequence does:
 * letter per beat, start/end position per beat, word, isCircular,
 * loopType, and gridMode.
 *
 * Why a standalone helper rather than a service class: the three
 * resolver paths (/q/[code], /sequence/[id], SequenceViewerDrawerHost)
 * all need identical behavior, and without centralizing the pipeline
 * each one drifts. Previously /q and /sequence ran letter+position
 * only; the drawer host ran nothing at all. Refreshing a scanned link
 * would restore a sequence with empty word and null loopType - which
 * is what broke card footers and the reversal/difficulty indicators.
 *
 * Pure. No Firestore, no fetch. Motion primitives carry everything.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { deriveLettersForSequence } from "$lib/shared/navigation/services/letter-deriver";
import { derivePositionsForSequence } from "$lib/shared/navigation/services/position-deriver";
import type { ILOOPDetector } from "$lib/shared/create/services/ILOOPDetector";
import { deriveGridMode } from "../../pictograph/grid/services/grid-mode-deriver";

export interface SequenceHydratorDeps {
  loopDetector: ILOOPDetector | null;
}

export async function hydrateSequence(
  sequence: SequenceData,
  deps: SequenceHydratorDeps
): Promise<SequenceData> {
  const { loopDetector } = deps;

  const [withLetters, withPositions] = await Promise.all([
    deriveLettersForSequence(sequence),
    derivePositionsForSequence(sequence),
  ]);

  // Merge: letters take precedence (they carry `word`), but fall back
  // to position-derived start/endPosition when the letter pass didn't
  // populate them. Mirrors DeepLinkSequenceHandler.mergeEnrichedSequence
  // so behavior stays identical across entry points.
  const merged: SequenceData = {
    ...withLetters,
    steps: withLetters.steps.map((step, index) => ({
      ...step,
      startPosition:
        step.startPosition ?? withPositions.steps[index]?.startPosition ?? null,
      endPosition:
        step.endPosition ?? withPositions.steps[index]?.endPosition ?? null,
    })),
    startPosition: withLetters.startPosition
      ? {
          ...withLetters.startPosition,
          startPosition:
            withLetters.startPosition.startPosition ??
            withPositions.startPosition?.startPosition ??
            null,
          endPosition:
            withLetters.startPosition.endPosition ??
            withPositions.startPosition?.endPosition ??
            null,
        }
      : withPositions.startPosition,
    startingPosition: withLetters.startingPosition
      ? {
          ...withLetters.startingPosition,
          startPosition:
            withLetters.startingPosition.startPosition ??
            withPositions.startingPosition?.startPosition ??
            null,
          endPosition:
            withLetters.startingPosition.endPosition ??
            withPositions.startingPosition?.endPosition ??
            null,
        }
      : withPositions.startingPosition,
  };

  const loopResult = loopDetector ? loopDetector.detectLOOPType(merged) : null;

  // gridMode: infer from the first beat whose motions decoded cleanly.
  // Using the start position's motions isn't reliable - at beat 0 the
  // encoded form may be a blank placeholder. Since the both-required flip
  // (2026-07-02) that placeholder is an invisible static MotionData, so the
  // donor scan must check VISIBILITY, not presence — otherwise a leading
  // blank beat always wins and donates gridMode derived from placeholder
  // locations (Wave 0 straggler fix, presence register site B).
  let gridMode: GridMode | undefined;
  for (const step of merged.steps) {
    if (
      isVisibleMotion(step.motions?.blue) &&
      isVisibleMotion(step.motions?.red)
    ) {
      gridMode = deriveGridMode(step.motions.blue, step.motions.red);
      break;
    }
  }

  return {
    ...merged,
    ...(loopResult && {
      isCircular: loopResult.isCircular,
      loopType: loopResult.loopType ?? undefined,
    }),
    ...(gridMode && { gridMode }),
    metadata: {
      ...merged.metadata,
      _hydratedAt: Date.now(),
    },
  };
}
