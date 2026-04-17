/**
 * Auto-orbit preset
 *
 * Camera orbits the primary performer at fixed radius and vertical
 * angle, completing one full counter-clockwise revolution over the
 * sequence duration. The performer ends facing the camera — the
 * closing azimuth matches the opening azimuth by construction.
 */

import type { CameraPreset } from "../types";
import { computeAutoOrbitShot } from "./shots";

export const autoOrbitPreset: CameraPreset = {
  id: "auto-orbit",
  label: "Auto-orbit",
  icon: "fa-sync-alt",
  performerCountRule: { kind: "atLeast", count: 1 },
  totalLoops: 1,
  apply(controls, ctx) {
    const prevSmooth = controls.smoothTime;
    // No smoothing — the driver sets azimuth directly each tick and we
    // want it to land exactly where we set it, without lag.
    controls.smoothTime = 0;

    const initialAzimuth = controls.azimuthAngle;
    const shot = computeAutoOrbitShot(ctx.performers, initialAzimuth);

    // Snap to the opening pose. enableTransition=false so we arrive
    // instantly before recording starts.
    controls.setLookAt(
      shot.eye.x, shot.eye.y, shot.eye.z,
      shot.target.x, shot.target.y, shot.target.z,
      false,
    );

    // One revolution per sequence duration, CCW. Negative azimuth
    // delta = CCW in three.js / camera-controls convention (looking
    // down +Y, azimuth increases clockwise around +Y).
    const angularRateRadPerSec = (-2 * Math.PI) / Math.max(ctx.sequenceDurationSec, 0.001);

    const unsubscribeTick = ctx.onTick((delta) => {
      controls.azimuthAngle += angularRateRadPerSec * delta;
    });

    return () => {
      unsubscribeTick();
      controls.smoothTime = prevSmooth;
    };
  },
};
