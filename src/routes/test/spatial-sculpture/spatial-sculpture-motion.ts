import {
  Plane,
  type Plane as PlaneValue,
  type PropState3D,
} from "@austencloud/scene-3d";
import { Quaternion, Vector3, type CatmullRomCurve3 } from "three";

const RENDERED_STAFF_AXIS = new Vector3(-1, 0, 0);
const FALLBACK_DIRECTION = new Vector3(1, 0, 0);

export interface TracerPose {
  center: Vector3;
  tip: Vector3;
  propState: PropState3D;
}

export function calculateUndulationScale(phase: number, depth: number): number {
  const wrappedPhase = ((phase % 1) + 1) % 1;
  const triangle = wrappedPhase < 0.5 ? wrappedPhase * 2 : 2 - wrappedPhase * 2;
  const eased = (1 - Math.cos(triangle * Math.PI)) / 2;
  const safeDepth = Math.min(0.75, Math.max(0, depth));

  return 1 - safeDepth + safeDepth * 2 * eased;
}

export function createTracerPose(
  curve: CatmullRomCurve3,
  progress: number,
  sculptureScale: number,
  propLength: number,
  plane: PlaneValue = Plane.WALL
): TracerPose {
  const wrappedProgress = ((progress % 1) + 1) % 1;
  const tip = curve.getPointAt(wrappedProgress).multiplyScalar(sculptureScale);
  const direction = tip.clone();

  if (direction.lengthSq() < 1e-8) {
    direction.copy(curve.getTangentAt(wrappedProgress));
  }
  if (direction.lengthSq() < 1e-8) {
    direction.copy(FALLBACK_DIRECTION);
  }
  direction.normalize();

  const center = tip
    .clone()
    .addScaledVector(direction, -Math.max(0, propLength) / 2);
  const worldRotation = new Quaternion().setFromUnitVectors(
    RENDERED_STAFF_AXIS,
    direction
  );

  return {
    center,
    tip,
    propState: {
      centerPathAngle: 0,
      staffRotationAngle: 0,
      plane,
      worldPosition: center.clone(),
      worldRotation,
    },
  };
}
