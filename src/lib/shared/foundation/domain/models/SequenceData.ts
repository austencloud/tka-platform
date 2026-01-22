import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { TimeSignatureKey } from "./TimeSignature";
/**
 * Sequence Domain Model
 *
 * Immutable data structure for complete kinetic sequences.
 * Based on the modern desktop app's SequenceData but adapted for TypeScript.
 *
 * MIGRATION NOTE: Start position now uses StartPositionData type instead of StepData.
 * The steps array should only contain actual steps (stepNumber >= 1), never start position.
 */

import type { StepData } from "../../../../features/create/shared/domain/models/StepData";
import type { StartPositionData } from "../../../../features/create/shared/domain/models/StartPositionData";
import type { GridPositionGroup } from "../../../pictograph/grid/domain/enums/grid-enums";
import type { PropType } from "../../../pictograph/prop/domain/enums/PropType";
import type { LOOPType } from "../../../../features/create/generate/circular/domain/models/circular-models";

export interface SequenceData {
  readonly id: string;
  readonly name: string;
  /** User's custom display name (optional). When set, shown as primary name in UI. */
  readonly displayName?: string;
  /** TKA word - auto-generated from sequence letters, immutable */
  readonly word: string;
  readonly steps: readonly StepData[]; // Only actual steps (stepNumber >= 1), never start position

  // Start position storage (CONSOLIDATED):
  // Start positions are semantically distinct from steps - they have no duration, no beat number,
  // and represent the initial static prop configuration before the sequence begins.
  readonly startPosition?: StartPositionData;
  readonly startingPosition?: StartPositionData; // Legacy field name, same type
  readonly startingPositionGroup?: GridPositionGroup; // Position group metadata: "alpha", "beta", "gamma"

  readonly thumbnails: readonly string[];
  readonly sequenceLength?: number;
  readonly author?: string;
  readonly level?: number;
  readonly dateAdded?: Date;
  /** Original creation date of the sequence (never changes after being set) */
  readonly birthday?: Date;
  /** When this library entry was created */
  readonly createdAt?: Date;
  readonly gridMode?: GridMode;
  /** Time signature for this sequence (overrides global default). */
  readonly timeSignature?: TimeSignatureKey;
  // NOTE: propType removed - prop type is a viewer preference, not sequence data
  // Each motion stores its own propType, and rendering uses viewer's settings
  /**
   * @deprecated Use ICollectionManager.isFavorite(sequenceId) instead.
   * Favorites are now stored as collection membership, not as a boolean flag.
   * This field is kept for backwards compatibility during migration.
   */
  readonly isFavorite: boolean;
  readonly isCircular: boolean;
  /**
   * LOOP type - Linked Orbital Offset Pattern (TKA's algorithmic extension patterns)
   * Formerly known as LOOP type (Continuous Assembly Pattern).
   */
  readonly loopType?: LOOPType | null;
  /** Number of sequence repetitions needed to return to starting orientation (1, 2, or 4) */
  readonly orientationCycleCount?: 1 | 2 | 4;
  readonly difficultyLevel?: string;
  readonly tags: readonly string[];
  readonly metadata: Record<string, unknown>;

  // Equivalence detection fields
  /** Computed hash identifying the motion pattern (rotation-invariant) */
  readonly canonicalSignature?: string;
  /** Beats offset from canonical form (for circular sequences) */
  readonly canonicalOffset?: number;

  // Owner info (populated for public sequences)
  readonly ownerId?: string;
  readonly ownerDisplayName?: string;
  readonly ownerAvatarUrl?: string;

  // Video/animation storage
  /** Firebase Storage URL to user's performance video */
  readonly performanceVideoUrl?: string;
  /** Firebase Storage URL to animated WebP/GIF */
  readonly animatedSequenceUrl?: string;
  /** Format of the animated sequence */
  readonly animationFormat?: "webp" | "gif";
  /** Storage path for performance video (for deletion) */
  readonly performanceVideoPath?: string;
  /** Storage path for animated sequence (for deletion) */
  readonly animatedSequencePath?: string;
}

/**
 * Normalize step data to ensure motions are in the correct format.
 * Handles legacy data where 'blue' and 'red' are at the top level instead of inside 'motions'.
 */
function normalizeStepData(step: Record<string, unknown>): StepData {
  // If step already has motions with data, return as-is
  const existingMotions = step.motions as Record<string, unknown> | undefined;
  if (existingMotions && (existingMotions.blue || existingMotions.red)) {
    return step as unknown as StepData;
  }

  // Check for legacy format: 'blue' and 'red' at top level
  const legacyBlue = step.blue as Record<string, unknown> | undefined;
  const legacyRed = step.red as Record<string, unknown> | undefined;

  if (legacyBlue || legacyRed) {
    // Convert legacy format to modern format
    const motions: Record<string, unknown> = {};
    if (legacyBlue) {
      motions.blue = {
        motionType: legacyBlue.type,
        rotationDirection: legacyBlue.dir,
        startLocation: legacyBlue.start,
        endLocation: legacyBlue.end,
        turns: legacyBlue.turns,
        startOrientation: legacyBlue.startOri,
        endOrientation: legacyBlue.endOri,
      };
    }
    if (legacyRed) {
      motions.red = {
        motionType: legacyRed.type,
        rotationDirection: legacyRed.dir,
        startLocation: legacyRed.start,
        endLocation: legacyRed.end,
        turns: legacyRed.turns,
        startOrientation: legacyRed.startOri,
        endOrientation: legacyRed.endOri,
      };
    }

    // Return step with motions populated
    return {
      ...step,
      motions,
      // Ensure required StepData fields exist
      id: (step.id as string) ?? crypto.randomUUID(),
      stepNumber: (step.stepNumber as number) ?? (step.beat as number) ?? 1,
      duration: (step.duration as number) ?? 1,
      blueReversal: (step.blueReversal as boolean) ?? false,
      redReversal: (step.redReversal as boolean) ?? false,
      isBlank: (step.isBlank as boolean) ?? false,
      letter: step.letter ?? null,
      startPosition: step.start ?? step.startPosition ?? null,
      endPosition: step.end ?? step.endPosition ?? null,
    } as unknown as StepData;
  }

  // No conversion needed
  return step as unknown as StepData;
}

export function createSequenceData(
  data: Partial<SequenceData> & { beats?: readonly StepData[] } = {}
): SequenceData {
  // Backwards compatibility: support old 'beats' property name
  const rawSteps = data.steps ?? data.beats ?? [];
  // Normalize each step to ensure motions are in the correct format
  const steps = rawSteps.map((step) => normalizeStepData(step as unknown as Record<string, unknown>));
  const result: SequenceData = {
    id: data.id ?? crypto.randomUUID(),
    name: data.name ?? "",
    word: data.word ?? "",
    steps,
    ...(data.displayName !== undefined && { displayName: data.displayName }),
    thumbnails: data.thumbnails ?? [],
    isFavorite: data.isFavorite ?? false,
    isCircular: data.isCircular ?? false,
    ...(data.loopType !== undefined && { loopType: data.loopType }),
    ...(data.orientationCycleCount !== undefined && {
      orientationCycleCount: data.orientationCycleCount,
    }),
    tags: data.tags ?? [],
    metadata: data.metadata ?? {},
    ...(data.sequenceLength !== undefined && {
      sequenceLength: data.sequenceLength,
    }),
    ...(data.author !== undefined && { author: data.author }),
    ...(data.level !== undefined && { level: data.level }),
    ...(data.dateAdded !== undefined && { dateAdded: data.dateAdded }),
    ...(data.gridMode !== undefined && { gridMode: data.gridMode }),
    ...(data.timeSignature !== undefined && { timeSignature: data.timeSignature }),
    ...(data.startingPosition !== undefined && {
      startingPosition: data.startingPosition,
    }),
    ...(data.startingPositionGroup !== undefined && {
      startingPositionGroup: data.startingPositionGroup,
    }),
    ...(data.startPosition !== undefined && {
      startPosition: data.startPosition,
    }),
    ...(data.difficultyLevel !== undefined && {
      difficultyLevel: data.difficultyLevel,
    }),
    // Equivalence detection
    ...(data.canonicalSignature !== undefined && {
      canonicalSignature: data.canonicalSignature,
    }),
    ...(data.canonicalOffset !== undefined && {
      canonicalOffset: data.canonicalOffset,
    }),
    // Owner info
    ...(data.ownerId !== undefined && { ownerId: data.ownerId }),
    ...(data.ownerDisplayName !== undefined && {
      ownerDisplayName: data.ownerDisplayName,
    }),
    ...(data.ownerAvatarUrl !== undefined && {
      ownerAvatarUrl: data.ownerAvatarUrl,
    }),
    // Video/animation storage
    ...(data.performanceVideoUrl !== undefined && {
      performanceVideoUrl: data.performanceVideoUrl,
    }),
    ...(data.animatedSequenceUrl !== undefined && {
      animatedSequenceUrl: data.animatedSequenceUrl,
    }),
    ...(data.animationFormat !== undefined && {
      animationFormat: data.animationFormat,
    }),
    ...(data.performanceVideoPath !== undefined && {
      performanceVideoPath: data.performanceVideoPath,
    }),
    ...(data.animatedSequencePath !== undefined && {
      animatedSequencePath: data.animatedSequencePath,
    }),
  };
  return result;
}

export function updateSequenceData(
  sequence: SequenceData,
  updates: Partial<SequenceData>
): SequenceData {
  return {
    ...sequence,
    ...updates,
  };
}

export function addStepToSequence(
  sequence: SequenceData,
  beat: StepData
): SequenceData {
  return updateSequenceData(sequence, {
    steps: [...sequence.steps, beat],
  });
}

export function removeStepFromSequence(
  sequence: SequenceData,
  stepIndex: number
): SequenceData {
  if (stepIndex < 0 || stepIndex >= sequence.steps.length) {
    return sequence;
  }

  const newSteps = sequence.steps.filter((_, index) => index !== stepIndex);
  return updateSequenceData(sequence, {
    steps: newSteps,
  });
}

// ============================================================================
// SEQUENCE METADATA
// ============================================================================

/**
 * Prop dimensions for rendering
 */
export interface PropDimensions {
  width: number;
  height: number;
}

/**
 * Essential metadata about a sequence
 * Subset of SequenceData containing the most commonly needed fields
 */
export interface SequenceMetadata {
  word: string;
  author: string;
  totalSteps: number;
  // Optional animation-related properties (viewer preferences, not stored with sequence)
  bluePropType?: PropType; // Per-color prop type for blue motions
  redPropType?: PropType; // Per-color prop type for red motions
  gridMode?: GridMode;
  bluePropDimensions?: PropDimensions;
  redPropDimensions?: PropDimensions;
}
