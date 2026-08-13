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
  turnIntensity?: number;
}

export function festivalSamplerCardKey(
  card: FestivalSamplerCardManifest
): string {
  const identity =
    card.sourceRef ?? card.docId ?? card.id ?? `${card.slot}:${card.name}`;
  return `${card.source}:${identity}`;
}

export function festivalSamplerFingerprint(
  cards: readonly FestivalSamplerCardManifest[]
): string {
  return cards.map(festivalSamplerCardKey).join("|");
}
