import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  TND_BASE_CATALOG_ID,
  buildTnDSeedClasses,
  getTnDFamilyOptions,
  buildTnDCards,
} from "$lib/features/choreo-card/services/deck-composer";
import { loadCatalogSequences } from "$lib/features/choreo-card/services/catalog-loader";
import { resolveDeckSequences } from "$lib/features/choreo-card/services/deck-variation";
import { loadDiamondEdges } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import { allTurnPatterns, groupCardsBySeed, type SeedMatrix } from "../domain/tnd-turn-patterns";

/**
 * For one TnD family (diamond), return its base seeds each with the full 7x7
 * turn grid resolved to SequenceData. Mirrors the deck-releaser TnD compose path
 * (deck-composer + deck-variation) so the cards are exactly what production ships.
 */
export async function resolveTnDFamilyCards(familyId: string): Promise<SeedMatrix[]> {
  const baseSeqs = await loadCatalogSequences(TND_BASE_CATALOG_ID);
  const seedClasses = buildTnDSeedClasses(baseSeqs);
  const families = getTnDFamilyOptions(seedClasses, ["diamond"]);
  const family = families.find((f) => f.familyId === familyId);
  if (!family) return [];

  const patterns = new Set(allTurnPatterns());
  const cards = buildTnDCards(families, new Set([familyId]), patterns, ["radial"]);
  if (cards.length === 0) return [];

  const baseByKey = new Map<string, SequenceData>();
  for (const s of baseSeqs) baseByKey.set(`${TND_BASE_CATALOG_ID}::${s.id}`, s);

  const edges = await loadDiamondEdges();
  const resolved = resolveDeckSequences(cards, baseByKey, edges);
  return groupCardsBySeed(cards, resolved);
}
