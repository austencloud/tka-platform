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

import { GridLocation } from "../../../../../grid/domain/enums/grid-enums";
import { RotationDirection } from "../../../../../shared/domain/enums/pictograph-enums";

export const OPENING = "op";
export const CLOSING = "cl";

type PropRotationMap = Map<string, string>;

export class PropRotationStateTracker {
  /**
   * Determine prop rotation state (opening/closing) for blue motion.
   *
   * Used for:
   * - Gamma (γ): blue_static motion
   * - Lambda Dash (Λ-): blue_dash motion
   *
   * @param blueEndLoc Blue motion's end location
   * @param redEndLoc Red motion's end location
   * @param propRotDir Blue motion's rotation direction
   * @returns "op" (opening) or "cl" (closing) or "" if not found
   */
  getBlueState(
    blueEndLoc: GridLocation,
    redEndLoc: GridLocation,
    propRotDir: RotationDirection
  ): string {
    const key = this.makeKey(blueEndLoc, redEndLoc, propRotDir);
    return this.blueRotationMap.get(key) || "";
  }

  /**
   * Determine prop rotation state (opening/closing) for red motion.
   *
   * Used for:
   * - Gamma (γ): red_static motion
   * - Lambda Dash (Λ-): red_dash motion
   *
   * @param blueEndLoc Blue motion's end location
   * @param redEndLoc Red motion's end location
   * @param propRotDir Red motion's rotation direction
   * @returns "op" (opening) or "cl" (closing) or "" if not found
   */
  getRedState(
    blueEndLoc: GridLocation,
    redEndLoc: GridLocation,
    propRotDir: RotationDirection
  ): string {
    const key = this.makeKey(blueEndLoc, redEndLoc, propRotDir);
    return this.redRotationMap.get(key) || "";
  }

  /**
   * Determine prop rotation state for dash motion in Lambda (Λ).
   *
   * @param dashEndLoc Dash motion's end location
   * @param staticEndLoc Static motion's end location
   * @param propRotDir Dash motion's rotation direction
   * @returns "op" (opening) or "cl" (closing) or "" if not found
   */
  getDashState(
    dashEndLoc: GridLocation,
    staticEndLoc: GridLocation,
    propRotDir: RotationDirection
  ): string {
    const key = this.makeKey(dashEndLoc, staticEndLoc, propRotDir);
    return this.dashRotationMap.get(key) || "";
  }

  /**
   * Determine prop rotation state for static motion in Lambda (Λ).
   *
   * @param dashEndLoc Dash motion's end location
   * @param staticEndLoc Static motion's end location
   * @param propRotDir Static motion's rotation direction
   * @returns "op" (opening) or "cl" (closing) or "" if not found
   */
  getStaticState(
    dashEndLoc: GridLocation,
    staticEndLoc: GridLocation,
    propRotDir: RotationDirection
  ): string {
    const key = this.makeKey(dashEndLoc, staticEndLoc, propRotDir);
    return this.staticRotationMap.get(key) || "";
  }

  private makeKey(
    loc1: GridLocation,
    loc2: GridLocation,
    rotDir: RotationDirection
  ): string {
    return `${loc1}|${loc2}|${rotDir}`;
  }

  /**
   * Blue motion rotation state map (for Gamma and Lambda-Dash).
   * Maps (blue_end_loc, red_end_loc, prop_rot_dir) -> opening/closing
   */
  private readonly blueRotationMap: PropRotationMap = new Map([
    // EAST patterns
    [
      this.makeKey(
        GridLocation.EAST,
        GridLocation.NORTH,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.EAST,
        GridLocation.NORTH,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.EAST,
        GridLocation.SOUTH,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.EAST,
        GridLocation.SOUTH,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    // WEST patterns
    [
      this.makeKey(
        GridLocation.WEST,
        GridLocation.NORTH,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.WEST,
        GridLocation.NORTH,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.WEST,
        GridLocation.SOUTH,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.WEST,
        GridLocation.SOUTH,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    // NORTH patterns
    [
      this.makeKey(
        GridLocation.NORTH,
        GridLocation.EAST,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.NORTH,
        GridLocation.EAST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.NORTH,
        GridLocation.WEST,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.NORTH,
        GridLocation.WEST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    // SOUTH patterns
    [
      this.makeKey(
        GridLocation.SOUTH,
        GridLocation.EAST,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTH,
        GridLocation.EAST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTH,
        GridLocation.WEST,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTH,
        GridLocation.WEST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    // NORTHEAST patterns
    [
      this.makeKey(
        GridLocation.NORTHEAST,
        GridLocation.SOUTHEAST,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.NORTHEAST,
        GridLocation.SOUTHEAST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.NORTHEAST,
        GridLocation.NORTHWEST,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.NORTHEAST,
        GridLocation.NORTHWEST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    // SOUTHEAST patterns
    [
      this.makeKey(
        GridLocation.SOUTHEAST,
        GridLocation.NORTHEAST,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTHEAST,
        GridLocation.NORTHEAST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTHEAST,
        GridLocation.SOUTHWEST,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTHEAST,
        GridLocation.SOUTHWEST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    // SOUTHWEST patterns
    [
      this.makeKey(
        GridLocation.SOUTHWEST,
        GridLocation.NORTHWEST,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTHWEST,
        GridLocation.NORTHWEST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTHWEST,
        GridLocation.SOUTHEAST,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTHWEST,
        GridLocation.SOUTHEAST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    // NORTHWEST patterns
    [
      this.makeKey(
        GridLocation.NORTHWEST,
        GridLocation.SOUTHWEST,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.NORTHWEST,
        GridLocation.SOUTHWEST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.NORTHWEST,
        GridLocation.NORTHEAST,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.NORTHWEST,
        GridLocation.NORTHEAST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
  ]);

  /**
   * Red motion rotation state map (for Gamma and Lambda-Dash).
   * Maps (blue_end_loc, red_end_loc, prop_rot_dir) -> opening/closing
   * Note: This is the inverse of blue motion map
   */
  private readonly redRotationMap: PropRotationMap = new Map([
    // EAST patterns (inverse of blue)
    [
      this.makeKey(
        GridLocation.EAST,
        GridLocation.NORTH,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.EAST,
        GridLocation.NORTH,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.EAST,
        GridLocation.SOUTH,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.EAST,
        GridLocation.SOUTH,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    // WEST patterns (inverse of blue)
    [
      this.makeKey(
        GridLocation.WEST,
        GridLocation.NORTH,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.WEST,
        GridLocation.NORTH,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.WEST,
        GridLocation.SOUTH,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.WEST,
        GridLocation.SOUTH,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    // NORTH patterns (inverse of blue)
    [
      this.makeKey(
        GridLocation.NORTH,
        GridLocation.EAST,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.NORTH,
        GridLocation.EAST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.NORTH,
        GridLocation.WEST,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.NORTH,
        GridLocation.WEST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    // SOUTH patterns (inverse of blue)
    [
      this.makeKey(
        GridLocation.SOUTH,
        GridLocation.EAST,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTH,
        GridLocation.EAST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTH,
        GridLocation.WEST,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTH,
        GridLocation.WEST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    // NORTHEAST patterns (inverse of blue)
    [
      this.makeKey(
        GridLocation.NORTHEAST,
        GridLocation.SOUTHEAST,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.NORTHEAST,
        GridLocation.SOUTHEAST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.NORTHEAST,
        GridLocation.NORTHWEST,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.NORTHEAST,
        GridLocation.NORTHWEST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    // SOUTHEAST patterns (inverse of blue)
    [
      this.makeKey(
        GridLocation.SOUTHEAST,
        GridLocation.NORTHEAST,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTHEAST,
        GridLocation.NORTHEAST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTHEAST,
        GridLocation.SOUTHWEST,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTHEAST,
        GridLocation.SOUTHWEST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    // SOUTHWEST patterns (inverse of blue)
    [
      this.makeKey(
        GridLocation.SOUTHWEST,
        GridLocation.NORTHWEST,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTHWEST,
        GridLocation.NORTHWEST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTHWEST,
        GridLocation.SOUTHEAST,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.SOUTHWEST,
        GridLocation.SOUTHEAST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    // NORTHWEST patterns (inverse of blue)
    [
      this.makeKey(
        GridLocation.NORTHWEST,
        GridLocation.SOUTHWEST,
        RotationDirection.CLOCKWISE
      ),
      CLOSING,
    ],
    [
      this.makeKey(
        GridLocation.NORTHWEST,
        GridLocation.SOUTHWEST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.NORTHWEST,
        GridLocation.NORTHEAST,
        RotationDirection.CLOCKWISE
      ),
      OPENING,
    ],
    [
      this.makeKey(
        GridLocation.NORTHWEST,
        GridLocation.NORTHEAST,
        RotationDirection.COUNTER_CLOCKWISE
      ),
      CLOSING,
    ],
  ]);

  /**
   * Dash motion rotation state map (for Lambda Λ).
   * Same as blue motion map since dash is typically the "first" motion.
   */
  private readonly dashRotationMap: PropRotationMap = this.blueRotationMap;

  /**
   * Static motion rotation state map (for Lambda Λ).
   * Same as red motion map since static is typically the "second" motion.
   */
  private readonly staticRotationMap: PropRotationMap = this.redRotationMap;
}
