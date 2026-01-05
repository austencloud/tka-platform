import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
/**
 * Sequence Domain Model
 *
 * Immutable data structure for complete kinetic sequences.
 * Based on the modern desktop app's SequenceData but adapted for TypeScript.
 *
 * MIGRATION NOTE: Start position now uses StartPositionData type instead of BeatData.
 * The beats array should only contain actual beats (beatNumber >= 1), never start position.
 */

import type { BeatData } from "../../../../features/create/shared/domain/models/BeatData";
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
  readonly beats: readonly BeatData[]; // Only actual beats (beatNumber >= 1), never start position

  // Start position storage (CONSOLIDATED):
  // Start positions are semantically distinct from beats - they have no duration, no beat number,
  // and represent the initial static prop configuration before the sequence begins.
  readonly startPosition?: StartPositionData;
  readonly startingPositionBeat?: StartPositionData; // Legacy field name, same type
  readonly startingPositionGroup?: GridPositionGroup; // Position group metadata: "alpha", "beta", "gamma"

  readonly thumbnails: readonly string[];
  readonly sequenceLength?: number;
  readonly author?: string;
  readonly level?: number;
  readonly dateAdded?: Date;
  readonly gridMode?: GridMode;
  readonly propType?: PropType;
  /**
   * @deprecated Use ICollectionManager.isFavorite(sequenceId) instead.
   * Favorites are now stored as collection membership, not as a boolean flag.
   * This field is kept for backwards compatibility during migration.
   */
  readonly isFavorite: boolean;
  readonly isCircular: boolean;
  /**
   * LOOP type - Linked Offset Operation Pattern (TKA's algorithmic extension patterns)
   * Formerly known as LOOP type (Continuous Assembly Pattern).
   */
  readonly loopType?: LOOPType | null;
  /** Number of sequence repetitions needed to return to starting orientation (1, 2, or 4) */
  readonly orientationCycleCount?: 1 | 2 | 4;
  readonly difficultyLevel?: string;
  readonly tags: readonly string[];
  readonly metadata: Record<string, unknown>;

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

export function createSequenceData(
  data: Partial<SequenceData> = {}
): SequenceData {
  const result: SequenceData = {
    id: data.id ?? crypto.randomUUID(),
    name: data.name ?? "",
    word: data.word ?? "",
    beats: data.beats ?? [],
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
    ...(data.propType !== undefined && { propType: data.propType }),
    ...(data.startingPositionBeat !== undefined && {
      startingPositionBeat: data.startingPositionBeat,
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

export function addBeatToSequence(
  sequence: SequenceData,
  beat: BeatData
): SequenceData {
  return updateSequenceData(sequence, {
    beats: [...sequence.beats, beat],
  });
}

export function removeBeatFromSequence(
  sequence: SequenceData,
  beatIndex: number
): SequenceData {
  if (beatIndex < 0 || beatIndex >= sequence.beats.length) {
    return sequence;
  }

  const newBeats = sequence.beats.filter((_, index) => index !== beatIndex);
  return updateSequenceData(sequence, {
    beats: newBeats,
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
  totalBeats: number;
  // Optional animation-related properties
  propType?: PropType; // Legacy - kept for backward compatibility
  bluePropType?: PropType; // Per-color prop type for blue motions
  redPropType?: PropType; // Per-color prop type for red motions
  gridMode?: GridMode;
  bluePropDimensions?: PropDimensions;
  redPropDimensions?: PropDimensions;
}
