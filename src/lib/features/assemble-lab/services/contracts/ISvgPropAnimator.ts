// src/lib/features/assemble-lab/services/contracts/ISvgPropAnimator.ts

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Orientation, RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface AnimationParams {
  /** The SVG <g> element wrapping the prop to animate */
  element: SVGGElement;
  /** Grid location where prop currently sits */
  startPosition: GridLocation;
  /** Grid location to animate toward */
  endPosition: GridLocation;
  /** CW or CCW - determines pro vs anti for shifts */
  rotationDirection: RotationDirection;
  /** Number of additional turns (0, 0.5, 1, ...) */
  turnCount: number;
  /** Prop's current orientation */
  startOrientation: Orientation;
  /** Duration in milliseconds */
  durationMs: number;
  /** Center point of the prop SVG artwork (for transform origin correction) */
  propCenter: { x: number; y: number };
}

export interface ISvgPropAnimator {
  /** Animate prop from start to end. Resolves when animation completes. */
  animate(params: AnimationParams): Promise<void>;
  /** Cancel any running animation */
  cancel(): void;
}
