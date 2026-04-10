/**
 * DiamondPoseEnumerator
 *
 * Produces all 192 two-hand poses for diamond mode with in/out orientations:
 * 3 planes × (4 cardinals × 2 orientations)².
 *
 * The enumeration order is deterministic (plane → bluePos → blueOri →
 * redPos → redOri), so "pose 47 of 192" refers to the same pose across
 * sessions, tests, and committed labels.
 */

import type { IPoseEnumerator } from "../contracts/IPoseEnumerator";
import type {
  PoseDefinition,
  DiamondPosition,
  HandOrientation,
} from "../../domain/types";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";

const PLANES: readonly Plane[] = [Plane.WALL, Plane.WHEEL, Plane.FLOOR];
const POSITIONS: readonly DiamondPosition[] = ["N", "E", "S", "W"];
const ORIENTATIONS: readonly HandOrientation[] = ["in", "out"];

export class DiamondPoseEnumerator implements IPoseEnumerator {
  enumerateDiamondInOut(): PoseDefinition[] {
    const poses: PoseDefinition[] = [];
    for (const plane of PLANES) {
      for (const bluePos of POSITIONS) {
        for (const blueOri of ORIENTATIONS) {
          for (const redPos of POSITIONS) {
            for (const redOri of ORIENTATIONS) {
              poses.push({
                id: `${plane}-${bluePos}${blueOri[0]}-${redPos}${redOri[0]}`,
                plane,
                blueHand: { position: bluePos, orientation: blueOri },
                redHand: { position: redPos, orientation: redOri },
              });
            }
          }
        }
      }
    }
    return poses;
  }
}
