/**
 * Trigrid Lab Domain Types
 *
 * Type definitions for the 3-point equilateral triangle grid experiment.
 * The trigrid uses 6 orientations at 60-degree intervals (a subset of the
 * existing Orientation enum) and supports only beta/gamma positions.
 */

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/** Triangle orientation: which direction the apex points */
export type TriGridMode = "upright" | "inverted" | "left" | "right";

/**
 * The 6 valid trigrid orientations at 60-degree intervals.
 * These are a subset of the existing Orientation enum.
 *
 * On the 4-point grid, interradials sit at 45-degree intervals.
 * On the trigrid, the same concepts sit at 60-degree intervals.
 * CLOCK and COUNTER (perpendicular to radial) are skipped because
 * 90-degree orientations don't exist on a 3-fold symmetric grid.
 *
 * Cycle: IN(0) -> CLOCK_IN(60) -> CLOCK_OUT(120) -> OUT(180) -> COUNTER_OUT(240) -> COUNTER_IN(300)
 */
export const TRIGRID_ORIENTATIONS: readonly Orientation[] = [
  Orientation.IN,
  Orientation.CLOCK_IN,
  Orientation.CLOCK_OUT,
  Orientation.OUT,
  Orientation.COUNTER_OUT,
  Orientation.COUNTER_IN,
] as const;

/** 2D coordinate */
export interface Point {
  x: number;
  y: number;
}

/** Position classification on the trigrid */
export interface TriGridPositionInfo {
  /** beta = same vertex, gamma = different vertices (120 degrees apart) */
  group: "beta" | "gamma";
  /** 1-indexed variant within group */
  index: number;
  /** Human-readable label */
  label: string;
  /** Blue hand grid location */
  blueLocation: GridLocation;
  /** Red hand grid location */
  redLocation: GridLocation;
}

/** Arc path data for shift motion visualization */
export interface TriGridArcData {
  /** SVG path d attribute */
  pathD: string;
  /** Arrowhead polygon points */
  arrowheadPoints: string;
  /** Whether this is clockwise motion */
  clockwise: boolean;
}

/** Motion type for trigrid (no dash - no opposite points) */
export type TriGridMotionType = "pro" | "anti" | "float" | "static";
