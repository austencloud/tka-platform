/**
 * Letter Deriver Service Implementation
 *
 * Derives letters from motion data for deep link sequences.
 * Uses motion query handler and grid mode deriver to match
 * motion configurations to their corresponding letters.
 *
 * Domain: Navigation - Letter Derivation
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import { normalizeLetter } from "$lib/shared/foundation/domain/models/letter";
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";
import { deriveGridMode } from "../../pictograph/grid/services/grid-mode-deriver";

export async function deriveLettersForSequence(
  sequence: SequenceData
): Promise<SequenceData> {
  // Derive letters for all steps in the sequence
  const stepsWithLetters = (await Promise.all(
    sequence.steps.map((step) => deriveLetterForBeat(step))
  )) as StepData[];

  // Derive letter for start position if it exists
  let updatedStartPosition: StartPositionData | null | undefined =
    sequence.startPosition;
  let updatedStartingPositionStep: StartPositionData | undefined =
    sequence.startingPosition;

  if (sequence.startPosition) {
    // Cast is safe - we pass StartPositionData so we get StartPositionData back
    updatedStartPosition = (await deriveLetterForBeat(
      sequence.startPosition
    )) as StartPositionData;
  }

  if (sequence.startingPosition) {
    // Cast is safe - we pass StartPositionData so we get StartPositionData back
    updatedStartingPositionStep = (await deriveLetterForBeat(
      sequence.startingPosition
    )) as StartPositionData;
  }

  // Build the word from the letters. Steps without a derived letter contribute
  // nothing to the word — that matches the codebase-wide convention
  // (word-deriver.deriveWordFromBeats skips unlettered steps) — but it must
  // never happen SILENTLY: a partial word like "GI" from a 12-step sequence
  // misrepresents the sequence everywhere it's displayed or saved. Warn with
  // counts so callers (and logs) can see the word is incomplete.
  const letters = stepsWithLetters.map((step) => step.letter ?? "");
  const missingCount = letters.filter((l) => l === "").length;
  if (missingCount > 0) {
    console.warn(
      `[letter-deriver] ${missingCount}/${letters.length} steps derived no letter — ` +
        `word "${letters.join("")}" omits them and is incomplete`
    );
  }
  // Letter identity includes both alphabet and case: Latin B and Greek β are
  // different TKA letters. Each beat is already canonical, so changing the
  // assembled word's case would change the sequence the title describes.
  const word = letters.join("");

  return {
    ...sequence,
    steps: stepsWithLetters,
    word,
    ...(updatedStartPosition !== undefined &&
      updatedStartPosition !== null && {
        startPosition: updatedStartPosition,
      }),
    ...(updatedStartingPositionStep !== undefined && {
      startingPosition: updatedStartingPositionStep,
    }),
  };
}

async function deriveLetterForBeat(
  beat: StepData | StartPositionData
): Promise<StepData | StartPositionData> {
  // Already lettered — but historical data may carry a legacy spelling
  // (e.g. "Γ" for "γ", written by the legacy import/repair scripts).
  // Normalize to canon instead of passing the alias downstream, where it
  // would crash getLetterType in the glyph renderer.
  if (beat.letter !== null) {
    const canonical = normalizeLetter(beat.letter);
    if (canonical && canonical !== beat.letter) {
      return { ...beat, letter: canonical as StepData["letter"] };
    }
    return beat;
  }

  // Skip if motions are missing — nothing to derive from
  if (!beat.motions.blue || !beat.motions.red) {
    return beat;
  }

  try {
    // Derive the correct grid mode from the motions
    const gridMode = deriveGridMode(beat.motions.blue, beat.motions.red);

    const letter = (await motionQueryHandler.findLetterByMotionConfiguration(
      beat.motions.blue,
      beat.motions.red,
      gridMode
    )) as StepData["letter"];

    if (letter) {
      return { ...beat, letter };
    } else {
      // Use appropriate identifier in warning
      const identifier =
        "stepNumber" in beat ? `beat ${beat.stepNumber}` : "start position";
      console.warn(
        `Could not derive letter for ${identifier} (gridMode: ${gridMode}) - no matching pictograph found`
      );
      return beat;
    }
  } catch (error) {
    // Use appropriate identifier in warning
    const identifier =
      "stepNumber" in beat ? `beat ${beat.stepNumber}` : "start position";
    console.warn(`Failed to derive letter for ${identifier}:`, error);
    return beat;
  }
}
