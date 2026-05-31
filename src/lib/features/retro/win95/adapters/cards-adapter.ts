/**
 * Cards Adapter
 *
 * Loads sequences from the user's library and formats them as choreo cards
 * for CARDS.EXE. Reuses the step-to-retro conversion from notation-adapter
 * rather than duplicating it.
 *
 * Domain: Retro CARDS App
 */

import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import {
  GridMode,
  GridLocation,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { getLibraryRepository } from "$lib/shared/library/get-library-repository";

import type {
  RetroPictographData,
  RetroHandData,
} from "../../shared/domain/pictograph-types";

export interface RetroCard {
  id: string;
  word: string;
  beats: RetroPictographData[];
  constraint?: string;
  date: string; // MM/DD/YY format
  notes?: string;
}

/**
 * Convert a single MotionData from the real engine into a RetroHandData
 * for the pixel renderer.
 *
 * Mirrors the same function in notation-adapter. Both adapters operate on
 * the same MotionData shape, so the mapping is identical - kept here to
 * avoid a cross-adapter import that would couple two unrelated concerns.
 */
function motionToRetroHand(motion: MotionData): RetroHandData {
  return {
    color: motion.color,
    location: motion.startLocation,
    orientation: motion.startOrientation,
    motionType: motion.motionType,
    endLocation: motion.endLocation,
    turns: typeof motion.turns === "number" ? motion.turns : 0,
    rotationDirection: motion.rotationDirection,
  };
}

/**
 * Fallback hand data when a motion is missing from a step.
 * Produces a static hand at north with no rotation.
 */
function fallbackHand(color: MotionColor): RetroHandData {
  return {
    color,
    location: GridLocation.NORTH,
    orientation: Orientation.IN,
    motionType: MotionType.STATIC,
    endLocation: GridLocation.NORTH,
    turns: 0,
    rotationDirection: RotationDirection.NO_ROTATION,
  };
}

/**
 * Convert a sequence's steps array to the RetroPictographData list the
 * pixel renderer expects - one entry per beat.
 */
function convertStepsToRetro(steps: readonly StepData[]): RetroPictographData[] {
  return steps.map((step) => {
    const blueMotion = step.motions[MotionColor.BLUE];
    const redMotion = step.motions[MotionColor.RED];

    return {
      letter: step.letter ?? "?",
      gridMode: step.gridMode ?? GridMode.DIAMOND,
      blueHand: blueMotion
        ? motionToRetroHand(blueMotion)
        : fallbackHand(MotionColor.BLUE),
      redHand: redMotion
        ? motionToRetroHand(redMotion)
        : fallbackHand(MotionColor.RED),
    };
  });
}

/**
 * Format a JS Date as MM/DD/YY - the DOS-era date style shown on each card.
 */
function formatDosDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const y = String(date.getFullYear()).slice(2);
  return `${m}/${d}/${y}`;
}

/**
 * Map a LibrarySequence to a RetroCard for display in CARDS.EXE.
 */
function librarySequenceToRetroCard(seq: LibrarySequence): RetroCard {
  // Prefer the user's intended word over the expanded word (which may include bridge letters)
  const word = seq.intendedWord || seq.word || seq.name || "???";

  // createdAt on LibrarySequence is always a real Date (not a Firestore Timestamp)
  // because the repository hydrates it. Fall back to now if somehow absent.
  const date = seq.createdAt instanceof Date
    ? seq.createdAt
    : new Date();

  return {
    id: seq.id,
    word,
    beats: convertStepsToRetro(seq.steps ?? []),
    constraint: seq.difficultyLevel || undefined,
    date: formatDosDate(date),
    notes: seq.notes || undefined,
  };
}

/**
 * Load real sequences from the user's library, sorted newest-first,
 * and format them as choreo cards for CARDS.EXE.
 */
export async function loadCards(): Promise<RetroCard[]> {
  const repo = getLibraryRepository();

  const sequences = await repo.getSequences({
    sortBy: "updatedAt",
    sortDirection: "desc",
  });

  return sequences
    .filter((seq) => !seq.isDeleted)
    .map(librarySequenceToRetroCard);
}
