import type { Catalog } from "../domain/models/Catalog";
import { loadSequencesByIds } from "./catalog-loader";
import type { FamilyRatioGroup } from "./types";
import { TND_RATIO_TURNS_MAP } from "../domain/tnd-element";

export async function aggregateFamilySequences(
  familyId: string,
  catalogs: Catalog[],
): Promise<FamilyRatioGroup[]> {
  const catalogFamilyPairs = catalogs
    .map((catalog) => {
      const family = catalog.families.find((f) => f.id === familyId);
      return family ? { catalog, family } : null;
    })
    .filter(
      (pair): pair is NonNullable<typeof pair> => pair !== null,
    );

  const results = await Promise.all(
    catalogFamilyPairs.map(async ({ catalog, family }) => {
      const sequences = await loadSequencesByIds(
        catalog.id,
        family.sequenceIds as string[],
      );
      const ratio = catalog.name.match(/\((\d+:\d+)/)?.[1] ?? "?";
      const turns = TND_RATIO_TURNS_MAP[ratio] ?? 0;
      return { ratio, turns, sequences };
    }),
  );

  return results
    .filter((group) => group.sequences.length > 0)
    .sort((a, b) => a.turns - b.turns);
}
