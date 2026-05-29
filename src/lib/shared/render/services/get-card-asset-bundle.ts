// src/lib/shared/render/services/get-card-asset-bundle.ts
//
// MAIN-THREAD entry point for building an AssetBundle before dispatching to the
// worker pool. Supplies the real prepare-pass so the heavy pictograph-preparer
// dependency is NOT pulled into worker/unit bundles (buildAssetBundle accepts
// `prepareDeck` as an injection seam).

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { pictographPreparer } from "$lib/shared/pictograph/shared/services/pictograph-preparer";
import { buildAssetBundle, type AssetBundle } from "./card-asset-bundle";

/**
 * Flatten a deck's steps + start position into the PictographData[] that
 * `prepareBatch` expects. StepData and StartPositionData both extend
 * PictographData directly, so no cast is required.
 */
function deckPictographs(sequences: SequenceData[]): PictographData[] {
  const out: PictographData[] = [];
  for (const seq of sequences) {
    if (seq.startPosition) out.push(seq.startPosition);
    for (const step of seq.steps ?? []) out.push(step);
  }
  return out;
}

/**
 * MAIN THREAD. Runs a prepare-pass over every pictograph in the deck (warming
 * the singleton SVG caches), then delegates to `buildAssetBundle` to snapshot
 * the caches as transferable ImageBitmaps for the worker pool.
 */
export function getCardAssetBundle(
  sequences: SequenceData[],
  opts: { bluePropType: PropType; redPropType: PropType; theme: string },
): Promise<AssetBundle> {
  return buildAssetBundle(sequences, opts, async (seqs, o) => {
    await pictographPreparer.prepareBatch(deckPictographs(seqs), {
      themeMode: "light",
      bluePropType: o.bluePropType,
      redPropType: o.redPropType,
    });
  });
}
