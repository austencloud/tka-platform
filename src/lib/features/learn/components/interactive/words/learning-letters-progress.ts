import type { ExperienceState } from "../../../state/experience-persistence.svelte";

export const LEARNING_LETTERS_SCHEMA_VERSION = 4;

/**
 * The six words the guide's Alpha/Beta Words page (lt1-abc-ghi) teaches, in
 * the guide's own order: the α block (Start = α), then the β block (Start = β).
 * The lesson walks these one at a time before recapping only these six words.
 */
export const LEARNING_LETTERS_CORE_WORDS = [
  "AAAA",
  "BBBB",
  "CCCC",
  "GGGG",
  "HHHH",
  "IIII",
] as const;

/** Intro step + one step per core word + the six-word recap. */
export const LEARNING_LETTERS_TOTAL_STEPS =
  LEARNING_LETTERS_CORE_WORDS.length + 2;

export interface LearningLettersProgress {
  schemaVersion: typeof LEARNING_LETTERS_SCHEMA_VERSION;
  stepIndex: number;
}

export interface NormalizedLearningLettersProgress {
  progress: LearningLettersProgress;
  migrated: boolean;
}

/**
 * Older Learning Letters builds stored quiz phases (v1), the single-screen
 * deck browser (v2), or full-deck selection state (v3) in the same concept
 * slot. The v3 step is still meaningful in this lesson, so preserve it while
 * stripping its retired sequence ids. Earlier shapes restart at the intro.
 */
export function normalizeLearningLettersProgress(
  saved: ExperienceState
): NormalizedLearningLettersProgress {
  const phaseData = saved.phaseData;
  const storedSchema = phaseData?.["schemaVersion"];
  const canPreserveStep =
    storedSchema === 3 || storedSchema === LEARNING_LETTERS_SCHEMA_VERSION;
  if (!canPreserveStep || !phaseData) {
    return {
      progress: {
        schemaVersion: LEARNING_LETTERS_SCHEMA_VERSION,
        stepIndex: 0,
      },
      migrated: true,
    };
  }

  const storedStep = saved.step;
  const stepIndex = Math.min(
    LEARNING_LETTERS_TOTAL_STEPS - 1,
    Math.max(0, storedStep - 1)
  );

  // The step itself lives in ExperienceState. Current phase data has only the
  // schema marker, so old selection state and rejected quiz keys are residue.
  const knownKeys = new Set(["schemaVersion"]);
  const hasForeignKeys = Object.keys(phaseData).some(
    (key) => !knownKeys.has(key)
  );

  const migrated =
    storedSchema !== LEARNING_LETTERS_SCHEMA_VERSION ||
    hasForeignKeys ||
    storedStep !== stepIndex + 1;
  return {
    progress: {
      schemaVersion: LEARNING_LETTERS_SCHEMA_VERSION,
      stepIndex,
    },
    migrated,
  };
}
