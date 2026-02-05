import type { GridMode, GridPositionGroup } from "../pictograph/grid-enums";
import type { PropType } from "../pictograph/PropType";
import type { TimeSignatureKey } from "../foundation/TimeSignature";
import type { StepData } from "./StepData";
import type { StartPositionData } from "./StartPositionData";
import type { LOOPType } from "./LOOPType";

export interface SequenceData {
  readonly id: string;
  readonly name: string;
  readonly displayName?: string;
  readonly intendedWord?: string;
  readonly word: string;
  readonly steps: readonly StepData[];
  readonly startPosition?: StartPositionData;
  readonly startingPosition?: StartPositionData;
  readonly startingPositionGroup?: GridPositionGroup;
  readonly thumbnails: readonly string[];
  readonly sequenceLength?: number;
  readonly author?: string;
  readonly level?: number;
  readonly dateAdded?: Date;
  readonly birthday?: Date;
  readonly createdAt?: Date;
  readonly gridMode?: GridMode;
  readonly timeSignature?: TimeSignatureKey;
  readonly isFavorite: boolean;
  readonly isCircular: boolean;
  readonly loopType?: LOOPType | null;
  readonly orientationCycleCount?: 1 | 2 | 4;
  readonly difficultyLevel?: string;
  readonly tags: readonly string[];
  readonly metadata: Record<string, unknown>;
  readonly canonicalSignature?: string;
  readonly canonicalOffset?: number;
  readonly ownerId?: string;
  readonly ownerDisplayName?: string;
  readonly ownerAvatarUrl?: string;
  readonly performanceVideoUrl?: string;
  readonly animatedSequenceUrl?: string;
  readonly animationFormat?: "webp" | "gif";
  readonly performanceVideoPath?: string;
  readonly animatedSequencePath?: string;
}

export interface PropDimensions {
  width: number;
  height: number;
}

export interface SequenceMetadata {
  word: string;
  author: string;
  totalSteps: number;
  bluePropType?: PropType;
  redPropType?: PropType;
  gridMode?: GridMode;
  bluePropDimensions?: PropDimensions;
  redPropDimensions?: PropDimensions;
}
