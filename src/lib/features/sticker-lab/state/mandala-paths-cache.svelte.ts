import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import { MandalaGeometryCalculator } from "$lib/shared/mandala/services/implementations/MandalaGeometryCalculator";
import { getCatalogEntry, loadPrimitiveCatalog } from "../services/implementations/PrimitiveCatalogReader";
// Cross-feature import: DI index uses the same path (no shared re-export exists).
// Stage B will replace this with MandalaPrimitiveRegistry.getPaths(), removing the dependency.
import { getSequenceRepository } from "$lib/features/create/shared/getSequenceRepository";

/**
 * Mandala paths cache keyed by shapeHash.
 *
 * Stage A loading strategy:
 * 1. If catalog entry has pre-baked paths (Stage B), return them immediately.
 * 2. Otherwise treat shapeHash as a sequenceId proxy and fetch via the
 *    sequence repository + MandalaGeometryCalculator (Stage A fallback).
 *
 * Stage B: step 2 is replaced by MandalaPrimitiveRegistry.getPaths(shapeHash).
 */
const cache = $state<Record<string, MandalaPaths>>({});
const inFlight = new Map<string, Promise<MandalaPaths | null>>();
const calculator = new MandalaGeometryCalculator();

/** Synchronous peek - returns cached paths or null. */
export function getPrimitivePaths(shapeHash: string): MandalaPaths | null {
  return cache[shapeHash] ?? null;
}

/**
 * Async load - populates cache for the given shapeHash.
 * Safe to call repeatedly; concurrent calls for the same hash share a promise.
 */
export async function loadPrimitivePaths(shapeHash: string): Promise<MandalaPaths | null> {
  if (cache[shapeHash]) return cache[shapeHash]!;
  const existing = inFlight.get(shapeHash);
  if (existing) return existing;

  const promise = (async () => {
    try {
      await loadPrimitiveCatalog();
      const entry = getCatalogEntry(shapeHash);

      // Stage B: pre-baked paths - use directly.
      if (entry?.paths) {
        cache[shapeHash] = entry.paths;
        return entry.paths;
      }

      // Stage A fallback: shapeHash is a sequenceId proxy.
      const sequenceId = entry?.sourceLoop?.sequenceId ?? shapeHash;
      const seq = await getSequenceRepository().getSequence(sequenceId);
      if (!seq?.steps) return null;
      const paths = calculator.calculate(seq.steps);
      cache[shapeHash] = paths;
      return paths;
    } catch (err) {
      console.error(`[mandala-paths-cache] load failed for ${shapeHash}:`, err);
      return null;
    } finally {
      inFlight.delete(shapeHash);
    }
  })();

  inFlight.set(shapeHash, promise);
  return promise;
}

export function clearMandalaPathsCache(): void {
  for (const k of Object.keys(cache)) delete cache[k];
  inFlight.clear();
}
