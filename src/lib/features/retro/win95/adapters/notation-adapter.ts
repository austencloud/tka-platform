/**
 * Notation Adapter
 *
 * Bridges the retro UI to the real GenerationOrchestrator from the DI container.
 * Maps retro UI options (level, length, constraint) to the orchestrator's API,
 * then converts the resulting SequenceData steps back to RetroPictographData[]
 * for the pixel renderer.
 *
 * Domain: Retro SCRIBE App
 */

import { container } from "$lib/shared/di";
import type { IGenerationOrchestrator } from "$lib/features/create/generate/shared/services/contracts/IGenerationOrchestrator";
import type { GenerationOptions } from "$lib/features/create/generate/shared/domain/models/generate-models";
import {
  DifficultyLevel,
  GenerationMode,
} from "$lib/features/create/generate/shared/domain/models/generate-models";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type {
  RetroPictographData,
  RetroHandData,
} from "../../shared/domain/pictograph-types";

export interface RetroGenerationOptions {
  mode: "freeform" | "spell";
  word?: string;
  length?: number;
  level?: number;
  turnIntensity?: number;
  gridMode?: string;
  constraintPreset?: string;
}

export interface RetroGenerationResult {
  word: string;
  beats: { letter: string; pictograph: RetroPictographData }[];
  beatCount: number;
}

/**
 * Map the retro UI's level number (1-4) to the orchestrator's DifficultyLevel enum.
 */
function mapLevelToDifficulty(level: number): DifficultyLevel {
  switch (level) {
    case 1:
      return DifficultyLevel.BEGINNER;
    case 2:
      return DifficultyLevel.INTERMEDIATE;
    case 3:
      return DifficultyLevel.ADVANCED;
    case 4:
      return DifficultyLevel.SKEWED;
    default:
      return DifficultyLevel.INTERMEDIATE;
  }
}

/**
 * Map the retro UI's grid mode string to the GridMode enum.
 */
function mapGridMode(mode: string): GridMode {
  switch (mode) {
    case "box":
      return GridMode.BOX;
    case "diamond":
    default:
      return GridMode.DIAMOND;
  }
}

/**
 * Convert a single MotionData from the real engine into a RetroHandData
 * for the pixel renderer.
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
 * Generate a real TKA sequence through the DI-registered GenerationOrchestrator,
 * then convert the result to the retro renderer's data format.
 */
export async function generateRetroSequence(
  options: RetroGenerationOptions,
): Promise<RetroGenerationResult> {
  const orchestrator = container.items
    .generationOrchestrator as IGenerationOrchestrator;

  const generationOptions: GenerationOptions = {
    mode: GenerationMode.FREEFORM,
    length: options.length ?? 8,
    gridMode: mapGridMode(options.gridMode ?? "diamond"),
    propType: PropType.STAFF,
    difficulty: mapLevelToDifficulty(options.level ?? 2),
    turnIntensity: options.turnIntensity ?? 1,
    constraintPreset:
      (options.constraintPreset as "smooth" | "mixed" | "choppy") ?? "smooth",
  };

  const sequenceData = await orchestrator.generateSequence(generationOptions);

  // Convert each step's motion pair into a RetroPictographData for the pixel renderer
  const beats: { letter: string; pictograph: RetroPictographData }[] =
    sequenceData.steps.map((step) => {
      const blueMotion = step.motions[MotionColor.BLUE];
      const redMotion = step.motions[MotionColor.RED];

      const pictograph: RetroPictographData = {
        letter: step.letter ?? "?",
        gridMode: step.gridMode ?? GridMode.DIAMOND,
        blueHand: blueMotion
          ? motionToRetroHand(blueMotion)
          : fallbackHand(MotionColor.BLUE),
        redHand: redMotion
          ? motionToRetroHand(redMotion)
          : fallbackHand(MotionColor.RED),
      };

      return {
        letter: String(step.letter ?? "?"),
        pictograph,
      };
    });

  return {
    word: sequenceData.word,
    beats,
    beatCount: beats.length,
  };
}
