/**
 * Ensemble-focus preset (sequential MVP)
 *
 * Strict 4 performers. Four loops, each framed on one performer with
 * a different plane / shot so the recording covers every performer
 * from every angle:
 *
 *   loop 0: performer 0, Wall
 *   loop 1: performer 1, Wheel
 *   loop 2: performer 2, Floor
 *   loop 3: performer 3, Auto-orbit
 *
 * v1 renders sequentially. Real quad-split (4 simultaneous cameras
 * composited into one frame) is a followup — see spec §3.4 v1 note.
 * Path to quad-split: per-camera render target, compose to the final
 * backing canvas each frame in the recording pipeline.
 */

import type { CameraPreset } from "../types";
import { computePlaneShot, computeAutoOrbitShot, type Plane3 } from "./shots";

const TRANSITION_SMOOTH_TIME = 0.8;

type Assignment =
  | { kind: "plane"; plane: Plane3 }
  | { kind: "orbit" };

const ASSIGNMENTS: Assignment[] = [
  { kind: "plane", plane: "wall" },
  { kind: "plane", plane: "wheel" },
  { kind: "plane", plane: "floor" },
  { kind: "orbit" },
];

export const ensembleFocusPreset: CameraPreset = {
  id: "ensemble-focus",
  label: "Ensemble",
  icon: "fa-users",
  performerCountRule: { kind: "exactly", count: 4 },
  totalLoops: 4,
  apply(controls, ctx) {
    const prevSmooth = controls.smoothTime;
    let loopIndex = 0;
    let orbitUnsubTick: (() => void) | null = null;

    function snapToLoop(index: number, withTransition: boolean) {
      if (orbitUnsubTick) {
        orbitUnsubTick();
        orbitUnsubTick = null;
      }
      const assignment: Assignment = ASSIGNMENTS[index] ?? { kind: "orbit" };
      const focus = ctx.performers[index];
      if (!focus) return;

      // Frame this specific performer, not the whole group.
      const solo = [focus];

      if (assignment.kind === "plane") {
        const shot = computePlaneShot(assignment.plane, solo);
        controls.smoothTime = withTransition ? TRANSITION_SMOOTH_TIME : 0;
        controls.setLookAt(
          shot.eye.x, shot.eye.y, shot.eye.z,
          shot.target.x, shot.target.y, shot.target.z,
          withTransition,
        );
        return;
      }

      // Orbit shot around focus performer.
      const shot = computeAutoOrbitShot(solo, controls.azimuthAngle);
      controls.smoothTime = withTransition ? TRANSITION_SMOOTH_TIME : 0;
      controls.setLookAt(
        shot.eye.x, shot.eye.y, shot.eye.z,
        shot.target.x, shot.target.y, shot.target.z,
        withTransition,
      );

      const orbitRate = (-2 * Math.PI) / Math.max(ctx.sequenceDurationSec, 0.001);
      let settling = withTransition;
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
