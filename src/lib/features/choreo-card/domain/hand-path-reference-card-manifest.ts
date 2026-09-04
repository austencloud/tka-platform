export type HandPathReferenceCardId = "ss" | "ts" | "so" | "to" | "qo" | "qs";

export interface HandPathReferenceCardDefinition {
  id: HandPathReferenceCardId;
  familyId: string;
  name: string;
  cardTitle: string;
  timing: "Split" | "Together" | "Quarter";
  direction: "Same" | "Opposite";
}

/** The manifest revision for the first six-card physical reference deck. */
export const HAND_PATH_REFERENCE_CARD_VERSION = 1;

export const HAND_PATH_REFERENCE_CARD_DEFINITIONS = [
  {
    id: "ss",
    familyId: "split-same",
    name: "Split-Same",
    cardTitle: "Split-Same",
    timing: "Split",
    direction: "Same",
  },
  {
    id: "ts",
    familyId: "tog-same",
    name: "Together-Same",
    cardTitle: "Tog-Same",
    timing: "Together",
    direction: "Same",
  },
  {
    id: "so",
    familyId: "split-opp",
    name: "Split-Opposite",
    cardTitle: "Split-Opp",
    timing: "Split",
    direction: "Opposite",
  },
  {
    id: "to",
    familyId: "tog-opp",
    name: "Together-Opposite",
    cardTitle: "Tog-Opp",
    timing: "Together",
    direction: "Opposite",
  },
  {
    id: "qo",
    familyId: "quarter-opp",
    name: "Quarter-Opposite",
    cardTitle: "Quarter-Opp",
    timing: "Quarter",
    direction: "Opposite",
  },
  {
    id: "qs",
    familyId: "quarter-same",
    name: "Quarter-Same",
    cardTitle: "Quarter-Same",
    timing: "Quarter",
    direction: "Same",
  },
] as const satisfies readonly HandPathReferenceCardDefinition[];

export const HAND_PATH_REFERENCE_CARD_IDS: readonly HandPathReferenceCardId[] =
  HAND_PATH_REFERENCE_CARD_DEFINITIONS.map((definition) => definition.id);

export function getHandPathReferenceDefinition(
  id: HandPathReferenceCardId
): HandPathReferenceCardDefinition {
  const definition = HAND_PATH_REFERENCE_CARD_DEFINITIONS.find(
    (candidate) => candidate.id === id
  );
  if (!definition) throw new Error(`Missing hand-path reference card ${id}`);
  return definition;
}

export function getHandPathReferenceDefinitionNotes(
  definition: HandPathReferenceCardDefinition
): string {
  return `${definition.timing} time, ${definition.direction.toLowerCase()} direction.`;
}
