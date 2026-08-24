import type { ExperienceState } from "../../../state/experience-persistence.svelte";

export const LEARNING_LETTERS_SCHEMA_VERSION = 3;

/**
 * The six words the guide's Alpha/Beta Words page (lt1-abc-ghi) teaches, in
 * the guide's own order: the α block (Start = α), then the β block (Start = β).
 * The lesson walks these one at a time before revealing the full deck.
 */
export const LEARNING_LETTERS_CORE_WORDS = [
  "AAAA",
  "BBBB",
  "CCCC",
  "GGGG",
  "HHHH",
  "IIII",
] as const;

/** Intro step + one step per core word + the full-deck capstone. */
export const LEARNING_LETTERS_TOTAL_STEPS =
  LEARNING_LETTERS_CORE_WORDS.length + 2;

export interface LearningLettersProgress {
  schemaVersion: typeof LEARNING_LETTERS_SCHEMA_VERSION;
  stepIndex: number;
  selectedSequenceId: string;
  visitedSequenceIds: string[];
}

export interface NormalizedLearningLettersProgress {
  progress: LearningLettersProgress;
  migrated: boolean;
}

/**
 * Older Learning Letters builds stored quiz phases (v1) or the single-screen
 * deck browser (v2) in the same concept slot. Accept only the current schema,
 * then fence the stored step to the lesson and every stored id to the live
 * deck.
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
        stepIndex: 0,
        selectedSequenceId: firstSequenceId,
        visitedSequenceIds: [],
      },
      migrated: true,
    };
  }

  const storedStep = saved.step;
  const stepIndex = Math.min(
    LEARNING_LETTERS_TOTAL_STEPS - 1,
    Math.max(0, storedStep - 1)
  );

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

  // Keys outside the v3 shape are residue from a rejected build
  // (e.g. questionIndex) — flag them so the caller rewrites a clean slot.
  const knownKeys = new Set([
    "schemaVersion",
    "selectedSequenceId",
    "visitedSequenceIds",
  ]);
  const hasForeignKeys = Object.keys(phaseData).some(
    (key) => !knownKeys.has(key)
  );

  const migrated =
    hasForeignKeys ||
    storedStep !== stepIndex + 1 ||
    selectedSequenceId !== storedSelected ||
    visitedSequenceIds.length !== storedVisited.length;
  return {
    progress: {
      schemaVersion: LEARNING_LETTERS_SCHEMA_VERSION,
      stepIndex,
      selectedSequenceId,
      visitedSequenceIds,
    },
    migrated,
  };
}
