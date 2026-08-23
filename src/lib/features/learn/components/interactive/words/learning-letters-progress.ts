import type { ExperienceState } from "../../../state/experience-persistence.svelte";

export const LEARNING_LETTERS_SCHEMA_VERSION = 2;

export interface LearningLettersProgress {
  schemaVersion: typeof LEARNING_LETTERS_SCHEMA_VERSION;
  selectedSequenceId: string;
  visitedSequenceIds: string[];
}

export interface NormalizedLearningLettersProgress {
  progress: LearningLettersProgress;
  migrated: boolean;
}

/**
 * Old Learning Letters builds stored quiz phases in the same concept slot.
 * Accept only the current schema, then fence every stored id to the live deck.
 */
export function normalizeLearningLettersProgress(
  saved: ExperienceState,
  validSequenceIds: readonly string[]
): NormalizedLearningLettersProgress {
  const firstSequenceId = validSequenceIds[0] ?? "";
  const phaseData = saved.phaseData;
  if (phaseData?.["schemaVersion"] !== LEARNING_LETTERS_SCHEMA_VERSION) {
    return {
      progress: {
        schemaVersion: LEARNING_LETTERS_SCHEMA_VERSION,
        selectedSequenceId: firstSequenceId,
        visitedSequenceIds: firstSequenceId ? [firstSequenceId] : [],
      },
      migrated: true,
    };
  }

  const validIds = new Set(validSequenceIds);
  const storedSelected = phaseData["selectedSequenceId"];
  const selectedSequenceId =
    typeof storedSelected === "string" && validIds.has(storedSelected)
      ? storedSelected
      : firstSequenceId;
  const storedVisited = Array.isArray(phaseData["visitedSequenceIds"])
    ? phaseData["visitedSequenceIds"]
    : [];
  const visitedSequenceIds = [
    ...new Set(
      storedVisited.filter(
        (id): id is string => typeof id === "string" && validIds.has(id)
      )
    ),
  ];
  if (selectedSequenceId && !visitedSequenceIds.includes(selectedSequenceId)) {
    visitedSequenceIds.push(selectedSequenceId);
  }

  const migrated =
    saved.step !== 1 ||
    selectedSequenceId !== storedSelected ||
    visitedSequenceIds.length !== storedVisited.length;
  return {
    progress: {
      schemaVersion: LEARNING_LETTERS_SCHEMA_VERSION,
      selectedSequenceId,
      visitedSequenceIds,
    },
    migrated,
  };
}

export function nextUnvisitedSequenceIndex(
  selectedIndex: number,
  sequenceIds: readonly string[],
  visitedSequenceIds: ReadonlySet<string>
): number {
  for (let offset = 1; offset <= sequenceIds.length; offset += 1) {
    const candidateIndex = (selectedIndex + offset) % sequenceIds.length;
    const candidateId = sequenceIds[candidateIndex];
    if (candidateId && !visitedSequenceIds.has(candidateId)) {
      return candidateIndex;
    }
  }
  return -1;
}
