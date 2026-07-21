import { Plane } from "@austencloud/scene-3d";
import {
  GridLocation,
  type GridLocation as GridLocationValue,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export const PRIMARY_PLANES = [Plane.WALL, Plane.WHEEL, Plane.FLOOR] as const;

export type PrimaryPlane = (typeof PRIMARY_PLANES)[number];
export type PropSide = "blue" | "red";
export type SculpturePreset = "solo" | "mirror" | "acolyte" | "radial";
export type LayoutMode = "viewport" | "studio";
export type SculptureMotionMode = "trace" | "undulate";
export type BeatOrientation = "in" | "out";
export type BeatTurns = "0" | "½" | "1";

export interface SpatialBeat {
  id: string;
  plane: PrimaryPlane;
  blueLocation: GridLocationValue;
  redLocation: GridLocationValue;
  blueOrientation: BeatOrientation;
  redOrientation: BeatOrientation;
  turns: BeatTurns;
}

export const PLANE_LABELS: Record<PrimaryPlane, string> = {
  [Plane.WALL]: "Wall",
  [Plane.WHEEL]: "Wheel",
  [Plane.FLOOR]: "Floor",
};

export const LOCATION_LABELS: Record<GridLocationValue, string> = {
  [GridLocation.NORTH]: "North",
  [GridLocation.NORTHEAST]: "Northeast",
  [GridLocation.EAST]: "East",
  [GridLocation.SOUTHEAST]: "Southeast",
  [GridLocation.SOUTH]: "South",
  [GridLocation.SOUTHWEST]: "Southwest",
  [GridLocation.WEST]: "West",
  [GridLocation.NORTHWEST]: "Northwest",
  [GridLocation.CENTER]: "Center",
};

export const LOCATION_ORDER: GridLocationValue[] = [
  GridLocation.NORTH,
  GridLocation.NORTHEAST,
  GridLocation.EAST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTH,
  GridLocation.SOUTHWEST,
  GridLocation.WEST,
  GridLocation.NORTHWEST,
];

export const LAYOUT_OPTIONS: { value: LayoutMode; label: string }[] = [
  { value: "viewport", label: "Viewport" },
  { value: "studio", label: "Step studio" },
];

export const HAND_OPTIONS: { value: PropSide; label: string }[] = [
  { value: "blue", label: "Blue path" },
  { value: "red", label: "Red path" },
];

export const MOTION_OPTIONS: {
  value: SculptureMotionMode;
  label: string;
}[] = [
  { value: "trace", label: "Trace" },
  { value: "undulate", label: "Undulate" },
];

export const PLANE_OPTIONS: { value: PrimaryPlane; label: string }[] = [
  { value: Plane.WALL, label: "Wall" },
  { value: Plane.WHEEL, label: "Wheel" },
  { value: Plane.FLOOR, label: "Floor" },
];

export const ORIENTATION_OPTIONS: {
  value: BeatOrientation;
  label: string;
}[] = [
  { value: "in", label: "In" },
  { value: "out", label: "Out" },
];

export const TURN_OPTIONS: { value: BeatTurns; label: string }[] = [
  { value: "0", label: "0" },
  { value: "½", label: "½" },
  { value: "1", label: "1" },
];

export const PRESET_OPTIONS: {
  value: SculpturePreset;
  label: string;
  count: number;
}[] = [
  { value: "solo", label: "Solo", count: 1 },
  { value: "mirror", label: "Mirror", count: 2 },
  { value: "acolyte", label: "Acolyte", count: 6 },
  { value: "radial", label: "Radial", count: 8 },
];

export const INITIAL_SPATIAL_BEATS: SpatialBeat[] = [
  {
    id: "beat-1",
    plane: Plane.WALL,
    blueLocation: GridLocation.NORTHEAST,
    redLocation: GridLocation.SOUTHWEST,
    blueOrientation: "in",
    redOrientation: "out",
    turns: "0",
  },
  {
    id: "beat-2",
    plane: Plane.WHEEL,
    blueLocation: GridLocation.NORTH,
    redLocation: GridLocation.SOUTH,
    blueOrientation: "out",
    redOrientation: "in",
    turns: "½",
  },
  {
    id: "beat-3",
    plane: Plane.FLOOR,
    blueLocation: GridLocation.EAST,
    redLocation: GridLocation.WEST,
    blueOrientation: "in",
    redOrientation: "in",
    turns: "1",
  },
  {
    id: "beat-4",
    plane: Plane.WALL,
    blueLocation: GridLocation.SOUTHWEST,
    redLocation: GridLocation.NORTHEAST,
    blueOrientation: "out",
    redOrientation: "out",
    turns: "½",
  },
  {
    id: "beat-5",
    plane: Plane.WHEEL,
    blueLocation: GridLocation.WEST,
    redLocation: GridLocation.EAST,
    blueOrientation: "in",
    redOrientation: "out",
    turns: "0",
  },
  {
    id: "beat-6",
    plane: Plane.FLOOR,
    blueLocation: GridLocation.NORTHWEST,
    redLocation: GridLocation.SOUTHEAST,
    blueOrientation: "out",
    redOrientation: "in",
    turns: "1",
  },
  {
    id: "beat-7",
    plane: Plane.WALL,
    blueLocation: GridLocation.SOUTH,
    redLocation: GridLocation.NORTH,
    blueOrientation: "in",
    redOrientation: "in",
    turns: "½",
  },
  {
    id: "beat-8",
    plane: Plane.WHEEL,
    blueLocation: GridLocation.SOUTHEAST,
    redLocation: GridLocation.NORTHWEST,
    blueOrientation: "out",
    redOrientation: "out",
    turns: "0",
  },
];

export function freshSpatialBeats(): SpatialBeat[] {
  return INITIAL_SPATIAL_BEATS.map((beat) => ({ ...beat }));
}
