import type { Catalog } from "../domain/models/Catalog";
import { loadSequencesByIds } from "./catalog-loader";
import { loadDiamondEdges } from "./pictograph-letter-lookup";
import { applyVariationDescriptor } from "./deck-variation";
import { TND_BASE_CATALOG_ID } from "./deck-composer";
import type { FamilyRatioGroup } from "./types";
import { TND_RATIO_TURNS_MAP } from "../domain/tnd-element";

/**
 * All symmetric ratio variants of one family, derived from the zero-turn base
 * catalog at render time (no materialized decks). Each ratio applies a uniform
 * `turns|turns` pattern to every base sequence.
 */
export async function aggregateFamilySequences(
  familyId: string,
  catalogs: Catalog[],
): Promise<FamilyRatioGroup[]> {
  const base = catalogs.find((c) => c.id === TND_BASE_CATALOG_ID);
  if (!base) return [];
  const family = base.families.find((f) => f.id === familyId);
  if (!family || family.sequenceIds.length === 0) return [];

  const baseSeqs = await loadSequencesByIds(base.id, family.sequenceIds as string[]);
  const edges = await loadDiamondEdges();

  const groups: FamilyRatioGroup[] = [];
  for (const [ratio, turns] of Object.entries(TND_RATIO_TURNS_MAP)) {
    const pattern = `${turns}|${turns}`;
    const sequences = baseSeqs.map(
      (s) => applyVariationDescriptor(s, { turnPattern: pattern }, edges).sequence,
    );
    groups.push({ ratio, turns, sequences });
  }
  return groups.sort((a, b) => a.turns - b.turns);
}
