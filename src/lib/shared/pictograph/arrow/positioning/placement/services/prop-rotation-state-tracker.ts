/**
 * Prop Rotation State Service
 *
 * Determines opening/closing state for props based on end locations and rotation direction.
 * Used for Gamma, Lambda, and Lambda-Dash letters which require prop rotation state in their turns tuples.
 *
 * Direct port from legacy desktop app:
 * - gamma_turns_tuple_generator.py
 * - lambda_turns_tuple_generator.py
 * - lambda_dash_turns_tuple_generator.py
 */

import { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import { RotationDirection } from "../../../../shared/domain/enums/pictograph-enums";

export const OPENING = "op";
export const CLOSING = "cl";

type PropRotationMap = Map<string, string>;

function makeKey(
  loc1: GridLocation,
  loc2: GridLocation,
  rotDir: RotationDirection
): string {
  return `${loc1}|${loc2}|${rotDir}`;
}

const leftRotationMap: PropRotationMap = new Map([
  // EAST patterns
  [makeKey(GridLocation.EAST, GridLocation.NORTH, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.EAST, GridLocation.NORTH, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  [makeKey(GridLocation.EAST, GridLocation.SOUTH, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.EAST, GridLocation.SOUTH, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  // WEST patterns
  [makeKey(GridLocation.WEST, GridLocation.NORTH, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.WEST, GridLocation.NORTH, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  [makeKey(GridLocation.WEST, GridLocation.SOUTH, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.WEST, GridLocation.SOUTH, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  // NORTH patterns
  [makeKey(GridLocation.NORTH, GridLocation.EAST, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.NORTH, GridLocation.EAST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  [makeKey(GridLocation.NORTH, GridLocation.WEST, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.NORTH, GridLocation.WEST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  // SOUTH patterns
  [makeKey(GridLocation.SOUTH, GridLocation.EAST, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.SOUTH, GridLocation.EAST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  [makeKey(GridLocation.SOUTH, GridLocation.WEST, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.SOUTH, GridLocation.WEST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  // NORTHEAST patterns
  [makeKey(GridLocation.NORTHEAST, GridLocation.SOUTHEAST, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.NORTHEAST, GridLocation.SOUTHEAST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  [makeKey(GridLocation.NORTHEAST, GridLocation.NORTHWEST, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.NORTHEAST, GridLocation.NORTHWEST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  // SOUTHEAST patterns
  [makeKey(GridLocation.SOUTHEAST, GridLocation.NORTHEAST, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.SOUTHEAST, GridLocation.NORTHEAST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  [makeKey(GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  // SOUTHWEST patterns
  [makeKey(GridLocation.SOUTHWEST, GridLocation.NORTHWEST, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.SOUTHWEST, GridLocation.NORTHWEST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  [makeKey(GridLocation.SOUTHWEST, GridLocation.SOUTHEAST, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.SOUTHWEST, GridLocation.SOUTHEAST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  // NORTHWEST patterns
  [makeKey(GridLocation.NORTHWEST, GridLocation.SOUTHWEST, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.NORTHWEST, GridLocation.SOUTHWEST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  [makeKey(GridLocation.NORTHWEST, GridLocation.NORTHEAST, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.NORTHWEST, GridLocation.NORTHEAST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
]);

const rightRotationMap: PropRotationMap = new Map([
  // EAST patterns (inverse of blue)
  [makeKey(GridLocation.EAST, GridLocation.NORTH, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.EAST, GridLocation.NORTH, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  [makeKey(GridLocation.EAST, GridLocation.SOUTH, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.EAST, GridLocation.SOUTH, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  // WEST patterns (inverse of blue)
  [makeKey(GridLocation.WEST, GridLocation.NORTH, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.WEST, GridLocation.NORTH, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  [makeKey(GridLocation.WEST, GridLocation.SOUTH, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.WEST, GridLocation.SOUTH, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  // NORTH patterns (inverse of blue)
  [makeKey(GridLocation.NORTH, GridLocation.EAST, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.NORTH, GridLocation.EAST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  [makeKey(GridLocation.NORTH, GridLocation.WEST, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.NORTH, GridLocation.WEST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  // SOUTH patterns (inverse of blue)
  [makeKey(GridLocation.SOUTH, GridLocation.EAST, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.SOUTH, GridLocation.EAST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  [makeKey(GridLocation.SOUTH, GridLocation.WEST, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.SOUTH, GridLocation.WEST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  // NORTHEAST patterns (inverse of blue)
  [makeKey(GridLocation.NORTHEAST, GridLocation.SOUTHEAST, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.NORTHEAST, GridLocation.SOUTHEAST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  [makeKey(GridLocation.NORTHEAST, GridLocation.NORTHWEST, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.NORTHEAST, GridLocation.NORTHWEST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  // SOUTHEAST patterns (inverse of blue)
  [makeKey(GridLocation.SOUTHEAST, GridLocation.NORTHEAST, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.SOUTHEAST, GridLocation.NORTHEAST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  [makeKey(GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  // SOUTHWEST patterns (inverse of blue)
  [makeKey(GridLocation.SOUTHWEST, GridLocation.NORTHWEST, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.SOUTHWEST, GridLocation.NORTHWEST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  [makeKey(GridLocation.SOUTHWEST, GridLocation.SOUTHEAST, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.SOUTHWEST, GridLocation.SOUTHEAST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  // NORTHWEST patterns (inverse of blue)
  [makeKey(GridLocation.NORTHWEST, GridLocation.SOUTHWEST, RotationDirection.CLOCKWISE), CLOSING],
  [makeKey(GridLocation.NORTHWEST, GridLocation.SOUTHWEST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  [makeKey(GridLocation.NORTHWEST, GridLocation.NORTHEAST, RotationDirection.CLOCKWISE), OPENING],
  [makeKey(GridLocation.NORTHWEST, GridLocation.NORTHEAST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
]);

// Dash map is the same as blue map (dash is typically the "first" motion)
const dashRotationMap: PropRotationMap = leftRotationMap;
// Static map is the same as red map (static is typically the "second" motion)
const staticRotationMap: PropRotationMap = rightRotationMap;

/**
 * Determine prop rotation state (opening/closing) for blue motion.
 * Used for Gamma (γ) and Lambda-Dash (Λ-).
 */
export function getLeftState(
  leftEndLoc: GridLocation,
  rightEndLoc: GridLocation,
  propRotDir: RotationDirection
): string {
  return leftRotationMap.get(makeKey(leftEndLoc, rightEndLoc, propRotDir)) || "";
}

/**
 * Determine prop rotation state (opening/closing) for red motion.
 * Used for Gamma (γ) and Lambda-Dash (Λ-).
 */
export function getRightState(
  leftEndLoc: GridLocation,
  rightEndLoc: GridLocation,
  propRotDir: RotationDirection
): string {
  return rightRotationMap.get(makeKey(leftEndLoc, rightEndLoc, propRotDir)) || "";
}

/**
 * Determine prop rotation state for dash motion in Lambda (Λ).
 */
export function getDashState(
  dashEndLoc: GridLocation,
  staticEndLoc: GridLocation,
  propRotDir: RotationDirection
): string {
  return dashRotationMap.get(makeKey(dashEndLoc, staticEndLoc, propRotDir)) || "";
}

/**
 * Determine prop rotation state for static motion in Lambda (Λ).
 */
export function getStaticState(
  dashEndLoc: GridLocation,
  staticEndLoc: GridLocation,
  propRotDir: RotationDirection
): string {
  return staticRotationMap.get(makeKey(dashEndLoc, staticEndLoc, propRotDir)) || "";
}
