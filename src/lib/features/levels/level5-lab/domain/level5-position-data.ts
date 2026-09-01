import {
  GridLocation,
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { OrientationOption } from "./level5-lab-types";


/**
 * Maps each centric GridPosition to its [blue, red] hand locations.
 * TAU1-8:  blue at center, red at perimeter
 * TAU9-16: red at center, blue at perimeter
 * TERRA1:  both at center
 */
export const POSITION_LOCATIONS: Partial<
  Record<GridPosition, [GridLocation, GridLocation]>
> = {
  // Blue at center, red at perimeter
  [GridPosition.TAU1]: [GridLocation.CENTER, GridLocation.NORTH],
  [GridPosition.TAU2]: [GridLocation.CENTER, GridLocation.NORTHEAST],
  [GridPosition.TAU3]: [GridLocation.CENTER, GridLocation.EAST],
  [GridPosition.TAU4]: [GridLocation.CENTER, GridLocation.SOUTHEAST],
  [GridPosition.TAU5]: [GridLocation.CENTER, GridLocation.SOUTH],
  [GridPosition.TAU6]: [GridLocation.CENTER, GridLocation.SOUTHWEST],
  [GridPosition.TAU7]: [GridLocation.CENTER, GridLocation.WEST],
  [GridPosition.TAU8]: [GridLocation.CENTER, GridLocation.NORTHWEST],
  // Red at center, blue at perimeter
  [GridPosition.TAU9]: [GridLocation.NORTH, GridLocation.CENTER],
  [GridPosition.TAU10]: [GridLocation.NORTHEAST, GridLocation.CENTER],
  [GridPosition.TAU11]: [GridLocation.EAST, GridLocation.CENTER],
  [GridPosition.TAU12]: [GridLocation.SOUTHEAST, GridLocation.CENTER],
  [GridPosition.TAU13]: [GridLocation.SOUTH, GridLocation.CENTER],
  [GridPosition.TAU14]: [GridLocation.SOUTHWEST, GridLocation.CENTER],
  [GridPosition.TAU15]: [GridLocation.WEST, GridLocation.CENTER],
  [GridPosition.TAU16]: [GridLocation.NORTHWEST, GridLocation.CENTER],
  // Both at center
  [GridPosition.TERRA1]: [GridLocation.CENTER, GridLocation.CENTER],
};


/** Tau Diamond: perimeter prop at cardinal point (N/E/S/W) */
export const TAU_DIAMOND_POSITIONS: GridPosition[] = [
  GridPosition.TAU1,
  GridPosition.TAU3,
  GridPosition.TAU5,
  GridPosition.TAU7,
  GridPosition.TAU9,
  GridPosition.TAU11,
  GridPosition.TAU13,
  GridPosition.TAU15,
];

/** Tau Box: perimeter prop at intercardinal point (NE/SE/SW/NW) */
export const TAU_BOX_POSITIONS: GridPosition[] = [
  GridPosition.TAU2,
  GridPosition.TAU4,
  GridPosition.TAU6,
  GridPosition.TAU8,
  GridPosition.TAU10,
  GridPosition.TAU12,
  GridPosition.TAU14,
  GridPosition.TAU16,
];

/** Terra: both hands at center */
export const TERRA_POSITIONS: GridPosition[] = [GridPosition.TERRA1];


/** Radial orientations for perimeter-positioned props */
export const RADIAL_ORIENTATIONS: readonly OrientationOption[] = [
  { value: Orientation.IN, label: "In", icon: "fa-compress-arrows-alt" },
  { value: Orientation.OUT, label: "Out", icon: "fa-expand-arrows-alt" },
  { value: Orientation.CLOCK, label: "CW", icon: "fa-rotate-right" },
  { value: Orientation.COUNTER, label: "CCW", icon: "fa-rotate-left" },
] as const;

/** Compass orientations for center-positioned props */
export const COMPASS_ORIENTATIONS: readonly OrientationOption[] = [
  { value: Orientation.CENTER_N, label: "N", icon: "fa-arrow-up" },
  { value: Orientation.CENTER_NE, label: "NE", icon: "fa-arrow-up", rotation: 45 },
  { value: Orientation.CENTER_E, label: "E", icon: "fa-arrow-right" },
  { value: Orientation.CENTER_SE, label: "SE", icon: "fa-arrow-down", rotation: -45 },
  { value: Orientation.CENTER_S, label: "S", icon: "fa-arrow-down" },
  { value: Orientation.CENTER_SW, label: "SW", icon: "fa-arrow-down", rotation: 45 },
  { value: Orientation.CENTER_W, label: "W", icon: "fa-arrow-left" },
  { value: Orientation.CENTER_NW, label: "NW", icon: "fa-arrow-up", rotation: -45 },
] as const;


const CARDINAL_LOCATIONS: ReadonlySet<GridLocation> = new Set<GridLocation>([
  GridLocation.NORTH,
  GridLocation.EAST,
  GridLocation.SOUTH,
  GridLocation.WEST,
]);

/** Determine grid mode from the perimeter prop's location */
export function getGridModeForPosition(position: GridPosition): GridMode {
  const locations = POSITION_LOCATIONS[position];
  if (!locations) return GridMode.DIAMOND;
  const [leftLoc, rightLoc] = locations;
  const perimeterLoc =
    leftLoc === GridLocation.CENTER ? rightLoc : leftLoc;
  if (perimeterLoc === GridLocation.CENTER) return GridMode.DIAMOND;
  return CARDINAL_LOCATIONS.has(perimeterLoc) ? GridMode.DIAMOND : GridMode.BOX;
}

/** Format a GridPosition enum value to display label (e.g. "tau1" -> "Tau1") */
export function formatPosition(pos: GridPosition): string {
  const match = pos.match(/^(tau|terra)(\d+)$/i);
  if (match?.[1] && match[2]) {
    return `${match[1].charAt(0).toUpperCase()}${match[1].slice(1)}${match[2]}`;
  }
  return pos.toUpperCase();
}

/** Whether a hand is at center for a given position */
export function isHandAtCenter(
  position: GridPosition,
  hand: "left" | "right"
): boolean {
  const locations = POSITION_LOCATIONS[position];
  if (!locations) return false;
  const index = hand === "left" ? 0 : 1;
  return locations[index] === GridLocation.CENTER;
}

/** Whether an orientation value is a compass (center) orientation */
export function isCenterOrientation(ori: Orientation): boolean {
  return (ori as string).startsWith("center");
}
