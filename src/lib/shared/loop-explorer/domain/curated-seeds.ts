/**
 * Loop Explorer — Curated Seed Pool (fallback)
 *
 * `curated-seeds.json` is verification-harness output, not persisted app
 * data. Its compact wire shape predates canonical `SequenceData`: steps carry
 * `blueMotion` / `redMotion`, positions are strings, and view-layer defaults
 * are omitted. Keep that distinction explicit at this boundary. Casting the
 * JSON straight to `SequenceData` lets those strings reach the animation
 * engine as if they were `StartPositionData` objects.
 *
 * Seeds hydrate on demand and cache by pool position. Editorial routes import
 * the dedicated teaser fixture instead, so this complete fallback corpus is
 * only parsed when the Loop Explorer itself needs it.
 */

import curatedSeedsJson from "./curated-seeds.json";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import {
  hydrateCuratedSequence,
  type CuratedSequenceWire,
} from "./curated-seed-hydrator";
import type { LoopSlice } from "./legality";

type CuratedSeedsWire = Record<
  string,
  Partial<Record<LoopSlice, readonly CuratedSequenceWire[]>>
>;

const RAW = curatedSeedsJson as unknown as CuratedSeedsWire;
const cache = new Map<string, SequenceData | null>();

function hydrateAt(
  loopType: LOOPType,
  slice: LoopSlice,
  index: number
): SequenceData | null {
  const key = `${loopType}:${slice}:${index}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const wire = RAW[loopType]?.[slice]?.[index];
  if (!wire) {
    cache.set(key, null);
    return null;
  }

  try {
    const sequence = hydrateCuratedSequence(wire, loopType, slice, index);
    cache.set(key, sequence);
    return sequence;
  } catch (error) {
    console.error(`[curated-seeds] rejected ${key}`, error);
    cache.set(key, null);
    return null;
  }
}

/** Deterministic accessor for SSR/editorial surfaces. */
export function getCuratedSeed(
  loopType: LOOPType,
  slice: LoopSlice,
  index = 0
): SequenceData | null {
  return hydrateAt(loopType, slice, index);
}

/**
 * Picks a verified fallback for the explorer. If one entry is malformed,
 * continue through the pool instead of turning a single bad fixture into a
 * page-level failure.
 */
export function findCuratedSeed(
  loopType: LOOPType,
  slice: LoopSlice
): SequenceData | null {
  const pool = RAW[loopType]?.[slice];
  if (!pool?.length) return null;

  const startIndex = Math.floor(Math.random() * pool.length);
  for (let offset = 0; offset < pool.length; offset += 1) {
    const sequence = hydrateAt(
      loopType,
      slice,
      (startIndex + offset) % pool.length
    );
    if (sequence) return sequence;
  }

  return null;
}
