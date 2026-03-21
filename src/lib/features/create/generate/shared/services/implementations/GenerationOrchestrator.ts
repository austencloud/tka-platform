/**
 * Generation Orchestrator
 *
 * Delegates sequence generation to the shared SequenceBuilder from
 * @tka/sequence-engine. Both freeform and circular generation go through
 * the same beam-search pipeline with constraint composition.
 *
 * The orchestrator's job is thin:
 * 1. Map app-level GenerationOptions to the engine's BuildOptions
 * 2. Initialize the BrowserVariationProvider (CSV loading)
 * 3. Call SequenceBuilder.build()
 * 4. Convert the engine's BuildResult to the app's SequenceData via BuildResultTransformer
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { GenerationOptions } from "../../domain/models/generate-models";
import {
  GenerationMode,
  PropContinuity,
} from "../../domain/models/generate-models";
import type { IGenerationOrchestrator } from "../contracts/IGenerationOrchestrator";
import type { IBrowserVariationProvider } from "../contracts/IBrowserVariationProvider";
import type { IBuildResultTransformer } from "../contracts/IBuildResultTransformer";
import type { ISequenceMetadataManager } from "../contracts/ISequenceMetadataManager";
import { SequenceBuilder } from "@tka/sequence-engine/generation";
import type { ConstraintOptions } from "@tka/sequence-engine/generation";
import { LOOPType, SliceSize } from "@tka/sequence-engine/loop";

export class GenerationOrchestrator implements IGenerationOrchestrator {
  constructor(
    private readonly variationProvider: IBrowserVariationProvider,
    private readonly transformer: IBuildResultTransformer,
    private readonly metadataManager: ISequenceMetadataManager
  ) {}

  /**
   * Generate complete sequence — routes to appropriate mode
   */
  async generateSequence(options: GenerationOptions): Promise<SequenceData> {
    if (options.mode === GenerationMode.CIRCULAR) {
      return this.generateCircularSequence(options);
    }
    return this.generateFreeformSequence(options);
  }

  /**
   * Generate a freeform (non-looping) sequence via the shared engine.
   */
  private async generateFreeformSequence(
    options: GenerationOptions
  ): Promise<SequenceData> {
    await this.variationProvider.initialize(String(options.gridMode));
    const builder = new SequenceBuilder(this.variationProvider);
    const level = this.metadataManager.mapDifficultyToLevel(options.difficulty);

    const result = builder.build({
      length: options.length,
      gridMode: String(options.gridMode),
      level,
      constraintOptions: this.mapConstraints(options),
      startPosition: options.startPosition?.startPosition
        ? String(options.startPosition.startPosition)
        : undefined,
      blockedStartPositions: options.blockedStartPositions?.map(String),
      maxTurnIntensity: options.turnIntensity,
    });

    return this.transformer.convertToSequenceData(result, options);
  }

  /**
   * Generate a circular (LOOP) sequence via the shared engine.
   *
   * The engine's SequenceBuilder handles LOOP extension internally —
   * it generates the seed sequence, then applies the LOOP executor to
   * produce the full circular sequence.
   */
  private async generateCircularSequence(
    options: GenerationOptions
  ): Promise<SequenceData> {
    await this.variationProvider.initialize(String(options.gridMode));
    const builder = new SequenceBuilder(this.variationProvider);
    const level = this.metadataManager.mapDifficultyToLevel(options.difficulty);

    // Map app's LOOPType enum values to engine's. Both use the same string
    // values for most types, but the app has "strict_rewound" while the
    // engine uses "rewound".
    const engineLoopType = this.mapLoopTypeToEngine(options.loopType);
    const sliceSize = this.mapSliceSize(options.sliceSize);

    // The UI's length is the TOTAL output length. The seed is a fraction:
    // halved = length / 2, quartered = length / 4. The LOOP executor
    // extends the seed back to the full length.
    const sliceMultiplier = sliceSize === SliceSize.QUARTERED ? 4 : 2;
    const seedLength = Math.max(1, Math.floor(options.length / sliceMultiplier));
    const result = builder.build({
      length: seedLength,
      gridMode: String(options.gridMode),
      level,
      constraintOptions: this.mapConstraints(options),
      startPosition: options.startPosition?.startPosition
        ? String(options.startPosition.startPosition)
        : undefined,
      blockedStartPositions: options.blockedStartPositions?.map(String),
      maxTurnIntensity: options.turnIntensity,
      loop: {
        type: engineLoopType,
        sliceSize,
        useTargetedGeneration: true,
      },
    });

    return this.transformer.convertToSequenceData(result, options);
  }

  /**
   * Map the app's 3-axis constraint system to the engine's ConstraintOptions.
   *
   * constraintPreset: smooth/mixed/choppy → prop spin continuity
   * handPathMode: smooth/mixed/choppy → hand path continuity
   * motionTypeFilter: no-dash/prefer-dash/null → motion family exclusion
   */
  private mapConstraints(options: GenerationOptions): ConstraintOptions {
    const result: ConstraintOptions = {};

    // Prop continuity (constraintPreset axis)
    const propAxis = options.constraintPreset ?? "smooth";
    switch (propAxis) {
      case "smooth":
        result.propContinuity = "maximize";
        break;
      case "choppy":
        result.propContinuity = "force-reversals";
        break;
      case "mixed":
        result.propContinuity = "allow-reversals";
        break;
    }

    // Hand path continuity (handPathMode axis)
    const handAxis = options.handPathMode ?? "smooth";
    switch (handAxis) {
      case "smooth":
        result.handPathContinuity = "maximize";
        break;
      case "choppy":
        result.handPathContinuity = "force-reversals";
        break;
      case "mixed":
        result.handPathContinuity = "allow-reversals";
        break;
    }

    // Motion type filter (motionTypeFilter axis)
    if (options.motionTypeFilter === "no-dash") {
      result.motionFamily = { exclude: ["dash"] };
    }
    // "prefer-dash" is a soft preference — not a hard constraint.
    // The compositional system doesn't have a soft motion family preference yet.

    return result;
  }

  /**
   * Map the app's LOOPType enum to the engine's LOOPType enum.
   *
   * The two enums share most string values. The main difference is the
   * app uses "strict_rewound" while the engine uses "rewound".
   */
  private mapLoopTypeToEngine(
    appLoopType?: string
  ): LOOPType {
    if (!appLoopType) return LOOPType.STRICT_ROTATED;

    // Handle the naming difference for rewound
    if (appLoopType === "strict_rewound") {
      return LOOPType.REWOUND;
    }

    // All other values match between app and engine enums
    const engineType = Object.values(LOOPType).find(
      (v) => v === appLoopType
    );
    return engineType ?? LOOPType.STRICT_ROTATED;
  }

  /**
   * Map the app's SliceSize to the engine's SliceSize.
   * Both use identical string values.
   */
  private mapSliceSize(appSliceSize?: string): SliceSize {
    if (appSliceSize === "quartered") return SliceSize.QUARTERED;
    return SliceSize.HALVED;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler";
import { BrowserVariationProvider } from "./BrowserVariationProvider";
import { BuildResultTransformer } from "./BuildResultTransformer";
import { sequenceMetadataManager } from "./SequenceMetadataManager";
import { reversalDetector } from "$lib/features/create/shared/services/implementations/ReversalDetector";
import { orientationCycleDetector } from "$lib/features/create/generate/circular/services/implementations/OrientationCycleDetector";

const browserVariationProvider = new BrowserVariationProvider(
  letterQueryHandler
);

const buildResultTransformer = new BuildResultTransformer(
  sequenceMetadataManager,
  reversalDetector,
  orientationCycleDetector
);

export const generationOrchestrator = new GenerationOrchestrator(
  browserVariationProvider,
  buildResultTransformer,
  sequenceMetadataManager
);
