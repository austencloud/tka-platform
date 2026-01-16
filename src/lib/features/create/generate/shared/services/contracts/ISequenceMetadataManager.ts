import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type {
  GenerationOptions,
  DifficultyLevel,
} from "../../domain/models/generate-models";

export interface ISequenceMetadataManager {
  generateSequenceName(options: GenerationOptions): string;
  calculateWordFromBeats(steps: StepData[]): string;
  mapDifficultyToLevel(difficulty: DifficultyLevel): number;
  createGenerationMetadata(options: {
    stepsGenerated: number;
    propContinuity: string;
    blueRotationDirection: string;
    redRotationDirection: string;
    turnIntensity: number;
    level: number;
  }): Record<string, unknown>;
}
