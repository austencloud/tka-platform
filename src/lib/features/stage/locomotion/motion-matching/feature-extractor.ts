import {
  FEATURE_STRIDE,
  HORIZONS_SEC,
  buildColumnWeights,
  type FeatureWeights,
  type MotionDatabase,
  type MotionFrame,
  type PoseSample,
} from "./feature-types";

export interface ClipSpec {
  clipId: string;
  durationSec: number;
}

export type PoseSampler = (clipId: string, time: number) => PoseSample;

/** Shortest-arc difference a-b wrapped to [-PI, PI]. */
function angleDelta(a: number, b: number): number {
  let d = ((a - b + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Build the motion database. For each clip, sample at `fps`. Velocities use a
 * one-frame finite difference; trajectory features read the future sample at
 * each horizon, expressed in the CURRENT frame's root-local space.
 */
export function buildMotionDatabase(
  clips: ClipSpec[],
  sample: PoseSampler,
  fps: number,
  weights: FeatureWeights,
): MotionDatabase {
  const dt = 1 / fps;
  const frames: MotionFrame[] = [];
  const rows: number[] = [];

  for (const clip of clips) {
    const frameCount = Math.floor(clip.durationSec * fps);
    for (let f = 0; f < frameCount; f++) {
      const t = f * dt;
      const tNext = Math.min(clip.durationSec, t + dt);
      const cur = sample(clip.clipId, t);
      const nxt = sample(clip.clipId, tNext);

      const row = new Array<number>(FEATURE_STRIDE).fill(0);

      row[0] = cur.leftFoot[0]; row[1] = cur.leftFoot[1]; row[2] = cur.leftFoot[2];
      row[3] = cur.rightFoot[0]; row[4] = cur.rightFoot[1]; row[5] = cur.rightFoot[2];

      const inv = tNext > t ? 1 / (tNext - t) : 0;
      row[6] = (nxt.leftFoot[0] - cur.leftFoot[0]) * inv;
      row[7] = (nxt.leftFoot[1] - cur.leftFoot[1]) * inv;
      row[8] = (nxt.leftFoot[2] - cur.leftFoot[2]) * inv;
      row[9] = (nxt.rightFoot[0] - cur.rightFoot[0]) * inv;
      row[10] = (nxt.rightFoot[1] - cur.rightFoot[1]) * inv;
      row[11] = (nxt.rightFoot[2] - cur.rightFoot[2]) * inv;

      row[12] = (nxt.hips[0] - cur.hips[0]) * inv;
      row[13] = (nxt.hips[1] - cur.hips[1]) * inv;
      row[14] = (nxt.hips[2] - cur.hips[2]) * inv;

      const cosF = Math.cos(-cur.facing);
      const sinF = Math.sin(-cur.facing);
      for (let h = 0; h < HORIZONS_SEC.length; h++) {
        const th = Math.min(clip.durationSec, t + HORIZONS_SEC[h]!);
        const fut = sample(clip.clipId, th);
        const dxw = fut.rootXZ[0] - cur.rootXZ[0];
        const dzw = fut.rootXZ[1] - cur.rootXZ[1];
        const lx = dxw * cosF - dzw * sinF;
        const lz = dxw * sinF + dzw * cosF;
        row[15 + h * 2] = lx;
        row[16 + h * 2] = lz;
        row[21 + h] = angleDelta(fut.facing, cur.facing);
      }

      const thighDelta =
        cur.leftThigh && cur.rightThigh
          ? cur.rightThigh[0] - cur.leftThigh[0]
          : 0;
      const footDelta = cur.rightFoot[0] - cur.leftFoot[0];
      const quality =
        Math.abs(thighDelta) > 1e-6
          ? {
              legOrderMargin: footDelta * Math.sign(thighDelta),
              footSeparation: Math.abs(footDelta),
            }
          : undefined;
      frames.push({ clipId: clip.clipId, time: t, ...(quality && { quality }) });
      for (let c = 0; c < FEATURE_STRIDE; c++) rows.push(row[c]!);
    }
  }

  return {
    features: new Float32Array(rows),
    frames,
    columnWeights: buildColumnWeights(weights),
  };
}
