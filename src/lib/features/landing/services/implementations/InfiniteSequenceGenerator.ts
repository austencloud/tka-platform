/**
 * Infinite Sequence Generator Implementation
 *
 * Generates novel sequences for the endless spinner's "Infinite" mode.
 * Wraps the GenerationOrchestrator with spinner-specific constraints
 * and tracks generation metrics.
 */

import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import {
  GenerationMode,
  DifficultyLevel,
  PropContinuity,
} from "$lib/features/create/generate/shared/domain/models/generate-models";
import type { IGenerationOrchestrator } from "$lib/features/create/generate/shared/services/contracts/IGenerationOrchestrator";
import type { GeneratedSequenceInfo } from "../../domain/models/spinner-models";
import type { EndState } from "../contracts/IEndlessSpinnerOrchestrator";
import type { IInfiniteSequenceGenerator } from "../contracts/IInfiniteSequenceGenerator";
import type { ISpinnerMetricsRepository } from "../contracts/ISpinnerMetricsRepository";

export class InfiniteSequenceGenerator implements IInfiniteSequenceGenerator {
  private sessionCount = 0;

  constructor(
    private generationOrchestrator: IGenerationOrchestrator,
    private metricsRepository: ISpinnerMetricsRepository
  ) {}

  async generateFromEndState(
    endState: EndState
  ): Promise<GeneratedSequenceInfo | null> {
    // If end state is missing orientations, fall back to generating without constraints
    const hasValidOrientations = endState.blueOrientation && endState.redOrientation;

    if (!hasValidOrientations) {
      console.log("[InfiniteSequenceGenerator] End state missing orientations, generating fresh");
      return this.generateInitial();
    }

    try {
      const startPositionData = this.createStartPositionFromEndState(endState);
      const length = this.getRandomLength();

      const sequence = await this.generationOrchestrator.generateSequence({
        mode: GenerationMode.FREEFORM,
        length,
        gridMode: GridMode.DIAMOND,
        propType: PropType.STAFF,
        difficulty: DifficultyLevel.INTERMEDIATE,
        propContinuity: PropContinuity.CONTINUOUS,
        turnIntensity: 1,
        startPosition: startPositionData,
      });

      // Increment counters
      this.sessionCount++;
      const globalIndex = await this.metricsRepository.incrementGeneratedCount();

      return {
        sequence,
        generatedAt: new Date(),
        globalIndex,
      };
    } catch (error) {
      // If constrained generation fails, try generating without the constraint
      console.warn(
        "[InfiniteSequenceGenerator] Constrained generation failed, falling back to initial:",
        error
      );
      return this.generateInitial();
    }
  }

  async generateInitial(): Promise<GeneratedSequenceInfo | null> {
    try {
      const length = this.getRandomLength();

      const sequence = await this.generationOrchestrator.generateSequence({
        mode: GenerationMode.FREEFORM,
        length,
        gridMode: GridMode.DIAMOND,
        propType: PropType.STAFF,
        difficulty: DifficultyLevel.INTERMEDIATE,
        propContinuity: PropContinuity.CONTINUOUS,
        turnIntensity: 1,
      });

      // Increment counters
      this.sessionCount++;
      const globalIndex = await this.metricsRepository.incrementGeneratedCount();

      return {
        sequence,
        generatedAt: new Date(),
        globalIndex,
      };
    } catch (error) {
      console.error(
        "[InfiniteSequenceGenerator] Failed to generate initial sequence:",
        error
      );
      return null;
    }
  }

  getSessionCount(): number {
    return this.sessionCount;
  }

  resetSessionCount(): void {
    this.sessionCount = 0;
  }

  /**
   * Create a PictographData-like object from an end state for use as start position.
   */
  private createStartPositionFromEndState(endState: EndState): any {
    return {
      id: `infinite-start-${Date.now()}`,
      startPosition: endState.position,
      motions: {
        blue: endState.blueOrientation
          ? { startOrientation: endState.blueOrientation }
          : undefined,
        red: endState.redOrientation
          ? { startOrientation: endState.redOrientation }
          : undefined,
      },
    };
  }

  /**
   * Get a random sequence length between 4 and 8 beats.
   * Longer sequences allow for more complex patterns.
   */
  private getRandomLength(): number {
    return 4 + Math.floor(Math.random() * 5); // 4-8 beats
  }
}
