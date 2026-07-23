/**
 * Start First Sequence (SP3, Part A)
 *
 * Headless generate -> load -> keep command that powers the one-tap starter
 * offered to a user with an empty workspace and an empty library. Pure
 * orchestration over injected dependencies so it's testable without any
 * Svelte/DOM/network machinery and so the eligibility/UI layer (Part A's
 * offer card) can stay a thin caller.
 *
 * Sequencing is load-before-save on purpose: the point of the starter is to
 * land something in the real workspace the user can see and keep editing,
 * not just to produce a library row. If save fails after a successful
 * generate+load, the user still has a live sequence on screen to work with
 * (persist-failed is reported, but the workspace isn't rolled back).
 *
 * Guest hand-off mirrors the existing first-save activation flow (SP3, Part
 * B): only a persisted GUEST keep queues postSaveActivation - a full-account
 * keep has nothing to activate.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { GenerationOptions } from "$lib/features/create/generate/shared/domain/models/generate-models";
import { DifficultyLevel } from "$lib/features/create/generate/shared/domain/models/generate-models";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";

/** Fixed length for the one-tap starter. Short enough to generate fast and
 *  read as approachable, not a commitment. */
const STARTER_LENGTH = 4;

export type StartFirstSequenceResult =
  | { status: "generated-kept"; sequenceId: string }
  | { status: "generate-failed" }
  | { status: "persist-failed" };

export interface StartFirstSequenceDeps {
  /** Runs generation and returns the built sequence. Thrown errors and an
   *  empty-step result both map to "generate-failed". */
  generate: () => Promise<SequenceData>;
  /** Loads the generated sequence into the real, visible workspace. Called
   *  BEFORE save so the user has something on screen even if persistence
   *  fails afterward. */
  loadIntoWorkspace: (sequence: SequenceData) => void;
  /** Persists the sequence to the library. Thrown errors and a
   *  `persisted: false` result both map to "persist-failed". */
  save: (
    sequence: SequenceData
  ) => Promise<{ persisted: boolean; isGuest: boolean; sequenceId: string }>;
  /** Guest first-save hand-off (SP3 Part B). Called only when the save
   *  succeeded AND the saving user was a guest. */
  onKept: (sequenceId: string) => void;
}

/**
 * Runs the full generate -> load -> keep flow. Never throws - every failure
 * mode is a typed result the caller renders directly (no exception handling
 * needed at the call site).
 */
export async function startFirstSequence(
  deps: StartFirstSequenceDeps
): Promise<StartFirstSequenceResult> {
  let sequence: SequenceData;
  try {
    sequence = await deps.generate();
  } catch {
    return { status: "generate-failed" };
  }

  if (!sequence.steps || sequence.steps.length === 0) {
    return { status: "generate-failed" };
  }

  // Load first: the user gets a working sequence in the real workspace even
  // if the save step below fails.
  deps.loadIntoWorkspace(sequence);

  let result: { persisted: boolean; isGuest: boolean; sequenceId: string };
  try {
    result = await deps.save(sequence);
  } catch {
    return { status: "persist-failed" };
  }

  if (!result.persisted) {
    return { status: "persist-failed" };
  }

  if (result.isGuest) {
    deps.onKept(result.sequenceId);
  }

  return { status: "generated-kept", sequenceId: result.sequenceId };
}

/**
 * Fixed starter preset: double staves, diamond grid, smooth constraint
 * (reliable beam-search builder per sequence-generation.md), beginner
 * difficulty. Deliberately does NOT read createGenerationConfigState - that
 * state is device-global and can carry another account's saved prop/settings
 * on a shared machine, which would make the "starter" surprise-generate with
 * whatever the last signed-in user configured.
 */
function buildStarterOptions(): GenerationOptions {
  return {
    length: STARTER_LENGTH,
    gridMode: GridMode.DIAMOND,
    propType: PropType.STAFF,
    difficulty: DifficultyLevel.BEGINNER,
    constraintPreset: "smooth",
  };
}

/**
 * Builds the `generate` dependency for {@link startFirstSequence}. The
 * orchestrator import is lazy (inside the returned closure, not at module
 * load) so opening the empty-workspace offer card never pulls the
 * generation engine into the initial Construct bundle - only tapping the
 * button does.
 */
export function buildStarterGenerate(): () => Promise<SequenceData> {
  return async () => {
    const { getGenerationOrchestrator } = await import(
      "$lib/features/create/generate/shared/get-generation-orchestrator"
    );
    const sequence = await getGenerationOrchestrator().generateSequence(
      buildStarterOptions()
    );
    return {
      ...sequence,
      word: simplifyRepeatedWord(sequence.word ?? ""),
    };
  };
}
