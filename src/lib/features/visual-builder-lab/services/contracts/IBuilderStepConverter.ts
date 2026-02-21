/**
 * Builder Step Converter Contract
 *
 * Converts visual builder's per-hand BuilderStep[] model into the
 * PictographData/MotionData structures that SequenceState and StepGrid consume.
 */

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { type GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionColor, Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { BuilderStep } from "../../state/visual-builder-state.svelte";

export interface IBuilderStepConverter {
  /** Convert a single BuilderStep + color into MotionData */
  stepToMotion(step: BuilderStep, color: MotionColor, gridMode: GridMode): MotionData;

  /** Create a static MotionData for start position display */
  createStaticMotion(
    position: GridLocation,
    orientation: Orientation,
    color: MotionColor,
    gridMode: GridMode,
  ): MotionData;

  /** Build PictographData[] from paired blue/red steps */
  convertToPictographs(
    blueSteps: BuilderStep[],
    redSteps: BuilderStep[],
    gridMode: GridMode,
  ): PictographData[];

  /** Build start position PictographData from current builder state */
  convertToStartPosition(
    blueSteps: BuilderStep[],
    redSteps: BuilderStep[],
    currentPosition: GridLocation | null,
    currentOrientation: Orientation,
    activeHand: MotionColor,
    gridMode: GridMode,
  ): PictographData | null;

  /** Async letter lookup for a paired step */
  lookupLetter(
    blueMotion: MotionData,
    redMotion: MotionData,
    gridMode: GridMode,
  ): Promise<Letter | null>;
}
