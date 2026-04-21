import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import { MandalaGeometryCalculator } from "$lib/shared/mandala/services/implementations/MandalaGeometryCalculator";
import { container } from "$lib/shared/di";

/**
 * Mandala paths cache keyed by sequenceId.
 *
 * The sequence repository is async (container.items.sequenceRepository.getSequence
 * returns a Promise<SequenceData | null>). Render paths need a synchronous peek,
 * so callers use getMandalaPaths() to read cached paths (null on miss) and
 * loadMandalaPaths() to populate the cache. When the $state-backed cache is
 * populated, any Svelte component reading through getMandalaPaths re-renders.
 */
const cache = $state<Record<string, MandalaPaths>>({});
const inFlight = new Map<string, Promise<MandalaPaths | null>>();
const calculator = new MandalaGeometryCalculator();

/** Synchronous peek — returns cached paths or null. Used by render paths. */
export function getMandalaPaths(sequenceId: string): MandalaPaths | null {
  return cache[sequenceId] ?? null;
}

/**
 * Async load — fetches the sequence, computes its mandala paths, and populates
 * the cache. Safe to call repeatedly; concurrent calls for the same id share a
 * single in-flight promise.
 */
export async function loadMandalaPaths(sequenceId: string): Promise<MandalaPaths | null> {
  if (cache[sequenceId]) return cache[sequenceId]!;
  const existing = inFlight.get(sequenceId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const seq = await container.items.sequenceRepository.getSequence(sequenceId);
      if (!seq?.steps) return null;
      const paths = calculator.calculate(seq.steps);
      cache[sequenceId] = paths;
      return paths;
    } catch (err) {
      console.error(`[mandala-paths-cache] load failed for ${sequenceId}:`, err);
      return null;
    } finally {
      inFlight.delete(sequenceId);
    }
  })();
  inFlight.set(sequenceId, promise);
  return promise;
}

export function clearMandalaPathsCache(): void {
  for (const k of Object.keys(cache)) delete cache[k];
  inFlight.clear();
}
