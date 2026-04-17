/**
 * Quad-plane tour preset
 *
 * Four loops of the sequence — one per shot:
 *   loop 0: Wall
 *   loop 1: Wheel
 *   loop 2: Floor
 *   loop 3: Auto-orbit
 *
 * Transitions happen only at loop boundaries, with a ~0.8s smooth ease
 * handled by camera-controls' own interpolation. The final orbit ties
 * the three planes together so the recording reads as one gestalt.
 */

import type { CameraPreset } from "../types";
import { computePlaneShot, computeAutoOrbitShot, type Plane3 } from "./shots";

const TRANSITION_SMOOTH_TIME = 0.8;

const PLANE_ORDER: Plane3[] = ["wall", "wheel", "floor"];

export const quadPlaneTourPreset: CameraPreset = {
  id: "quad-plane-tour",
  label: "Tour",
  icon: "fa-film",
  performerCountRule: { kind: "any" },
  totalLoops: 4,
  apply(controls, ctx) {
    const prevSmooth = controls.smoothTime;
    let loopIndex = 0;
    let orbitUnsubTick: (() => void) | null = null;

    function snapToLoop(index: number, withTransition: boolean) {
      // Tear down previous orbit tick if any — only the final loop
      // animates per-frame; the plane shots are static until the next
      // boundary.
      if (orbitUnsubTick) {
        orbitUnsubTick();
        orbitUnsubTick = null;
      }

      if (index <= 2) {
        const plane = PLANE_ORDER[index] ?? "wall";
        const shot = computePlaneShot(plane, ctx.performers);
        controls.smoothTime = withTransition ? TRANSITION_SMOOTH_TIME : 0;
        controls.setLookAt(
          shot.eye.x, shot.eye.y, shot.eye.z,
          shot.target.x, shot.target.y, shot.target.z,
          withTransition,
        );
        return;
      }

      // Final loop: auto-orbit. Pick the same angular rate as
      // auto-orbit preset so the closing frame faces camera-forward.
      const shot = computeAutoOrbitShot(ctx.performers, controls.azimuthAngle);
      controls.smoothTime = TRANSITION_SMOOTH_TIME;
      controls.setLookAt(
        shot.eye.x, shot.eye.y, shot.eye.z,
        shot.target.x, shot.target.y, shot.target.z,
        true,
      );

      // After the transition completes, drop smoothTime and orbit.
      const orbitRate = (-2 * Math.PI) / Math.max(ctx.sequenceDurationSec, 0.001);
      let settling = true;
      let settleRemaining = TRANSITION_SMOOTH_TIME * 1.2;
      orbitUnsubTick = ctx.onTick((delta) => {
        if (settling) {
          settleRemaining -= delta;
          if (settleRemaining <= 0) {
            settling = false;
            controls.smoothTime = 0;
          }
          return;
        }
        controls.azimuthAngle += orbitRate * delta;
      });
    }

    snapToLoop(0, false);

    const unsubBoundary = ctx.onLoopBoundary(() => {
      loopIndex = Math.min(loopIndex + 1, ctx.totalLoops - 1);
      snapToLoop(loopIndex, true);
    });

    return () => {
      unsubBoundary();
      if (orbitUnsubTick) orbitUnsubTick();
      controls.smoothTime = prevSmooth;
    };
  },
};
