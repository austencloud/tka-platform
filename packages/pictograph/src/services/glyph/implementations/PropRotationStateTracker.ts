/**
 * Prop Rotation State Tracker
 *
 * Determines opening/closing state for props based on end locations and rotation direction.
 * Used for Gamma, Lambda, and Lambda-Dash letters which require prop rotation state in their turns tuples.
 */

import { GridLocation, RotationDirection } from "@tka/types";

export const OPENING = "op";
export const CLOSING = "cl";

type PropRotationMap = Map<string, string>;

export class PropRotationStateTracker {
  getBlueState(
    blueEndLoc: GridLocation,
    redEndLoc: GridLocation,
    propRotDir: RotationDirection
  ): string {
    const key = this.makeKey(blueEndLoc, redEndLoc, propRotDir);
    return this.blueRotationMap.get(key) || "";
  }

  getRedState(
    blueEndLoc: GridLocation,
    redEndLoc: GridLocation,
    propRotDir: RotationDirection
  ): string {
    const key = this.makeKey(blueEndLoc, redEndLoc, propRotDir);
    return this.redRotationMap.get(key) || "";
  }

  getDashState(
    dashEndLoc: GridLocation,
    staticEndLoc: GridLocation,
    propRotDir: RotationDirection
  ): string {
    const key = this.makeKey(dashEndLoc, staticEndLoc, propRotDir);
    return this.dashRotationMap.get(key) || "";
  }

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

  private readonly blueRotationMap: PropRotationMap = new Map([
    [this.makeKey(GridLocation.EAST, GridLocation.NORTH, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.EAST, GridLocation.NORTH, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.EAST, GridLocation.SOUTH, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.EAST, GridLocation.SOUTH, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.WEST, GridLocation.NORTH, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.WEST, GridLocation.NORTH, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.WEST, GridLocation.SOUTH, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.WEST, GridLocation.SOUTH, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.NORTH, GridLocation.EAST, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.NORTH, GridLocation.EAST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.NORTH, GridLocation.WEST, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.NORTH, GridLocation.WEST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.SOUTH, GridLocation.EAST, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.SOUTH, GridLocation.EAST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.SOUTH, GridLocation.WEST, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.SOUTH, GridLocation.WEST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.NORTHEAST, GridLocation.SOUTHEAST, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.NORTHEAST, GridLocation.SOUTHEAST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.NORTHEAST, GridLocation.NORTHWEST, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.NORTHEAST, GridLocation.NORTHWEST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.SOUTHEAST, GridLocation.NORTHEAST, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.SOUTHEAST, GridLocation.NORTHEAST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.SOUTHWEST, GridLocation.NORTHWEST, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.SOUTHWEST, GridLocation.NORTHWEST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.SOUTHWEST, GridLocation.SOUTHEAST, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.SOUTHWEST, GridLocation.SOUTHEAST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.NORTHWEST, GridLocation.SOUTHWEST, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.NORTHWEST, GridLocation.SOUTHWEST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.NORTHWEST, GridLocation.NORTHEAST, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.NORTHWEST, GridLocation.NORTHEAST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
  ]);

  private readonly redRotationMap: PropRotationMap = new Map([
    [this.makeKey(GridLocation.EAST, GridLocation.NORTH, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.EAST, GridLocation.NORTH, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.EAST, GridLocation.SOUTH, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.EAST, GridLocation.SOUTH, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.WEST, GridLocation.NORTH, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.WEST, GridLocation.NORTH, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.WEST, GridLocation.SOUTH, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.WEST, GridLocation.SOUTH, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.NORTH, GridLocation.EAST, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.NORTH, GridLocation.EAST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.NORTH, GridLocation.WEST, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.NORTH, GridLocation.WEST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.SOUTH, GridLocation.EAST, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.SOUTH, GridLocation.EAST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.SOUTH, GridLocation.WEST, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.SOUTH, GridLocation.WEST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.NORTHEAST, GridLocation.SOUTHEAST, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.NORTHEAST, GridLocation.SOUTHEAST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.NORTHEAST, GridLocation.NORTHWEST, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.NORTHEAST, GridLocation.NORTHWEST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.SOUTHEAST, GridLocation.NORTHEAST, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.SOUTHEAST, GridLocation.NORTHEAST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.SOUTHWEST, GridLocation.NORTHWEST, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.SOUTHWEST, GridLocation.NORTHWEST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.SOUTHWEST, GridLocation.SOUTHEAST, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.SOUTHWEST, GridLocation.SOUTHEAST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.NORTHWEST, GridLocation.SOUTHWEST, RotationDirection.CLOCKWISE), CLOSING],
    [this.makeKey(GridLocation.NORTHWEST, GridLocation.SOUTHWEST, RotationDirection.COUNTER_CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.NORTHWEST, GridLocation.NORTHEAST, RotationDirection.CLOCKWISE), OPENING],
    [this.makeKey(GridLocation.NORTHWEST, GridLocation.NORTHEAST, RotationDirection.COUNTER_CLOCKWISE), CLOSING],
  ]);

  private readonly dashRotationMap: PropRotationMap = this.blueRotationMap;
  private readonly staticRotationMap: PropRotationMap = this.redRotationMap;
}
