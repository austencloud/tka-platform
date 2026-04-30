/**
 * Plane-locked preset factory
 *
 * The camera sits dead-on to a single plane (Wall / Wheel / Floor).
 * Camera height/distance auto-fit the performers' bounding sphere plus
 * 10% padding. On each loop boundary the shot re-fits (a performer may
 * have moved).
 */

import type { CameraPreset } from "../types";
import { computePlaneShot, type Plane3 } from "./shots";

const PLANE_META: Record<
  Plane3,
  { id: `plane-${Plane3}`; label: string; icon: string }
> = {
  wall: { id: "plane-wall", label: "Wall", icon: "fa-square" },
  wheel: { id: "plane-wheel", label: "Wheel", icon: "fa-circle" },
  floor: { id: "plane-floor", label: "Floor", icon: "fa-th-large" },
};

export function createPlaneLockedPreset(plane: Plane3): CameraPreset {
  const meta = PLANE_META[plane];
  return {
    id: meta.id,
    label: meta.label,
    icon: meta.icon,
    performerCountRule: { kind: "any" },
    totalLoops: 1,
    apply(controls, ctx) {
      const prevSmooth = controls.smoothTime;

      function snapShot(withTransition: boolean) {
        const shot = computePlaneShot(plane, ctx.performers);
        controls.setLookAt(
          shot.eye.x, shot.eye.y, shot.eye.z,
          shot.target.x, shot.target.y, shot.target.z,
          withTransition,
        );
      }

      // Opening shot: snap instantly.
      controls.smoothTime = 0;
      snapShot(false);

      // Re-fit on each loop boundary - use a brief smooth transition
      // so tiny mid-recording moves don't jitter.
      const unsubBoundary = ctx.onLoopBoundary(() => {
        controls.smoothTime = 0.5;
        snapShot(true);
      });

      return () => {
        unsubBoundary();
        controls.smoothTime = prevSmooth;
      };
    },
  };
}

export const planeWallPreset = createPlaneLockedPreset("wall");
export const planeWheelPreset = createPlaneLockedPreset("wheel");
export const planeFloorPreset = createPlaneLockedPreset("floor");
