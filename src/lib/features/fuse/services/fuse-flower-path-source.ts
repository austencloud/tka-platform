import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { CardVariation } from "$lib/features/choreo-card/domain/models/DeckRelease";
import { applyVariationDescriptor } from "$lib/features/choreo-card/services/deck-variation";
import { shiftStartPosition } from "$lib/shared/create/services/sequence-transforms";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  type Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  buildFlowerAxis,
  type Flower,
} from "$lib/shared/shape-matrix/domain/flower-signature";
import {
  applyFilter,
  defaultAxisFilter,
} from "$lib/shared/shape-matrix/domain/filter-flower-axis";
import { resolveFlowerArchetype } from "$lib/shared/shape-matrix/services/flower-archetype";
import { loadDiamondEdges } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import { buildFlowerSequence } from "$lib/features/lab/vtg-lab/services/build-flower-sequence";
import { resolveRotationStyleMatrices } from "$lib/features/lab/vtg-lab/services/resolve-rotation-style-matrices";
import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";

/**
 * The one-hand flower paths offered by Fuse. This is the canonical source for
 * both the Shape Path picker and four-count random generation, so choosing a
 * path and asking Fuse to generate one draw from the same vocabulary.
 */
export const FUSE_FLOWER_PATHS: readonly Flower[] = Object.freeze(
  applyFilter(buildFlowerAxis(), defaultAxisFilter(), true)
);

/**
 * Generation treats the flower and prop orientation as separate choices. The
 * `out` entries describe the same hand path with a different prop seed, so
 * retaining them here would make odd-petal paths twice as likely to be drawn.
 */
export const FUSE_GENERATED_FLOWER_SHAPES: readonly Flower[] = Object.freeze(
  FUSE_FLOWER_PATHS.filter((flower) => flower.ori === "in")
);

export interface FuseFlowerPathVariation {
  /** The authored beat that should become beat one. */
  readonly firstBeat?: number;
  /** The grid point that should become the path's first point. */
  readonly startLocation?: GridLocation;
  /** Prop orientation at the newly selected first beat. */
  readonly startOrientation?: Orientation;
}

let buildContextPromise: Promise<{
  matrices: Awaited<ReturnType<typeof resolveRotationStyleMatrices>>;
  edges: Awaited<ReturnType<typeof loadDiamondEdges>>;
}> | null = null;

async function loadBuildContext() {
  if (!buildContextPromise) {
    buildContextPromise = Promise.all([
      resolveRotationStyleMatrices("diamond"),
      loadDiamondEdges(),
    ])
      .then(([matrices, edges]) => ({ matrices, edges }))
      .catch((error) => {
        buildContextPromise = null;
        throw error;
      });
  }
  return buildContextPromise;
}

export async function buildFuseFlowerPath(
  flower: Flower,
  side: FuseSide,
  variation: FuseFlowerPathVariation = {}
): Promise<SequenceData> {
  const { matrices, edges } = await loadBuildContext();
  const archetype = resolveFlowerArchetype(matrices, flower.style);
  const flowerSequence = buildFlowerSequence(archetype, flower, side, edges);
  const color = side === "blue" ? MotionColor.BLUE : MotionColor.RED;
  const locationBeat = variation.startLocation
    ? flowerSequence.steps.findIndex(
        (step) => step.motions[color].startLocation === variation.startLocation
      ) + 1
    : 0;
  const firstBeat = locationBeat || variation.firstBeat;
  const rephased = firstBeat
    ? shiftStartPosition(flowerSequence, firstBeat)
    : flowerSequence;

  if (!variation.startOrientation) return rephased;

  const startOriPair =
    side === "blue"
      ? { blue: variation.startOrientation }
      : { red: variation.startOrientation };
  return applyVariationDescriptor(
    rephased,
    { startOriPair } satisfies CardVariation,
    edges
  ).sequence;
}
