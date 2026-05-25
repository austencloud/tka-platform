import type {
  FormationKeyframe,
  PerformerPose,
  TransitionConfig,
} from "../domain/stage-types";

export interface InterpolatedPose extends PerformerPose {
  speed: number;
}

export function applyEasing(
  t: number,
  easing: TransitionConfig["easing"]
): number {
  switch (easing) {
    case "linear":
      return t;
    case "easeInOut":
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case "easeIn":
      return t * t;
    case "easeOut":
      return 1 - (1 - t) * (1 - t);
  }
}

function lerpFacing(from: number, to: number, t: number): number {
  let delta = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

export function interpolateFormation(
  from: FormationKeyframe,
  to: FormationKeyframe,
  progress: number,
  transition: TransitionConfig
): InterpolatedPose[] {
  const eased = applyEasing(
    Math.max(0, Math.min(1, progress)),
    transition.easing
  );

  return from.positions.map((fromPose, i) => {
    const toPose = to.positions[i] ?? fromPose;

    const x = fromPose.x + (toPose.x - fromPose.x) * eased;
    const z = fromPose.z + (toPose.z - fromPose.z) * eased;
    const facing = lerpFacing(fromPose.facing, toPose.facing, eased);

    const dx = toPose.x - fromPose.x;
    const dz = toPose.z - fromPose.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const beatDuration = to.beat - from.beat;
    const speed = beatDuration > 0 ? distance / beatDuration : 0;

    return {
      performerId: fromPose.performerId,
      x,
      z,
      facing,
      planeMode: eased < 0.5 ? fromPose.planeMode : toPose.planeMode,
      speed,
    };
  });
}

export function computeRequiredSpeed(
  from: PerformerPose,
  to: PerformerPose,
  durationSeconds: number
): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return Math.sqrt(dx * dx + dz * dz) / durationSeconds;
}
