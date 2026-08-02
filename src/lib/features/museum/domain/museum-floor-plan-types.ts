export type MuseumFloorPlanLayer = "program" | "tiles";

export type MuseumFloorPlanZoneTone =
  | "arrival"
  | "anchor"
  | "social"
  | "service"
  | "exhibit"
  | "retail"
  | "threshold";

export interface MuseumFloorPlanZone {
  id: string;
  number: number;
  title: string;
  description: string;
  /** Absolute tile coordinate in the built MuseumGrid. */
  x: number;
  /** Absolute tile coordinate in the built MuseumGrid. */
  y: number;
  width: number;
  height: number;
  tone: MuseumFloorPlanZoneTone;
}

export interface MuseumFloorPlanPoint {
  /** Absolute tile coordinate; fractions address positions within a tile. */
  x: number;
  /** Absolute tile coordinate; fractions address positions within a tile. */
  y: number;
}
