/**
 * diamond-pose-enumerator
 *
 * Produces all 576 two-hand poses for diamond mode with in/out orientations,
 * with INDEPENDENT planes per hand. This is the full cross-plane catalog:
 *
 *   per hand: 3 planes × 4 cardinals × 2 orientations = 24 states
 *   combined: 24 × 24 = 576 poses
 *
 * Cross-plane combinations (blue on wall, red on wheel, etc.) are exactly
 * where the hard collision cases live - a single-plane catalog would miss
 * the main problem the lab exists to solve.
 *
 * The enumeration order is deterministic:
 *   bluePlane → bluePos → blueOri → redPlane → redPos → redOri
 *
 * So "pose 47 of 576" refers to the same pose across sessions, tests,
 * and committed labels.
 */

import type {
  PoseDefinition,
  DiamondPosition,
  HandOrientation,
  HandState,
} from "../domain/types";
import { Plane } from "@austencloud/scene-3d";

const PLANES: readonly Plane[] = [Plane.WALL, Plane.WHEEL, Plane.FLOOR];
const POSITIONS: readonly DiamondPosition[] = ["N", "E", "S", "W"];
const ORIENTATIONS: readonly HandOrientation[] = ["in", "out"];

/** Single-character plane codes for compact pose IDs. */
const PLANE_CODE: Record<Plane, string> = {
  [Plane.WALL]: "w",
  [Plane.WHEEL]: "h",
  [Plane.FLOOR]: "f",
  // Fusion planes - not enumerated in Phase 1 but listed for exhaustiveness
  [Plane.RIGHT_SHIELD]: "rs",
  [Plane.LEFT_SHIELD]: "ls",
  [Plane.FORWARD_RAMP]: "fr",
  [Plane.BACKWARD_RAMP]: "br",
  [Plane.RIGHT_WING]: "rw",
  [Plane.LEFT_WING]: "lw",
};

function handCode(h: HandState): string {
  return `${PLANE_CODE[h.plane]}${h.position}${h.orientation[0]}`;
}

export function enumerateDiamondInOut(): PoseDefinition[] {
  const poses: PoseDefinition[] = [];
  for (const leftPlane of PLANES) {
    for (const leftPos of POSITIONS) {
      for (const leftOri of ORIENTATIONS) {
        for (const rightPlane of PLANES) {
          for (const rightPos of POSITIONS) {
            for (const rightOri of ORIENTATIONS) {
              const leftHand: HandState = {
                plane: leftPlane,
                position: leftPos,
                orientation: leftOri,
              };
              const rightHand: HandState = {
                plane: rightPlane,
                position: rightPos,
                orientation: rightOri,
              };
              poses.push({
                id: `${handCode(leftHand)}-${handCode(rightHand)}`,
                leftHand,
                rightHand,
              });
            }
          }
        }
      }
    }
  }
  return poses;
}
