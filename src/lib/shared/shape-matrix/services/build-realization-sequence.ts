import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { loadCatalogSequences } from "$lib/features/choreo-card/services/catalog-loader";
import { TND_BASE_CATALOG_ID } from "$lib/features/choreo-card/services/deck-composer";
import { buildBaseIndex } from "./tnd-base-index";

/**
 * Firestore loader for the shape-matrix base-word index (app path).
 *
 * The pure index builder (`buildBaseIndex`/`resolveBase`) lives in
 * `tnd-base-index.ts` (no Firebase) and is re-exported here so existing
 * consumers keep importing it from this module. The firebase-free landing hero
 * pool builds its index from statically-baked words instead of calling this.
 */
export { buildBaseIndex, resolveBase } from "./tnd-base-index";

let baseIndex: Map<string, SequenceData> | null = null;
export async function loadBaseIndex(): Promise<Map<string, SequenceData>> {
  if (!baseIndex) baseIndex = buildBaseIndex(await loadCatalogSequences(TND_BASE_CATALOG_ID));
  return baseIndex;
}
