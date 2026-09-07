/**
 * Core type aliases and const objects for TKA pictograph rendering.
 *
 * Types match @tka/render-core (the single source of truth).
 * Const objects provide enum-style member access (e.g., GridLocation.NORTH)
 * for backward compatibility with existing MCP calculation files.
 */

import type {
  GridLocation as _GridLocation,
  GridMode as _GridMode,
  MotionType as _MotionType,
  Orientation as _Orientation,
  RotationDirection as _RotationDirection,
  VectorDirection as _VectorDirection,
  Coordinates as _Coordinates,
} from "@tka/render-core";

// Re-export types (using aliases to avoid name conflicts with const objects)
export type GridLocation = _GridLocation;
export type GridMode = _GridMode;
export type MotionType = _MotionType;
export type Orientation = _Orientation;
export type RotationDirection = _RotationDirection;
export type VectorDirection = _VectorDirection;
export type Coordinates = _Coordinates;

// Re-export runtime values from the canonical package
export { CARDINAL_LOCATIONS, INTERCARDINAL_LOCATIONS, isCardinal } from "@tka/render-core";

// Const objects for enum-style member access

export const GridLocation = {
  NORTH: "n" as GridLocation,
  EAST: "e" as GridLocation,
  SOUTH: "s" as GridLocation,
  WEST: "w" as GridLocation,
  NORTHEAST: "ne" as GridLocation,
  SOUTHEAST: "se" as GridLocation,
  SOUTHWEST: "sw" as GridLocation,
  NORTHWEST: "nw" as GridLocation,
  CENTER: "c" as GridLocation,
} as const;

export const GridMode = {
  DIAMOND: "diamond" as GridMode,
  BOX: "box" as GridMode,
  SKEWED: "skewed" as GridMode,
} as const;

export const MotionType = {
  STATIC: "static" as MotionType,
  PRO: "pro" as MotionType,
  ANTI: "anti" as MotionType,
  DASH: "dash" as MotionType,
  FLOAT: "float" as MotionType,
} as const;

export const Orientation = {
  IN: "in" as Orientation,
  OUT: "out" as Orientation,
  CLOCK: "clock" as Orientation,
  COUNTER: "counter" as Orientation,
  CLOCK_IN: "clockIn" as Orientation,
  CLOCK_OUT: "clockOut" as Orientation,
  COUNTER_IN: "counterIn" as Orientation,
  COUNTER_OUT: "counterOut" as Orientation,
} as const;

export const RotationDirection = {
  CW: "cw" as RotationDirection,
  CCW: "ccw" as RotationDirection,
  NO_ROTATION: "no_rot" as RotationDirection,
} as const;

export const VectorDirection = {
  UP: "up" as VectorDirection,
  DOWN: "down" as VectorDirection,
  LEFT: "left" as VectorDirection,
  RIGHT: "right" as VectorDirection,
  UPRIGHT: "upright" as VectorDirection,
  DOWNRIGHT: "downright" as VectorDirection,
  UPLEFT: "upleft" as VectorDirection,
  DOWNLEFT: "downleft" as VectorDirection,
} as const;
