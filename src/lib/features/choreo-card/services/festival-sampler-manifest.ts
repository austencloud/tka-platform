export interface FestivalSamplerCardManifest {
  slot: string;
  source: "publicSequences" | "catalog" | "packLocal";
  id?: string;
  sourceRef?: string;
  catalogId?: string;
  docId?: string;
  name: string;
  familyId?: string;
  vtgFamily?: string;
  element?: string;
  ratio?: string;
  level?: number;
  sequenceLength?: number;
  loopType?: string | null;
  period?: number | null;
  turnIntensity?: number;
  turnPatternId?: string;
  turnPattern?: string;
}

export function festivalSamplerCardKey(
  card: FestivalSamplerCardManifest
): string {
  const identity =
    card.sourceRef ?? card.docId ?? card.id ?? `${card.slot}:${card.name}`;
  const variation = card.turnPattern
    ? `${card.turnPatternId ?? "custom"}:${card.turnPattern}`
    : `intensity-${card.turnIntensity ?? 0}`;
  return `${card.source}:${identity}:level-${card.level ?? 1}:turn-${variation}`;
}

export function festivalSamplerFingerprint(
  cards: readonly FestivalSamplerCardManifest[]
): string {
  return cards.map(festivalSamplerCardKey).join("|");
}

/**
 * Version the in-browser render cache from the complete frozen manifest. Card
 * fingerprints intentionally describe pack identity, while this revision also
 * changes when render metadata such as period, family, or labels changes.
 */
export function festivalSamplerManifestRevision(
  manifests: readonly {
    cards: readonly FestivalSamplerCardManifest[];
  }[]
): string {
  const serialized = JSON.stringify(manifests);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
