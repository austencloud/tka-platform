export interface ClipMetadata {
  path: string;
  speedMs: number;
  stepsPerSecond: number;
  isRootMotion: boolean;
}

export const LOCOMOTION_CLIPS: Record<string, ClipMetadata> = {
  idle: {
    path: "/animations/locomotion-pack/idle-rm.glb",
    speedMs: 0,
    stepsPerSecond: 0,
    isRootMotion: true,
  },
  walk: {
    path: "/animations/locomotion-pack/walk-forward-rm.glb",
    speedMs: 1.4,
    stepsPerSecond: 2,
    isRootMotion: true,
  },
  run: {
    path: "/animations/locomotion-pack/run-rm.glb",
    speedMs: 4.0,
    stepsPerSecond: 3,
    isRootMotion: true,
  },
};

export function computeBlendWeights(speed: number): {
  idle: number;
  walk: number;
  run: number;
} {
  const walkSpeed = LOCOMOTION_CLIPS.walk!.speedMs;
  const runSpeed = LOCOMOTION_CLIPS.run!.speedMs;

  if (speed <= 0.01) return { idle: 1, walk: 0, run: 0 };
  if (speed <= walkSpeed) {
    const t = speed / walkSpeed;
    return { idle: 1 - t, walk: t, run: 0 };
  }
  if (speed <= runSpeed) {
    const t = (speed - walkSpeed) / (runSpeed - walkSpeed);
    return { idle: 0, walk: 1 - t, run: t };
  }
  return { idle: 0, walk: 0, run: 1 };
}

export function computeTimeScale(
  speed: number,
  clipSpeedMs: number
): number {
  if (clipSpeedMs <= 0) return 1;
  return Math.max(0.5, Math.min(2.0, speed / clipSpeedMs));
}
