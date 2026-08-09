/**
 * The four coal-room look-dev stations.
 *
 * Each one exists to answer a single art-direction question that prose cannot
 * settle. The question is the point; the station is just the apparatus.
 */

export type LookdevStationId = "bed" | "wall" | "lamp" | "furnace";

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
  eye: { height: number; distance: number; look: number; lookZ: number };
}

export const LOOKDEV_STATIONS: readonly LookdevStation[] = [
  {
    id: "bed",
    label: "A · Coal bed",
    question:
      "Does the crust shader read as a tended bed of coals, or as a puddle of lava in a box?",
    provenance: "LavaCracks + EmberFountains + HeatDistortion, ember scene",
    x: -10.5,
    eye: { height: 1.75, distance: 4.2, look: 0.35, lookZ: 0 },
  },
  {
    id: "wall",
    label: "B · Banked wall",
    question:
      "Can coal go vertical? Does an iron grate turn a lit rectangle into stored fuel?",
    provenance: "LavaCracks on a wall plane (new placement seam)",
    x: -3.5,
    eye: { height: 1.75, distance: 6.0, look: 1.55, lookZ: -5 },
  },
  {
    id: "lamp",
    label: "C · Chain lamp",
    question:
      "Does the hood-and-basket silhouette read at walking distance, and does it mark a route?",
    provenance: "New fixture study; coals are the same LavaCracks crust",
    x: 3.5,
    eye: { height: 1.75, distance: 4.6, look: 2.75, lookZ: 0 },
  },
  {
    id: "furnace",
    label: "D · Furnace mouth",
    question:
      "Does a vent breathing heat and steam make the room feel worked rather than geological?",
    provenance: "LavaCracks + HeatDistortion + FallingParticles(smoke)",
    x: 10.5,
    eye: { height: 1.75, distance: 5.4, look: 1.6, lookZ: -5 },
  },
];
