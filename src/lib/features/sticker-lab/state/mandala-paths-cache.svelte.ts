import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import { calculate as calculateMandalaGeometry } from "$lib/shared/mandala/services/mandala-geometry-calculator";
import { getSequenceRepository } from "$lib/shared/create/getSequenceRepository";

const cache = $state<Record<string, MandalaPaths>>({});
const inFlight = new Map<string, Promise<MandalaPaths | null>>();

export function getPrimitivePaths(shapeHash: string): MandalaPaths | null {
  return cache[shapeHash] ?? null;
}

export async function loadPrimitivePaths(shapeHash: string): Promise<MandalaPaths | null> {
  if (cache[shapeHash]) return cache[shapeHash]!;
  const existing = inFlight.get(shapeHash);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const seq = await getSequenceRepository().getSequence(shapeHash);
      if (!seq?.steps) return null;
      const paths = calculateMandalaGeometry(seq.steps);
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

export function cachePrimitivePaths(shapeHash: string, paths: MandalaPaths): void {
  cache[shapeHash] = paths;
}

export function clearMandalaPathsCache(): void {
  for (const k of Object.keys(cache)) delete cache[k];
  inFlight.clear();
}
