/**
 * The coal-room look-dev stations.
 *
 * Each one exists to answer a single art-direction question that prose cannot
 * settle. The question is the point; the station is just the apparatus.
 */

export type LookdevStationId = "bed" | "wall" | "lamp" | "furnace" | "steam";

export interface LookdevStation {
  id: LookdevStationId;
  label: string;
  /** The question this station is built to answer. */
  question: string;
  /** What is being reused, and from where. */
  provenance: string;
  /** Position along the lineup. */
  x: number;
  /**
   * Where a visitor's eye goes when they stand at this station. Framing is
   * per-station because the subjects are at wildly different heights: a bed on
   * the floor and a lamp near the ceiling cannot share one aim point, and the
   * generic aim put the whole lamp behind the harness panel.
   */
  eye: {
    height: number;
    distance: number;
    look: number;
    lookZ: number;
    /**
     * Sideways step off the station's axis. Needed wherever a station repeats
     * an element down the z axis: stand dead on the line and every copy hides
     * behind the nearest one, which is the opposite of showing a route.
     */
    offsetX?: number;
  };
}

/** Half-width of the widest station, used to keep the lineup framing honest. */
export const STATION_PITCH = 7;

export const LOOKDEV_STATIONS: readonly LookdevStation[] = [
  {
    id: "bed",
    label: "A · Coal bed",
    question:
      "Does the crust shader read as a tended bed of coals, or as a puddle of lava in a box?",
    provenance: "LavaCracks + EmberFountains + HeatDistortion, ember scene",
    x: -STATION_PITCH * 2,
    eye: { height: 1.75, distance: 4.2, look: 0.35, lookZ: 0 },
  },
  {
    id: "wall",
    label: "B · Banked wall",
    question:
      "Can coal go vertical? Does an iron grate turn a lit rectangle into stored fuel?",
    provenance: "LavaCracks on a wall plane (new placement seam)",
    x: -STATION_PITCH,
    eye: { height: 1.75, distance: 6.0, look: 1.55, lookZ: -5 },
  },
  {
    id: "lamp",
    label: "C · Chain lamp",
    question:
      "Does the hood-and-basket silhouette read at walking distance, and does it mark a route?",
    provenance: "New fixture study; coals are the same LavaCracks crust",
    x: 0,
    // Back and low. A hanging fixture only shows its silhouette in profile;
    // stand under it and all you get is the underside.
    eye: { height: 1.6, distance: 7.4, look: 2.5, lookZ: -2.6, offsetX: 2.1 },
  },
  {
    id: "furnace",
    label: "D · Furnace mouth",
    question:
      "Does a barred mouth with fuel inside read as a furnace rather than a lit rectangle?",
    provenance: "LavaCracks + CoalBank behind fire bars + HeatDistortion",
    x: STATION_PITCH,
    eye: { height: 1.75, distance: 5.4, look: 1.6, lookZ: -5 },
  },
  {
    id: "steam",
    label: "E · Quench vent",
    question:
      "Does steam off a wet floor grate make the heat feel like something the room is losing?",
    provenance: "EmberFountains re-coloured as steam + HeatDistortion",
    x: STATION_PITCH * 2,
    eye: { height: 1.75, distance: 4.8, look: 1.1, lookZ: 0 },
  },
];
